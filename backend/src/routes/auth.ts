import bcrypt from "bcrypt";
import { Router } from "express";
import type { DatabaseError } from "pg";
import { contactDisclosurePool, query } from "../db/client.js";
import { asyncHandler } from "../utils/http.js";
import { generateAnonymousId, hashEmail, signAuthToken } from "../utils/security.js";
import { normalizeEmail, validateRegistrationInput } from "../validators/auth.js";

interface UserRow {
  id: string;
  password_hash: string;
}

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null && "code" in error;
}

export const authRouter = Router();

authRouter.post(
  "/register/hr",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(String(req.body.email ?? ""));
    const password = String(req.body.password ?? "");
    const errors = validateRegistrationInput(email, password);

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const result = await query<{ id: string; email: string }>(
        `
          INSERT INTO hr_users (email, password_hash)
          VALUES ($1, $2)
          RETURNING id, email
        `,
        [email, passwordHash]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (isDatabaseError(error) && error.code === "23505" && error.constraint === "hr_users_email_key") {
        res.status(409).json({ error: "That account already exists." });
        return;
      }

      console.error("HR registration failed:", error);
      res.status(500).json({ error: "Could not create the account right now." });
    }
  })
);

authRouter.post(
  "/register/applicant",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(String(req.body.email ?? ""));
    const password = String(req.body.password ?? "");
    const phone = req.body.phone ? String(req.body.phone) : null;
    const errors = validateRegistrationInput(email, password);

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const emailHash = hashEmail(email);
    let applicantId: string | null = null;
    let anonymousId = "";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      anonymousId = generateAnonymousId();

      try {
        const applicantResult = await query<{ id: string }>(
          `
            INSERT INTO applicants (anonymous_id, email_hash, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id
          `,
          [anonymousId, emailHash, passwordHash]
        );

        applicantId = applicantResult.rows[0].id;
        break;
      } catch (error) {
        if (isDatabaseError(error) && error.code === "23505") {
          if (error.constraint === "applicants_email_hash_key") {
            res.status(409).json({ error: "That account already exists." });
            return;
          }

          if (error.constraint === "applicants_anonymous_id_key") {
            applicantId = null;
            continue;
          }
        }

        console.error("Applicant registration failed during applicant insert:", error);
        res.status(500).json({ error: "Could not create the account right now." });
        return;
      }
    }

    if (!applicantId) {
      res.status(500).json({ error: "Could not allocate a stable anonymous ID." });
      return;
    }

    try {
      await contactDisclosurePool.query(
        `
          INSERT INTO identity_schema.applicant_identity (applicant_id, email, phone)
          VALUES ($1, $2, $3)
        `,
        [applicantId, email, phone]
      );

      res.status(201).json({
        id: applicantId,
        anonymousId,
      });
    } catch (error) {
      console.error("Applicant registration failed during identity insert:", error);
      await query("DELETE FROM applicants WHERE id = $1", [applicantId]);
      res.status(500).json({ error: "Could not finish applicant registration." });
    }
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(String(req.body.email ?? ""));
    const password = String(req.body.password ?? "");

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const hrResult = await query<UserRow>(
      "SELECT id, password_hash FROM hr_users WHERE email = $1",
      [email]
    );

    if (hrResult.rowCount) {
      const user = hrResult.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);

      if (!isValid) {
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }

      const token = signAuthToken({
        userId: user.id,
        userType: "hr",
      });

      res.json({ token, userType: "hr" });
      return;
    }

    const applicantResult = await query<UserRow>(
      "SELECT id, password_hash FROM applicants WHERE email_hash = $1",
      [hashEmail(email)]
    );

    if (!applicantResult.rowCount) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const user = applicantResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const token = signAuthToken({
      userId: user.id,
      userType: "applicant",
    });

    res.json({ token, userType: "applicant" });
  })
);

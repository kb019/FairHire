import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { AuthenticatedUser } from "../types/auth.js";
import { env } from "../config/env.js";

export function hashEmail(email: string) {
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

export function signAuthToken(payload: AuthenticatedUser) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "8h" });
}

export function generateAnonymousId() {
  const numeric = crypto.randomInt(1000, 10000);
  return `Candidate #${numeric}`;
}


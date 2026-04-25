import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { AuthenticatedUser } from "../types/auth.js";

function extractBearerToken(header: string | undefined) {
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.header("Authorization"));

  if (!token) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session." });
  }
}

export function requireHr(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.userType !== "hr") {
    res.status(403).json({ error: "HR access is required for this action." });
    return;
  }

  next();
}

export function requireApplicant(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.userType !== "applicant") {
    res.status(403).json({ error: "Applicant access is required for this action." });
    return;
  }

  next();
}

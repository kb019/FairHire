import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { analyticsRouter } from "./routes/analytics.js";
import { analysisRouter } from "./routes/analysis.js";
import { authRouter } from "./routes/auth.js";
import { candidatesRouter } from "./routes/candidates.js";
import { jobPostingsRouter } from "./routes/jobPostings.js";
import { resumesRouter } from "./routes/resumes.js";

export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/analyze", analysisRouter);
app.use("/api/job-postings", jobPostingsRouter);
app.use("/api/job-postings", candidatesRouter);
app.use("/api/resumes", resumesRouter);
app.use("/api/analytics", analyticsRouter);

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error." });
});

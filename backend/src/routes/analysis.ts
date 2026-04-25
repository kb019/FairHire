import { Router } from "express";
import { analyzeJobPosting } from "../analyzer/jobPostingAnalyzer.js";
import { asyncHandler } from "../utils/http.js";

export const analysisRouter = Router();

analysisRouter.post(
  "/job-posting",
  asyncHandler(async (req, res) => {
    const text = String(req.body.text ?? "");
    const result = await analyzeJobPosting(text);
    res.json(result);
  })
);

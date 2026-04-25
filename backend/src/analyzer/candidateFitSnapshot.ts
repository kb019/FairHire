import { env } from "../config/env.js";
import type { RedactedResume } from "../types/api.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type ExperienceAlignment = "strong" | "moderate" | "limited";

interface JobPostingFitContext {
  title: string;
  industryCategory: string;
  department: string | null;
  location: string | null;
  employmentType: string | null;
  compensationRange: string | null;
  content: string;
}

interface LlmFitSnapshot {
  score: number;
  experience_alignment: ExperienceAlignment;
  fit_summary: string;
  matched_skills: string[];
  missing_requirements: string[];
  standout_signals: string[];
}

export interface CandidateFitSnapshot {
  score: number;
  experience_alignment: ExperienceAlignment;
  fit_summary: string;
  matched_skills: string[];
  missing_requirements: string[];
  standout_signals: string[];
}

const stopWords = new Set([
  "about",
  "ability",
  "across",
  "after",
  "applicant",
  "applicants",
  "background",
  "candidate",
  "candidates",
  "collaboration",
  "company",
  "customers",
  "degree",
  "department",
  "environment",
  "experience",
  "familiarity",
  "general",
  "including",
  "knowledge",
  "location",
  "manage",
  "managing",
  "members",
  "minimum",
  "opportunity",
  "preferred",
  "professional",
  "qualified",
  "qualifications",
  "requirements",
  "responsibilities",
  "safety",
  "skills",
  "strong",
  "support",
  "systems",
  "team",
  "teams",
  "tools",
  "using",
  "welcome",
  "years",
]);

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePhrase(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function uniqueList(values: string[]) {
  return Array.from(new Set(values.map((item) => normalizeWhitespace(item)).filter(Boolean)));
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function extractResponseText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  for (const item of response?.output ?? []) {
    if (item?.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (contentItem?.type === "refusal" && typeof contentItem.refusal === "string") {
        throw new Error(`OpenAI fit analysis refused the request: ${contentItem.refusal}`);
      }

      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return null;
}

function buildPostingText(posting: JobPostingFitContext) {
  return normalizeWhitespace(
    [
      posting.title,
      posting.department ?? "",
      posting.location ?? "",
      posting.employmentType ?? "",
      posting.compensationRange ?? "",
      posting.content,
    ].join("\n")
  );
}

function buildCandidateEvidence(resume: RedactedResume) {
  return normalizeWhitespace(
    [
      resume.summary,
      resume.skills.join("\n"),
      resume.certifications.join("\n"),
      ...resume.experience.map((item) =>
        [item.title, item.company, item.description].filter(Boolean).join(" ")
      ),
      ...resume.education.map((item) => item.degree),
    ].join("\n")
  );
}

function collectMatchedSkills(postingText: string, resume: RedactedResume) {
  const normalizedPosting = normalizePhrase(postingText);

  return uniqueList(
    [...resume.skills, ...resume.certifications].filter((item) => {
      const normalizedItem = normalizePhrase(item);
      return normalizedItem && normalizedPosting.includes(normalizedItem);
    })
  ).slice(0, 8);
}

function cleanupRequirementText(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\b(?:required|preferred|preferred qualifications?)\b/gi, "")
      .replace(/[().:]/g, " ")
  );
}

function collectMissingRequirements(postingText: string, candidateEvidence: string) {
  const normalizedCandidate = normalizePhrase(candidateEvidence);
  const patterns = [
    /\b(?:experience with|proficiency in|knowledge of|familiarity with|certified in|licensed in)\s+([^.;\n]+)/gi,
    /\b(?:must have|requires|required|preferred)\s+([^.;\n]+)/gi,
  ];
  const candidates: string[] = [];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(postingText)) !== null) {
      const phrases = cleanupRequirementText(match[1] ?? "")
        .split(/,|\/|\band\b/gi)
        .map((item) => normalizeWhitespace(item))
        .filter((item) => item.split(" ").length <= 4);

      candidates.push(...phrases);
    }
  }

  return uniqueList(
    candidates.filter((item) => {
      const normalizedItem = normalizePhrase(item);
      if (!normalizedItem || stopWords.has(normalizedItem)) {
        return false;
      }

      return !normalizedCandidate.includes(normalizedItem);
    })
  ).slice(0, 6);
}

function collectStandoutSignals(resume: RedactedResume, matchedSkills: string[]) {
  const standout = [
    ...matchedSkills.map((item) => `${item} appears in both the resume and posting`),
    ...resume.certifications.slice(0, 2).map((item) => `${item} certification`),
    ...resume.experience
      .filter((item) => item.title)
      .slice(0, 2)
      .map((item) => `${item.title} experience`),
  ];
  const totalDurationMonths = resume.experience.reduce(
    (sum, item) => sum + (item.duration_months ?? 0),
    0
  );

  if (totalDurationMonths >= 24) {
    standout.push(`${totalDurationMonths} months of documented experience`);
  }

  return uniqueList(standout).slice(0, 4);
}

function deriveExperienceAlignment(resume: RedactedResume, matchedSkills: string[]): ExperienceAlignment {
  const totalDurationMonths = resume.experience.reduce(
    (sum, item) => sum + (item.duration_months ?? 0),
    0
  );

  if (matchedSkills.length >= 4 || totalDurationMonths >= 48 || resume.experience.length >= 4) {
    return "strong";
  }

  if (matchedSkills.length >= 2 || totalDurationMonths >= 18 || resume.experience.length >= 2) {
    return "moderate";
  }

  return "limited";
}

function buildHeuristicFitSnapshot(
  posting: JobPostingFitContext,
  resume: RedactedResume
): CandidateFitSnapshot {
  const postingText = buildPostingText(posting);
  const candidateEvidence = buildCandidateEvidence(resume);
  const matchedSkills = collectMatchedSkills(postingText, resume);
  const missingRequirements = collectMissingRequirements(postingText, candidateEvidence);
  const standoutSignals = collectStandoutSignals(resume, matchedSkills);
  const experienceAlignment = deriveExperienceAlignment(resume, matchedSkills);
  const score = clampScore(
    42 +
      matchedSkills.length * 9 +
      resume.certifications.length * 3 +
      resume.experience.length * 5 -
      missingRequirements.length * 4 +
      (experienceAlignment === "strong" ? 14 : experienceAlignment === "moderate" ? 6 : -6)
  );
  const fitSummary = normalizeWhitespace(
    [
      matchedSkills.length
        ? `The profile aligns with the posting through ${matchedSkills.length} directly matched skill areas.`
        : "The profile shows limited direct skill overlap with the posting text.",
      experienceAlignment === "strong"
        ? "Documented experience is substantial enough for a strong initial screen."
        : experienceAlignment === "moderate"
          ? "Documented experience supports a reasonable shortlist discussion."
          : "Experience evidence is currently limited and may need closer review.",
    ].join(" ")
  );

  return {
    score,
    experience_alignment: experienceAlignment,
    fit_summary: fitSummary,
    matched_skills: matchedSkills,
    missing_requirements: missingRequirements,
    standout_signals: standoutSignals,
  };
}

function sanitizeFitSnapshot(snapshot: LlmFitSnapshot): CandidateFitSnapshot {
  return {
    score: clampScore(snapshot.score),
    experience_alignment: ["strong", "moderate", "limited"].includes(snapshot.experience_alignment)
      ? snapshot.experience_alignment
      : "moderate",
    fit_summary: normalizeWhitespace(snapshot.fit_summary),
    matched_skills: uniqueList(snapshot.matched_skills ?? []).slice(0, 8),
    missing_requirements: uniqueList(snapshot.missing_requirements ?? []).slice(0, 6),
    standout_signals: uniqueList(snapshot.standout_signals ?? []).slice(0, 4),
  };
}

async function analyzeCandidateFitWithLlm(
  posting: JobPostingFitContext,
  resume: RedactedResume
) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiAnalysisModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You assess anonymized candidate fit against a job posting.",
                "Use only the supplied posting and redacted resume content.",
                "Do not infer identity, school prestige, gender, ethnicity, or other protected attributes.",
                "Treat withheld institutions as intentionally unavailable and do not mention them.",
                "Keep the output concise, grounded, and suitable for an HR review sidebar.",
                "Missing requirements should only include explicit requirements that appear unsupported by the resume.",
                "Matched skills should be concrete skill or certification phrases supported by both inputs.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                posting,
                redacted_resume: resume,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "candidate_fit_snapshot",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "score",
              "experience_alignment",
              "fit_summary",
              "matched_skills",
              "missing_requirements",
              "standout_signals",
            ],
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              experience_alignment: {
                type: "string",
                enum: ["strong", "moderate", "limited"],
              },
              fit_summary: { type: "string" },
              matched_skills: {
                type: "array",
                items: { type: "string" },
              },
              missing_requirements: {
                type: "array",
                items: { type: "string" },
              },
              standout_signals: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI fit snapshot request failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);

  if (!outputText) {
    throw new Error("OpenAI fit snapshot returned no structured output.");
  }

  return sanitizeFitSnapshot(JSON.parse(outputText) as LlmFitSnapshot);
}

export async function analyzeCandidateFit(
  posting: JobPostingFitContext,
  resume: RedactedResume
): Promise<CandidateFitSnapshot> {
  const heuristicSnapshot = buildHeuristicFitSnapshot(posting, resume);

  if (!env.openAiApiKey) {
    return heuristicSnapshot;
  }

  try {
    return await analyzeCandidateFitWithLlm(posting, resume);
  } catch (error) {
    console.warn("Falling back to heuristic candidate fit snapshot:", error);
    return heuristicSnapshot;
  }
}

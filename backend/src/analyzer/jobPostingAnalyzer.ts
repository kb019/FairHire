import crypto from "node:crypto";
import type { Issue, IssueSeverity } from "../types/api.js";
import { env } from "../config/env.js";
import { calculateComplianceScore } from "./scoreCalculator.js";

interface DetectionRule {
  type: string;
  severity: IssueSeverity;
  terms: string[];
  explanation: string;
  suggestion: string;
  educational_link: string;
}

interface LlmIssuePayload {
  type: string;
  severity: IssueSeverity;
  flagged_text: string;
  explanation: string;
  suggestion: string;
  educational_link: string;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ALLOWED_SEVERITIES = new Set<IssueSeverity>(["critical", "warning", "suggestion"]);
const EDUCATIONAL_LINKS: Record<string, string> = {
  gendered_language: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
  age_language: "https://www.eeoc.gov/age-discrimination",
  cultural_exclusion: "https://www.eeoc.gov/national-origin-discrimination",
  exclusionary_requirement: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
  missing_eeo: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
  disability_exclusion: "https://www.eeoc.gov/disability-discrimination",
  compensation_opacity: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
  credential_inflation: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
  other_bias: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
};

const DETECTION_RULES: DetectionRule[] = [
  {
    type: "gendered_language",
    severity: "warning",
    terms: ["rockstar", "ninja", "manpower", "dominant", "competitive warrior"],
    explanation: "Gender-coded terms can make the role feel narrower than intended.",
    suggestion: "Use specific, role-based language that focuses on responsibilities and outcomes.",
    educational_link: "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring",
  },
  {
    type: "age_language",
    severity: "warning",
    terms: ["recent graduate", "digital native", "young", "energetic team"],
    explanation: "Age-related phrasing can exclude qualified candidates and introduce bias.",
    suggestion: "Describe needed capabilities instead of implying a target age group.",
    educational_link: "https://www.eeoc.gov/age-discrimination",
  },
  {
    type: "cultural_exclusion",
    severity: "suggestion",
    terms: ["native english speaker", "cultural fit", "american-born"],
    explanation: "Culturally exclusive phrasing can screen out qualified people for non-job reasons.",
    suggestion: "Replace exclusionary wording with objective communication or collaboration requirements.",
    educational_link: "https://www.eeoc.gov/national-origin-discrimination",
  },
];

const TECHNOLOGY_RELEASE_YEARS: Record<string, number> = {
  react: 2013,
  node: 2009,
  typescript: 2012,
  python: 1991,
  go: 2009,
  rust: 2010,
  kubernetes: 2014,
};

function makeIssue(
  type: string,
  severity: IssueSeverity,
  start: number,
  end: number,
  flaggedText: string,
  explanation: string,
  suggestion: string,
  educationalLink: string
): Issue {
  return {
    id: crypto.randomUUID(),
    type,
    severity,
    text_offset_start: start,
    text_offset_end: end,
    flagged_text: flaggedText,
    explanation,
    suggestion,
    educational_link: educationalLink,
    acknowledged: false,
    acknowledgement_note: null,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function findIssueOffsets(text: string, flaggedText: string, fromIndex: number) {
  if (!flaggedText) {
    return { start: 0, end: 0 };
  }

  const loweredText = text.toLowerCase();
  const loweredFlaggedText = flaggedText.toLowerCase();
  const directIndex = loweredText.indexOf(loweredFlaggedText, fromIndex);

  if (directIndex >= 0) {
    return { start: directIndex, end: directIndex + flaggedText.length };
  }

  const flexibleRegex = new RegExp(
    escapeRegex(flaggedText)
      .replace(/\\\s+/g, "\\s+")
      .replace(/\s+/g, "\\s+"),
    "gi"
  );
  let match: RegExpExecArray | null;
  let firstMatch: RegExpExecArray | null = null;

  while ((match = flexibleRegex.exec(text)) !== null) {
    if (!firstMatch) {
      firstMatch = match;
    }

    if (match.index >= fromIndex) {
      return { start: match.index, end: match.index + match[0].length };
    }
  }

  if (firstMatch) {
    return { start: firstMatch.index, end: firstMatch.index + firstMatch[0].length };
  }

  return null;
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
        throw new Error(`OpenAI analysis refused the request: ${contentItem.refusal}`);
      }

      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return null;
}

function normalizeLlmIssues(text: string, issues: LlmIssuePayload[]) {
  const normalizedIssues: Issue[] = [];
  let searchCursor = 0;

  for (const issue of issues) {
    if (!ALLOWED_SEVERITIES.has(issue.severity)) {
      continue;
    }

    const flaggedText = normalizeWhitespace(issue.flagged_text ?? "");
    const offsets = findIssueOffsets(text, flaggedText, searchCursor);

    if (flaggedText && !offsets) {
      continue;
    }

    normalizedIssues.push(
      makeIssue(
        issue.type || "other_bias",
        issue.severity,
        offsets?.start ?? 0,
        offsets?.end ?? 0,
        flaggedText,
        normalizeWhitespace(issue.explanation) || "This phrasing may introduce bias into the hiring workflow.",
        normalizeWhitespace(issue.suggestion) || "Rewrite the requirement in job-relevant, inclusive language.",
        issue.educational_link || EDUCATIONAL_LINKS[issue.type] || EDUCATIONAL_LINKS.other_bias
      )
    );

    if (offsets) {
      searchCursor = offsets.end;
    }
  }

  return normalizedIssues;
}

function mergeIssues(primary: Issue[], secondary: Issue[]) {
  const merged = new Map<string, Issue>();

  for (const issue of [...primary, ...secondary]) {
    const key = [
      issue.type,
      issue.severity,
      issue.flagged_text.toLowerCase(),
      issue.text_offset_start,
      issue.text_offset_end,
    ].join("|");

    if (!merged.has(key)) {
      merged.set(key, issue);
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (a.text_offset_start === b.text_offset_start) {
      return a.text_offset_end - b.text_offset_end;
    }

    return a.text_offset_start - b.text_offset_start;
  });
}

function detectRuleMatches(text: string, rule: DetectionRule): Issue[] {
  const issues: Issue[] = [];

  for (const term of rule.terms) {
    const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "gi");
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      issues.push(
        makeIssue(
          rule.type,
          rule.severity,
          match.index,
          match.index + match[0].length,
          match[0],
          rule.explanation,
          rule.suggestion,
          rule.educational_link
        )
      );
    }
  }

  return issues;
}

function detectExclusionaryRequirements(text: string): Issue[] {
  const issues: Issue[] = [];
  const regex = /(\d+)\+?\s+years?\s+of\s+experience\s+(?:with|in)\s+([A-Za-z0-9.+#-]+)/gi;
  const currentYear = new Date().getFullYear();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const yearsRequested = Number(match[1]);
    const technology = match[2].toLowerCase();
    const releaseYear = TECHNOLOGY_RELEASE_YEARS[technology];

    if (!releaseYear) {
      continue;
    }

    const technologyAge = currentYear - releaseYear;

    if (yearsRequested > technologyAge) {
      issues.push(
        makeIssue(
          "exclusionary_requirement",
          "critical",
          match.index,
          match.index + match[0].length,
          match[0],
          `${match[0]} exceeds the likely age of ${match[2]}, which can signal unrealistic screening criteria.`,
          "Lower the experience threshold or describe the expected competency level instead.",
          "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring"
        )
      );
    }
  }

  return issues;
}

function detectMissingEeoStatement(text: string): Issue[] {
  const lower = text.toLowerCase();
  const hasEeoLanguage =
    lower.includes("equal opportunity") ||
    lower.includes("equal employment opportunity") ||
    lower.includes("we welcome applicants");

  if (hasEeoLanguage) {
    return [];
  }

  return [
    makeIssue(
      "missing_eeo",
      "suggestion",
      0,
      0,
      "",
      "The posting does not include inclusive hiring language or an EEO statement.",
      "Add a short equal opportunity statement to signal inclusive hiring expectations.",
      "https://www.eeoc.gov/employers/small-business/recruitment-and-hiring"
    ),
  ];
}

function analyzeJobPostingHeuristics(text: string) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return [] as Issue[];
  }

  return [
    ...DETECTION_RULES.flatMap((rule) => detectRuleMatches(trimmedText, rule)),
    ...detectExclusionaryRequirements(trimmedText),
    ...detectMissingEeoStatement(trimmedText),
  ];
}

async function analyzeJobPostingWithLlm(text: string) {
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
                "You review job postings for hiring bias and exclusion risks.",
                "Return only issues that are grounded in the provided text.",
                "Keep issues in reading order.",
                "Use an empty flagged_text only when the issue is a missing inclusive element such as a missing EEO statement.",
                "When flagged_text is non-empty, it must be an exact substring from the posting.",
                "Prefer these issue types when applicable: gendered_language, age_language, cultural_exclusion, exclusionary_requirement, missing_eeo, disability_exclusion, compensation_opacity, credential_inflation, other_bias.",
                "Severity should be critical, warning, or suggestion.",
                "Educational links should be stable public resources, preferably EEOC guidance when relevant.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "job_posting_bias_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["issues"],
            properties: {
              issues: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "type",
                    "severity",
                    "flagged_text",
                    "explanation",
                    "suggestion",
                    "educational_link",
                  ],
                  properties: {
                    type: { type: "string" },
                    severity: {
                      type: "string",
                      enum: ["critical", "warning", "suggestion"],
                    },
                    flagged_text: { type: "string" },
                    explanation: { type: "string" },
                    suggestion: { type: "string" },
                    educational_link: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI analysis request failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);

  if (!outputText) {
    throw new Error("OpenAI analysis returned no structured output.");
  }

  const parsed = JSON.parse(outputText) as { issues?: LlmIssuePayload[] };
  return normalizeLlmIssues(text, parsed.issues ?? []);
}

export async function analyzeJobPosting(text: string) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return {
      issues: [] as Issue[],
      score: 100,
    };
  }

  const heuristicIssues = analyzeJobPostingHeuristics(trimmedText);

  if (!env.openAiApiKey) {
    return {
      issues: heuristicIssues,
      score: calculateComplianceScore(heuristicIssues),
    };
  }

  try {
    const llmIssues = await analyzeJobPostingWithLlm(trimmedText);
    const issues = mergeIssues(heuristicIssues, llmIssues);

    return {
      issues,
      score: calculateComplianceScore(issues),
    };
  } catch (error) {
    console.warn("Falling back to heuristic analysis:", error);
    return {
      issues: heuristicIssues,
      score: calculateComplianceScore(heuristicIssues),
    };
  }
}

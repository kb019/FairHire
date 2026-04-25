import mammoth from "mammoth";
import pdf from "pdf-parse";
import { env } from "../config/env.js";
import type { ParsedResume, ResumeEducationItem, ResumeExperienceItem } from "../types/api.js";
import { canonicalResumeSectionOrder, resumeSectionAliases } from "../utils/resumeSections.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

interface LlmParsedResume {
  contact: string[];
  summary: string;
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  skills: string[];
  certifications: string[];
}

function normalizeWhitespace(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/\u00a0/g, " ").trim();
}

function splitListItems(block: string) {
  return block
    .split(/\n|•|·|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findSectionName(line: string) {
  const normalized = line.trim().toLowerCase().replace(/[:\-]+$/, "");

  for (const [section, aliases] of Object.entries(resumeSectionAliases)) {
    if (aliases.includes(normalized)) {
      return section;
    }
  }

  return null;
}

function sectionMapFromText(text: string) {
  const sections = new Map<string, string[]>();
  let currentSection = "contact";

  sections.set(currentSection, []);

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const matchedSection = findSectionName(line);

    if (matchedSection) {
      currentSection = matchedSection;
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    sections.get(currentSection)?.push(line);
  }

  return sections;
}

function parseExperience(lines: string[]): ResumeExperienceItem[] {
  const items: ResumeExperienceItem[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+\|\s+| - /).map((part) => part.trim()).filter(Boolean);

    if (!parts.length) {
      continue;
    }

    const title = parts[0] ?? "Experience";
    const company = parts[1] ?? "";
    const durationMatch = line.match(/(\d+)\s+(months?|years?)/i);
    const durationMonths = durationMatch
      ? Number(durationMatch[1]) * (durationMatch[2].toLowerCase().startsWith("year") ? 12 : 1)
      : null;

    items.push({
      title,
      company,
      duration_months: durationMonths,
      description: parts.slice(2).join(" - ") || line,
    });
  }

  return items;
}

function parseEducation(lines: string[]): ResumeEducationItem[] {
  return lines
    .map((line) => {
      const parts = line.split(/\s+\|\s+| - /).map((part) => part.trim()).filter(Boolean);
      const graduationYearMatch = line.match(/\b(19|20)\d{2}\b/);

      return {
        degree: parts[0] ?? line,
        institution: parts[1] ?? "",
        graduation_year: graduationYearMatch?.[0] ?? null,
      };
    })
    .filter((item) => Boolean(item.degree));
}

function sanitizeLines(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeWhitespace(String(value ?? "")))
        .filter(Boolean)
    )
  );
}

function sanitizeResumeExperience(items: ResumeExperienceItem[]) {
  return items
    .map((item) => ({
      title: normalizeWhitespace(String(item?.title ?? "")),
      company: normalizeWhitespace(String(item?.company ?? "")),
      duration_months:
        typeof item?.duration_months === "number" && Number.isFinite(item.duration_months)
          ? item.duration_months
          : null,
      description: normalizeWhitespace(String(item?.description ?? "")),
    }))
    .filter((item) => item.title || item.company || item.description);
}

function sanitizeResumeEducation(items: ResumeEducationItem[]) {
  return items
    .map((item) => ({
      degree: normalizeWhitespace(String(item?.degree ?? "")),
      institution: normalizeWhitespace(String(item?.institution ?? "")),
      graduation_year: item?.graduation_year ? normalizeWhitespace(String(item.graduation_year)) : null,
    }))
    .filter((item) => item.degree || item.institution);
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
        throw new Error(`OpenAI resume parsing refused the request: ${contentItem.refusal}`);
      }

      if (contentItem?.type === "output_text" && typeof contentItem.text === "string") {
        return contentItem.text;
      }
    }
  }

  return null;
}

function toParsedResume(rawText: string, parsed: LlmParsedResume): ParsedResume {
  const normalized = normalizeWhitespace(rawText);
  const result: ParsedResume = {
    contact: sanitizeLines(parsed.contact ?? []),
    summary: normalizeWhitespace(parsed.summary ?? ""),
    experience: sanitizeResumeExperience(parsed.experience ?? []),
    education: sanitizeResumeEducation(parsed.education ?? []),
    skills: sanitizeLines(parsed.skills ?? []),
    certifications: sanitizeLines(parsed.certifications ?? []),
    undetected_sections: [],
    raw_text: normalized,
  };

  result.undetected_sections = canonicalResumeSectionOrder.filter((section) => {
    if (section === "contact") {
      return result.contact.length === 0;
    }

    if (section === "summary") {
      return !result.summary;
    }

    if (section === "experience") {
      return result.experience.length === 0;
    }

    if (section === "education") {
      return result.education.length === 0;
    }

    if (section === "skills") {
      return result.skills.length === 0;
    }

    if (section === "certifications") {
      return result.certifications.length === 0;
    }

    return false;
  });

  return result;
}

export async function extractResumeText(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") {
    const result = await pdf(buffer);
    return normalizeWhitespace(result.text);
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result.value);
  }

  throw new Error("Unsupported resume format.");
}

export function parseResumeText(text: string): ParsedResume {
  const normalized = normalizeWhitespace(text);
  const sections = sectionMapFromText(normalized);
  const undetectedSections = canonicalResumeSectionOrder.filter((section) => !sections.has(section));

  const contact = sections.get("contact") ?? [];
  const summary = (sections.get("summary") ?? []).join(" ");
  const experience = parseExperience(sections.get("experience") ?? []);
  const education = parseEducation(sections.get("education") ?? []);
  const skills = splitListItems((sections.get("skills") ?? []).join("\n"));
  const certifications = splitListItems((sections.get("certifications") ?? []).join("\n"));

  return {
    contact,
    summary,
    experience,
    education,
    skills,
    certifications,
    undetected_sections: undetectedSections,
    raw_text: normalized,
  };
}

async function parseResumeTextWithLlm(text: string) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.openAiResumeParserModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You parse resume text into structured sections for a hiring workflow.",
                "Return only information grounded in the resume text.",
                "Keep wording close to the source material.",
                "Extract contact lines, summary, experience, education, skills, and certifications.",
                "For experience, create one object per role or major entry.",
                "For education, include degree, institution, and graduation_year when present.",
                "Use duration_months only when it is reasonably inferable from the text; otherwise return null.",
                "If a section is absent, return an empty string or empty array for that section.",
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
          name: "parsed_resume",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["contact", "summary", "experience", "education", "skills", "certifications"],
            properties: {
              contact: {
                type: "array",
                items: { type: "string" },
              },
              summary: { type: "string" },
              experience: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["title", "company", "duration_months", "description"],
                  properties: {
                    title: { type: "string" },
                    company: { type: "string" },
                    duration_months: {
                      anyOf: [{ type: "integer" }, { type: "null" }],
                    },
                    description: { type: "string" },
                  },
                },
              },
              education: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["degree", "institution", "graduation_year"],
                  properties: {
                    degree: { type: "string" },
                    institution: { type: "string" },
                    graduation_year: {
                      anyOf: [{ type: "string" }, { type: "null" }],
                    },
                  },
                },
              },
              skills: {
                type: "array",
                items: { type: "string" },
              },
              certifications: {
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
    throw new Error(`OpenAI resume parsing request failed with ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);

  if (!outputText) {
    throw new Error("OpenAI resume parser returned no structured output.");
  }

  return JSON.parse(outputText) as LlmParsedResume;
}

export async function parseResumeBuffer(buffer: Buffer, mimeType: string) {
  const text = await extractResumeText(buffer, mimeType);

  if (!env.openAiApiKey) {
    return parseResumeText(text);
  }

  try {
    const parsed = await parseResumeTextWithLlm(text);
    return toParsedResume(text, parsed);
  } catch (error) {
    console.warn("Falling back to heuristic resume parsing:", error);
    return parseResumeText(text);
  }
}

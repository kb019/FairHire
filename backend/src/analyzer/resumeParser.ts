import mammoth from "mammoth";
import pdf from "pdf-parse";
import type { ParsedResume, ResumeEducationItem, ResumeExperienceItem } from "../types/api.js";
import { canonicalResumeSectionOrder, resumeSectionAliases } from "../utils/resumeSections.js";

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

export async function parseResumeBuffer(buffer: Buffer, mimeType: string) {
  const text = await extractResumeText(buffer, mimeType);
  return parseResumeText(text);
}


import nlp from "compromise";
import type { ParsedResume, RedactedResume, ResumeEducationItem, ResumeExperienceItem } from "../types/api.js";

interface ContactDetails {
  email: string | null;
  phone: string | null;
}

const genderPatterns = [
  /\b(he|she|him|her|his|hers|mr\.?|mrs\.?|ms\.?)\b/gi,
  /\b(male|female|non-binary|nonbinary|gender)\b/gi,
];
const maritalPatterns = [/\b(single|married|divorced|widowed|marital status)\b/gi];
const nationalityPatterns = [/\b(citizen(ship)?|nationality|visa status|american-born)\b/gi];
const religionPatterns = [/\b(christian|muslim|jewish|hindu|buddhist|religion)\b/gi];
const agePatterns = [
  /\b(age|aged)\s*\d{1,2}\b/gi,
  /\bdate of birth\b.*$/gim,
  /\b(?:19|20)\d{2}\b/g,
];
const addressPatterns = [
  /\b\d{1,5}\s+[A-Za-z0-9.\s]+(?:street|st|road|rd|avenue|ave|lane|ln|boulevard|blvd|drive|dr)\b/gi,
];
const phonePattern = /(?:\+?\d{1,2}\s*)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function removePatterns(text: string, patterns: RegExp[]) {
  return patterns.reduce((current, pattern) => current.replace(pattern, "").replace(/\s{2,}/g, " ").trim(), text);
}

function stripLocationEntities(text: string) {
  const doc = nlp(text);
  const places = doc.places().out("array") as string[];
  let cleaned = text;

  for (const place of places) {
    if (place.length > 2) {
      cleaned = cleaned.replace(new RegExp(place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "");
    }
  }

  return cleaned.replace(/\s{2,}/g, " ").trim();
}

function sanitizeText(text: string, anonymousId: string, personNames: string[]) {
  let cleaned = text;

  for (const name of personNames) {
    if (name.length > 2) {
      cleaned = cleaned.replace(
        new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        anonymousId
      );
    }
  }

  cleaned = cleaned.replace(emailPattern, "").replace(phonePattern, "");
  cleaned = removePatterns(cleaned, genderPatterns);
  cleaned = removePatterns(cleaned, maritalPatterns);
  cleaned = removePatterns(cleaned, nationalityPatterns);
  cleaned = removePatterns(cleaned, religionPatterns);
  cleaned = removePatterns(cleaned, agePatterns);
  cleaned = removePatterns(cleaned, addressPatterns);
  cleaned = stripLocationEntities(cleaned);

  return cleaned.replace(/\s{2,}/g, " ").trim();
}

function deriveNameCandidates(parsedResume: ParsedResume) {
  const topLine = parsedResume.contact[0] ?? parsedResume.raw_text.split("\n")[0] ?? "";
  const people = nlp(parsedResume.raw_text).people().out("array") as string[];
  const candidates = [topLine, ...people].map((item) => item.trim()).filter(Boolean);

  return Array.from(new Set(candidates));
}

function extractContactDetails(parsedResume: ParsedResume): ContactDetails {
  const contactBlock = parsedResume.contact.join(" ");
  return {
    email: contactBlock.match(emailPattern)?.[0] ?? parsedResume.raw_text.match(emailPattern)?.[0] ?? null,
    phone: contactBlock.match(phonePattern)?.[0] ?? parsedResume.raw_text.match(phonePattern)?.[0] ?? null,
  };
}

function sanitizeExperienceItems(
  items: ResumeExperienceItem[],
  anonymousId: string,
  personNames: string[]
) {
  return items.map((item) => ({
    ...item,
    description: sanitizeText(item.description, anonymousId, personNames),
    company: sanitizeText(item.company, anonymousId, personNames),
    title: sanitizeText(item.title, anonymousId, personNames),
  }));
}

function sanitizeEducationItems(
  items: ResumeEducationItem[],
  anonymousId: string,
  personNames: string[]
): Array<Omit<ResumeEducationItem, "graduation_year">> {
  return items.map((item) => ({
    degree: sanitizeText(item.degree, anonymousId, personNames),
    institution: sanitizeText(item.institution, anonymousId, personNames),
  }));
}

export function redactParsedResume(parsedResume: ParsedResume, anonymousId: string) {
  const personNames = deriveNameCandidates(parsedResume);
  const contact = extractContactDetails(parsedResume);

  const redactedResume: RedactedResume = {
    summary: sanitizeText(parsedResume.summary, anonymousId, personNames),
    skills: parsedResume.skills
      .map((skill) => sanitizeText(skill, anonymousId, personNames))
      .filter(Boolean),
    experience: sanitizeExperienceItems(parsedResume.experience, anonymousId, personNames),
    education: sanitizeEducationItems(parsedResume.education, anonymousId, personNames),
    certifications: parsedResume.certifications
      .map((item) => sanitizeText(item, anonymousId, personNames))
      .filter(Boolean),
  };

  return {
    redactedResume,
    contact,
  };
}


import type { ParsedResume } from "../types/api.js";
import { canonicalResumeSectionOrder } from "../utils/resumeSections.js";

export function printResume(parsedResume: ParsedResume) {
  const lines: string[] = [];

  for (const section of canonicalResumeSectionOrder) {
    lines.push(section.toUpperCase());

    switch (section) {
      case "contact":
        lines.push(...parsedResume.contact);
        break;
      case "summary":
        if (parsedResume.summary) {
          lines.push(parsedResume.summary);
        }
        break;
      case "experience":
        lines.push(
          ...parsedResume.experience.map((item) =>
            [item.title, item.company, item.description].filter(Boolean).join(" | ")
          )
        );
        break;
      case "education":
        lines.push(
          ...parsedResume.education.map((item) =>
            [item.degree, item.institution, item.graduation_year].filter(Boolean).join(" | ")
          )
        );
        break;
      case "skills":
        lines.push(parsedResume.skills.join(", "));
        break;
      case "certifications":
        lines.push(parsedResume.certifications.join(", "));
        break;
      default:
        break;
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}


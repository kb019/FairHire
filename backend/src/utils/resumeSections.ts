export const resumeSectionAliases: Record<string, string[]> = {
  contact: ["contact", "contact information", "personal information"],
  summary: ["summary", "profile", "professional summary", "about"],
  experience: ["experience", "work experience", "employment", "professional experience"],
  education: ["education", "academic background", "academics"],
  skills: ["skills", "technical skills", "core skills", "skills & tools"],
  certifications: ["certifications", "licenses", "certificates"],
};

export const canonicalResumeSectionOrder = [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "certifications",
] as const;


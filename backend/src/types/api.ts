export type IssueSeverity = "critical" | "warning" | "suggestion";

export interface Issue {
  id: string;
  type: string;
  severity: IssueSeverity;
  text_offset_start: number;
  text_offset_end: number;
  flagged_text: string;
  explanation: string;
  suggestion: string;
  educational_link: string;
  acknowledged: boolean;
  acknowledgement_note: string | null;
}

export interface ResumeExperienceItem {
  title: string;
  company: string;
  duration_months: number | null;
  description: string;
}

export interface ResumeEducationItem {
  degree: string;
  institution: string;
  graduation_year?: string | null;
}

export interface ParsedResume {
  contact: string[];
  summary: string;
  experience: ResumeExperienceItem[];
  education: ResumeEducationItem[];
  skills: string[];
  certifications: string[];
  undetected_sections: string[];
  raw_text: string;
}

export interface RedactedResume {
  summary: string;
  skills: string[];
  experience: ResumeExperienceItem[];
  education: Array<Omit<ResumeEducationItem, "graduation_year">>;
  certifications: string[];
}

export const jobPostingCategories = [
  { value: "general_business", label: "General Business" },
  { value: "software_it", label: "Software & IT" },
  { value: "fire_emergency_services", label: "Fire & Emergency Services" },
  { value: "plumbing", label: "Plumbing" },
  { value: "automotive_mechanical", label: "Automotive & Mechanical" },
  { value: "construction_trades", label: "Construction & Trades" },
  { value: "electrical", label: "Electrical" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "logistics_transport", label: "Logistics & Transport" },
  { value: "hospitality_food", label: "Hospitality & Food Service" },
  { value: "government_public_works", label: "Government & Public Works" },
] as const;

export function getJobPostingCategoryLabel(category: string | null | undefined) {
  return jobPostingCategories.find((option) => option.value === category)?.label ?? "General Business";
}

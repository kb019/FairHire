import type { Issue } from "../types/api.js";

export function calculateComplianceScore(issues: Issue[]) {
  const totals = issues.reduce(
    (accumulator, issue) => {
      if (issue.acknowledged) {
        return accumulator;
      }

      accumulator[issue.severity] += 1;
      return accumulator;
    },
    {
      critical: 0,
      warning: 0,
      suggestion: 0,
    }
  );

  return Math.max(0, 100 - totals.critical * 15 - totals.warning * 5 - totals.suggestion);
}


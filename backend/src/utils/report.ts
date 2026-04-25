import PDFDocument from "pdfkit";
import type { Issue } from "../types/api.js";

function scoreColor(score: number) {
  if (score >= 80) {
    return "#59c48d";
  }

  if (score >= 50) {
    return "#f0bf63";
  }

  return "#ef8a8a";
}

export function buildEthicsReportPdf(title: string, score: number, issues: Issue[]) {
  const document = new PDFDocument({ margin: 50 });
  const buffers: Buffer[] = [];

  document.on("data", (chunk) => buffers.push(chunk as Buffer));

  document.fontSize(24).text("Ethics Report");
  document.moveDown(0.5);
  document.fontSize(16).text(title);
  document.moveDown();
  document.fillColor(scoreColor(score)).fontSize(20).text(`Compliance Score: ${score}`);
  document.fillColor("#000000");
  document.moveDown();

  if (!issues.length) {
    document.fontSize(12).text("No issues detected in the latest analysis.");
  } else {
    for (const issue of issues) {
      document
        .fontSize(13)
        .text(`${issue.severity.toUpperCase()}: ${issue.type.replace(/_/g, " ")}`);
      document.fontSize(11).text(`Flagged text: ${issue.flagged_text || "N/A"}`);
      document.text(`Explanation: ${issue.explanation}`);
      document.text(`Suggestion: ${issue.suggestion}`);

      if (issue.acknowledged && issue.acknowledgement_note) {
        document.text(`Acknowledged with note: ${issue.acknowledgement_note}`);
      }

      document.moveDown();
    }
  }

  document.end();

  return new Promise<Buffer>((resolve) => {
    document.on("end", () => resolve(Buffer.concat(buffers)));
  });
}

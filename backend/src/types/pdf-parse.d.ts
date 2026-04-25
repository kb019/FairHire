declare module "pdf-parse" {
  interface PdfParseResult {
    text: string;
  }

  export default function pdf(dataBuffer: Buffer): Promise<PdfParseResult>;
}


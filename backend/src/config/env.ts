import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(currentDirectory, "../../../.env");

dotenv.config({ path: rootEnvPath });
dotenv.config();

function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? "4000"),
  databaseUrl: requireEnv(
    "DATABASE_URL",
    "postgresql://ethics_app:ethics_app_password@127.0.0.1:5433/ethics_hiring_tracker"
  ),
  contactDisclosureDatabaseUrl: requireEnv(
    "CONTACT_DISCLOSURE_DATABASE_URL",
    "postgresql://ethics_contact_disclosure:ethics_contact_password@127.0.0.1:5433/ethics_hiring_tracker"
  ),
  jwtSecret: requireEnv("JWT_SECRET", "development-only-secret-change-me"),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiAnalysisModel: process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-5.4-mini",
};

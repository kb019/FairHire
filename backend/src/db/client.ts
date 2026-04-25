import { Pool, type QueryResult, type QueryResultRow } from "pg";
import { env } from "../config/env.js";

export const appPool = new Pool({
  connectionString: env.databaseUrl,
});

export const contactDisclosurePool = new Pool({
  connectionString: env.contactDisclosureDatabaseUrl,
});

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return appPool.query<T>(text, params);
}


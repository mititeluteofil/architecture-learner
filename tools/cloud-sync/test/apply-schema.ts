import { env } from "cloudflare:test";
import schema from "../schema.sql?raw";

// Applies schema.sql to the test D1. Statements are idempotent (IF NOT EXISTS).
const statements = schema
  .split(/\r?\n/)
  .map((line: string) => line.replace(/--.*$/, ""))
  .filter((line: string) => !line.trim().startsWith("PRAGMA"))
  .join("\n")
  .split(";")
  .map((s: string) => s.trim())
  .filter(Boolean);

await env.DB.batch(statements.map((s: string) => env.DB.prepare(s)));

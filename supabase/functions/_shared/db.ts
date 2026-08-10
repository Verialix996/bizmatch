import postgres from "npm:postgres@3";

// Supavisor transaction-mode pooler connection string — required because Edge
// Functions are short-lived/high-concurrency (session-mode pooling would
// exhaust connections). `max: 5` keeps each isolate's own pool small; Supavisor
// handles the real pooling across all concurrent isolates.
const sql = postgres(Deno.env.get("DATABASE_URL")!, {
  ssl: "require",
  max: 5,
});

// Mirrors backend/src/config/db.js's query(sql, params) signature exactly —
// call sites port with require->import + .js->.ts changes only, no query rewrite.
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const sanitized = params.map((p) => (p === undefined ? null : p));
  const rows = await sql.unsafe(text, sanitized as never[]);
  return rows as unknown as T[];
}

export { sql };

// sql.unsafe() runs the simple query protocol, which — unlike this driver's
// tagged-template queries — does NOT auto-decode json/jsonb columns into JS
// values; they come back as raw JSON text. Every call site that reads a
// jsonb column through query() must run it through this first. Passes
// already-decoded values through unchanged so it's safe to call defensively.
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

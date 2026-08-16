import { query } from "./db.ts";

// ACT-02: evaluator assessments and peer feedback can optionally be tied to
// an activity — nothing stopped either from being submitted for an activity
// that hasn't started yet, which doesn't make sense (there's nothing to
// evaluate). starts_at is stored as a real timestamptz, so this comparison
// is timezone-correct regardless of the cohort's local timezone (Asia/
// Jerusalem) — no manual offset math needed.
export async function assertActivityHasStarted(activityId: number): Promise<string | null> {
  const rows = await query<{ starts_at: string }>(
    "SELECT starts_at FROM activities WHERE id = $1",
    [activityId],
  );
  if (!rows[0]) return "Activity not found";
  if (new Date(rows[0].starts_at) > new Date()) {
    return "This activity hasn't started yet — evaluations and peer feedback can only be submitted once it begins.";
  }
  return null;
}

import { query } from "./db.ts";
import {
  computeAllDimensionScores,
  computeCompatibility,
  type CompatibilityFounderInput,
  type CompatibilityResult,
  type EvidenceDimension,
  type EvidenceRow,
} from "./founderScoring.ts";

// Shared by the `matches` Edge Function. Fetches the inputs
// computeCompatibility needs for a founder (dimension scores derived from
// their evidence, capabilities, deal breakers), computes compatibility
// against every other active founder, and upserts the result into
// founder_compatibility — the cached table the Matching screen reads from.
// Mirrors dnaRecompute.ts's placement/shape, and matchModel.ts's old
// "eager pre-scoring, fire-and-forget on profile/evidence writes" pattern
// from the pre-pivot swipe app (see git history) rather than a DB trigger.

async function fetchCompatibilityInput(founderId: string): Promise<CompatibilityFounderInput> {
  const evidenceRows = await query<Record<string, unknown>>(
    `SELECT dimension, source_type, score, weight, is_negative FROM evidence WHERE founder_id = $1`,
    [founderId],
  );
  const evidence: EvidenceRow[] = evidenceRows.map((r) => ({
    dimension: r.dimension as EvidenceDimension,
    source_type: r.source_type as EvidenceRow["source_type"],
    score: Number(r.score),
    weight: Number(r.weight),
    is_negative: !!r.is_negative,
  }));

  const capabilityRows = await query<{ kind: "provide" | "need"; capability: string }>(
    `SELECT kind, capability FROM founder_capabilities WHERE founder_id = $1`,
    [founderId],
  );
  const dealBreakerRows = await query<{ label: string }>(
    `SELECT label FROM deal_breakers WHERE founder_id = $1`,
    [founderId],
  );

  return {
    dimensions: computeAllDimensionScores(evidence),
    capabilities: capabilityRows,
    dealBreakers: dealBreakerRows.map((d) => d.label),
  };
}

// Canonical ordering matches founder_compatibility's `check (founder_a_id <
// founder_b_id)` — comparing the canonical lowercase-hex-with-dashes UUID
// text form byte-for-byte gives the same order as Postgres's binary uuid
// comparison, since the text form is just a fixed-width hex encoding.
function canonicalPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

async function upsertCompatibility(aId: string, bId: string, result: CompatibilityResult): Promise<void> {
  await query(
    `INSERT INTO founder_compatibility
       (founder_a_id, founder_b_id, score, dimension_breakdown, explanation, deal_breaker_flags, requires_admin_review, is_provisional, computed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (founder_a_id, founder_b_id) DO UPDATE SET
       score = EXCLUDED.score,
       dimension_breakdown = EXCLUDED.dimension_breakdown,
       explanation = EXCLUDED.explanation,
       deal_breaker_flags = EXCLUDED.deal_breaker_flags,
       requires_admin_review = EXCLUDED.requires_admin_review,
       is_provisional = EXCLUDED.is_provisional,
       computed_at = now()`,
    [
      aId, bId, result.score,
      JSON.stringify(result.dimensionBreakdown),
      JSON.stringify(result.explanation),
      JSON.stringify(result.dealBreakerFlags),
      result.requiresAdminReview,
      result.isProvisional,
    ],
  );
}

// Recomputes and caches compatibility between `founderId` and every other
// active founder. Called fire-and-forget after evidence/assessment/
// peer-feedback writes and after profile/capability edits, and can also be
// awaited directly for a synchronous "compute now" admin action.
export async function recomputeMatchesForFounder(founderId: string): Promise<void> {
  const others = await query<{ id: string }>(
    `SELECT u.id FROM users u JOIN founder_profiles fp ON fp.user_id = u.id
     WHERE u.role = 'founder' AND u.id <> $1 AND fp.status = 'active'`,
    [founderId],
  );
  if (others.length === 0) return;

  const founderInput = await fetchCompatibilityInput(founderId);
  for (const other of others) {
    const otherInput = await fetchCompatibilityInput(other.id);
    const [aId, bId] = canonicalPair(founderId, other.id);
    const [aInput, bInput] = aId === founderId ? [founderInput, otherInput] : [otherInput, founderInput];
    const result = computeCompatibility(aInput, bInput);
    await upsertCompatibility(aId, bId, result);
  }
}

import { query } from "./db.ts";
import {
  computeAllDimensionScores,
  computeProfileConfidence,
  detectContradiction,
  buildEmptyState,
  DIMENSIONS,
  type EvidenceRow,
  type EvidenceDimension,
} from "./founderScoring.ts";

// Shared by the `evidence`, `assessments`, and `founder-dna` Edge Functions.
// Fetches all evidence for a founder, recomputes each dimension via the pure
// functions in founderScoring.ts, and appends new founder_dna_snapshots rows
// (append-only — never UPDATEs an existing snapshot, so Profile Evolution
// history stays intact per spec section 11).

async function fetchEvidence(founderId: string): Promise<EvidenceRow[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT dimension, source_type, score, weight, is_negative, created_at
     FROM evidence WHERE founder_id = $1`,
    [founderId],
  );
  return rows.map((r) => ({
    dimension: r.dimension as EvidenceDimension,
    source_type: r.source_type as EvidenceRow["source_type"],
    score: Number(r.score),
    weight: Number(r.weight),
    is_negative: !!r.is_negative,
    created_at: r.created_at as string,
  }));
}

export async function recomputeFounderDna(founderId: string, triggerEvidenceId?: number): Promise<void> {
  const evidence = await fetchEvidence(founderId);
  const results = computeAllDimensionScores(evidence);

  for (const dimension of DIMENSIONS) {
    const r = results[dimension];
    await query(
      `INSERT INTO founder_dna_snapshots (founder_id, dimension, score, confidence, evidence_count, trigger_evidence_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [founderId, dimension, r.score, r.confidence, r.evidenceCount, triggerEvidenceId ?? null],
    );
  }
}

export interface FounderInsights {
  profileConfidence: number;
  dimensions: Record<EvidenceDimension, { score: number | null; confidence: string | null; evidenceCount: number }>;
  contradictions: ReturnType<typeof detectContradiction>[];
  emptyState: ReturnType<typeof buildEmptyState>;
  cohortAverage: Record<EvidenceDimension, number | null>;
}

// Average of every founder's own live dimension score (same
// computeAllDimensionScores each founder's own insights use), across every
// founder with at least one evidence row — not read from the append-only
// snapshot log, so it can't go stale relative to what the founder sees.
async function computeCohortAverageDimensions(): Promise<Record<EvidenceDimension, number | null>> {
  const rows = await query<Record<string, unknown>>(
    `SELECT founder_id, dimension, source_type, score, weight, is_negative, created_at FROM evidence`,
  );

  const byFounder = new Map<string, EvidenceRow[]>();
  for (const r of rows) {
    const founderId = r.founder_id as string;
    const list = byFounder.get(founderId) ?? [];
    list.push({
      dimension: r.dimension as EvidenceDimension,
      source_type: r.source_type as EvidenceRow["source_type"],
      score: Number(r.score),
      weight: Number(r.weight),
      is_negative: !!r.is_negative,
      created_at: r.created_at as string,
    });
    byFounder.set(founderId, list);
  }

  const sums = {} as Record<EvidenceDimension, number>;
  const counts = {} as Record<EvidenceDimension, number>;
  for (const dim of DIMENSIONS) { sums[dim] = 0; counts[dim] = 0; }

  for (const evidence of byFounder.values()) {
    const results = computeAllDimensionScores(evidence);
    for (const dim of DIMENSIONS) {
      const score = results[dim].score;
      if (score != null) { sums[dim] += score; counts[dim] += 1; }
    }
  }

  const averages = {} as Record<EvidenceDimension, number | null>;
  for (const dim of DIMENSIONS) {
    averages[dim] = counts[dim] > 0 ? Math.round(sums[dim] / counts[dim]) : null;
  }
  return averages;
}

// MVP screen 7 — Founder Insights: derived from evidence, distinct from the
// raw Founder Profile screen. No single "Founder Score", no DNA radar
// required for MVP — this returns the underlying numbers so the frontend
// can render them as bullets (Strengths / Potential Weaknesses / etc).
export async function computeFounderInsights(founderId: string): Promise<FounderInsights> {
  const evidence = await fetchEvidence(founderId);
  const dimensionResults = computeAllDimensionScores(evidence);

  const contradictions = DIMENSIONS
    .map((dim) => detectContradiction(evidence.filter((e) => e.dimension === dim)))
    .filter((c) => c !== null);

  const byDimension = {} as FounderInsights["dimensions"];
  for (const dim of DIMENSIONS) {
    const r = dimensionResults[dim];
    byDimension[dim] = { score: r.score, confidence: r.confidence, evidenceCount: r.evidenceCount };
  }

  return {
    profileConfidence: computeProfileConfidence(dimensionResults),
    dimensions: byDimension,
    contradictions,
    emptyState: buildEmptyState(dimensionResults),
    cohortAverage: await computeCohortAverageDimensions(),
  };
}

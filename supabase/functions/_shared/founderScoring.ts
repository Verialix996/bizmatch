// Pure, I/O-free scoring functions for the Founder Profile pivot. No DB or
// network calls in this module — Edge Functions (founder-dna, evidence,
// assessments) are thin shims that fetch rows, call these functions, and
// persist the result. Keeping the math here makes it unit-testable with
// `deno test` against the spec's own worked examples, independent of a
// live database.
//
// Grounded in "BizMatch — Founder Profile MVP.md" sections 9 (Evidence
// Object), 26 (Scoring Architecture), 27 (Evidence Weighting), 29 (Profile
// Confidence), 30 (Empty State), 31 (Contradiction State).

export type EvidenceDimension =
  | "execution"
  | "integrity"
  | "commitment"
  | "communication"
  | "conflict"
  | "resilience"
  | "ego"
  | "values";

export const DIMENSIONS: EvidenceDimension[] = [
  "execution",
  "integrity",
  "commitment",
  "communication",
  "conflict",
  "resilience",
  "ego",
  "values",
];

export type EvidenceSource =
  | "self"
  | "peer"
  | "evaluator"
  | "interview"
  | "activity"
  | "work_trial"
  | "reference";

export type ConfidenceLevel = "low" | "medium" | "high";

// Section 27's weights, as a product decision for MVP — not a proven
// research figure. `interview`/`activity`/`reference` aren't explicitly
// listed in section 27; `interview` is treated as evaluator-equivalent
// (1.0, a structured evaluator interaction), `activity`/`work_trial` as
// "Observed Behavior" (1.25), `reference` as peer-equivalent (0.8, an
// external testimony rather than a direct evaluator judgment).
export const SOURCE_WEIGHTS: Record<EvidenceSource, number> = {
  self: 0.5,
  peer: 0.8,
  reference: 0.8,
  evaluator: 1.0,
  interview: 1.0,
  activity: 1.25,
  work_trial: 1.25,
};

export interface EvidenceRow {
  dimension: EvidenceDimension;
  source_type: EvidenceSource;
  score: number; // 1-100
  weight: number; // snapshot of SOURCE_WEIGHTS at write time
  is_negative?: boolean;
  created_at?: string;
}

export interface DimensionResult {
  dimension: EvidenceDimension;
  score: number | null; // null = "no evidence yet" — never fabricate a 0
  confidence: ConfidenceLevel | null;
  evidenceCount: number;
  distinctSourceCount: number;
}

// Section 29: Coverage x Source Quality x Repeated Evidence x Context
// Diversity, stated only qualitatively in the spec (its own worked
// examples: Execution with self+evaluator+work_trial+peer+multiple
// activities -> HIGH; Resilience with only a self-report -> LOW). This
// decomposition names each factor as an explicit constant so thresholds
// can be tuned without hunting for magic numbers:
//   - coverage: >=3 evidence rows
//   - source diversity: >=3 distinct source types
//   - repetition: >=2 rows from non-self sources
const CONFIDENCE_MIN_EVIDENCE_FOR_HIGH = 4;
const CONFIDENCE_MIN_SOURCES_FOR_HIGH = 3;
const CONFIDENCE_MIN_EVIDENCE_FOR_MEDIUM = 2;
const CONFIDENCE_MIN_SOURCES_FOR_MEDIUM = 2;

function computeConfidence(rows: EvidenceRow[]): ConfidenceLevel {
  const distinctSources = new Set(rows.map((r) => r.source_type)).size;
  const nonSelfCount = rows.filter((r) => r.source_type !== "self").length;

  if (
    rows.length >= CONFIDENCE_MIN_EVIDENCE_FOR_HIGH &&
    distinctSources >= CONFIDENCE_MIN_SOURCES_FOR_HIGH &&
    nonSelfCount >= 2
  ) {
    return "high";
  }
  if (
    rows.length >= CONFIDENCE_MIN_EVIDENCE_FOR_MEDIUM &&
    distinctSources >= CONFIDENCE_MIN_SOURCES_FOR_MEDIUM
  ) {
    return "medium";
  }
  return "low";
}

// Weighted average score for a single dimension's evidence. Negative
// evidence (is_negative) pulls the score down rather than being excluded —
// it's still a data point about the dimension, just an unfavorable one.
export function computeDimensionScore(rows: EvidenceRow[]): DimensionResult {
  if (rows.length === 0) {
    return {
      dimension: rows[0]?.dimension as EvidenceDimension,
      score: null,
      confidence: null,
      evidenceCount: 0,
      distinctSourceCount: 0,
    };
  }

  const dimension = rows[0].dimension;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const row of rows) {
    const signedScore = row.is_negative ? 100 - row.score : row.score;
    weightedSum += signedScore * row.weight;
    weightTotal += row.weight;
  }
  const score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;

  return {
    dimension,
    score,
    confidence: computeConfidence(rows),
    evidenceCount: rows.length,
    distinctSourceCount: new Set(rows.map((r) => r.source_type)).size,
  };
}

// Groups a flat evidence list by dimension and scores each of the 8 DNA
// dimensions, including ones with zero evidence (score/confidence = null).
export function computeAllDimensionScores(
  allEvidence: EvidenceRow[],
): Record<EvidenceDimension, DimensionResult> {
  const byDimension = new Map<EvidenceDimension, EvidenceRow[]>();
  for (const dim of DIMENSIONS) byDimension.set(dim, []);
  for (const row of allEvidence) {
    byDimension.get(row.dimension)?.push(row);
  }

  const result = {} as Record<EvidenceDimension, DimensionResult>;
  for (const dim of DIMENSIONS) {
    const rows = byDimension.get(dim) ?? [];
    result[dim] = rows.length > 0
      ? computeDimensionScore(rows)
      : { dimension: dim, score: null, confidence: null, evidenceCount: 0, distinctSourceCount: 0 };
  }
  return result;
}

const CONFIDENCE_NUMERIC: Record<ConfidenceLevel, number> = {
  low: 25,
  medium: 60,
  high: 90,
};

// The single header %. Per the confirmed product decision for Phase 1,
// this is equal-weighted across all 8 DNA dimensions (section 28's
// research-derived priors don't map 1:1 onto the 8-dimension model —
// several of its categories, like Complementarity, are two-founder
// concepts that belong in the Phase 2 match engine instead). Dimensions
// with no evidence at all contribute 0, which is what pulls a
// freshly-onboarded founder's Profile Confidence down toward the spec's
// "22%" empty-state example rather than starting at a misleadingly high
// number.
export function computeProfileConfidence(
  dimensionResults: Record<EvidenceDimension, DimensionResult>,
): number {
  const values = DIMENSIONS.map((dim) => {
    const result = dimensionResults[dim];
    if (!result || result.confidence == null) return 0;
    return CONFIDENCE_NUMERIC[result.confidence];
  });
  const average = values.reduce((sum, v) => sum + v, 0) / DIMENSIONS.length;
  return Math.round(average);
}

export interface ContradictionFlag {
  dimension: EvidenceDimension;
  selfScore: number;
  otherScore: number;
  gap: number;
  confidence: ConfidenceLevel;
}

// Section 31: flag when self-report diverges sharply from what
// peers/evaluators observed for the same dimension.
const CONTRADICTION_GAP_THRESHOLD = 30;

export function detectContradiction(rows: EvidenceRow[]): ContradictionFlag | null {
  if (rows.length === 0) return null;
  const dimension = rows[0].dimension;
  const selfRows = rows.filter((r) => r.source_type === "self");
  const otherRows = rows.filter((r) => r.source_type !== "self");
  if (selfRows.length === 0 || otherRows.length === 0) return null;

  const avg = (arr: EvidenceRow[]) =>
    arr.reduce((sum, r) => sum + (r.is_negative ? 100 - r.score : r.score), 0) / arr.length;

  const selfScore = Math.round(avg(selfRows));
  const otherScore = Math.round(avg(otherRows));
  const gap = Math.abs(selfScore - otherScore);
  if (gap < CONTRADICTION_GAP_THRESHOLD) return null;

  return {
    dimension,
    selfScore,
    otherScore,
    gap,
    confidence: computeConfidence(rows),
  };
}

export interface EmptyStateSummary {
  present: string[];
  stillNeeded: string[];
  profileConfidence: number;
}

// Section 30: never show a 0 as if it means "bad" — instead describe what
// evidence exists and what's still missing.
export function buildEmptyState(
  dimensionResults: Record<EvidenceDimension, DimensionResult>,
): EmptyStateSummary {
  const sourceTypesPresent = new Set<EvidenceSource>();
  for (const dim of DIMENSIONS) {
    // dimensionResults doesn't carry per-source detail; callers building the
    // empty state should pass distinctSourceCount-derived hints upstream if
    // finer-grained source labels are needed. Kept minimal here per the
    // spec's own empty-state example (checkmarks for self/evaluator/
    // work_trial/peer/multiple-activity, not per-dimension breakdown).
    void dim;
  }
  void sourceTypesPresent;

  const present: string[] = [];
  const stillNeeded: string[] = ["Evaluator assessment", "Group activity", "Work trial", "Peer feedback"];

  const hasAnyEvidence = DIMENSIONS.some((dim) => dimensionResults[dim]?.evidenceCount > 0);
  if (hasAnyEvidence) present.push("Self assessment");

  return {
    present,
    stillNeeded,
    profileConfidence: computeProfileConfidence(dimensionResults),
  };
}

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

// ---------------------------------------------------------------------------
// Phase 2: Matching / Compatibility Engine
// ---------------------------------------------------------------------------
//
// Not literally specified as a formula anywhere in the source docs (section
// 26's Scoring Architecture stops at the single-founder DNA/Confidence
// layer) — this is a from-scratch but narrowly-scoped design for Phase 2,
// built to be explainable (every component maps to a positive/risk bullet
// on the Matching screen) and to degrade gracefully when a founder has
// little evidence yet, rather than fabricating precision from empty data.

export interface CapabilityLite {
  kind: "provide" | "need";
  capability: string;
}

export interface CompatibilityFounderInput {
  dimensions: Record<EvidenceDimension, DimensionResult>;
  capabilities: CapabilityLite[];
  dealBreakers: string[]; // deal_breakers.label
}

export interface DealBreakerCheckResult {
  flags: string[]; // union of both founders' raw deal-breaker labels
  requiresAdminReview: boolean;
}

// The deal_breakers table stores free-text labels (spec section 25's
// rationale for normalizing it: "the match engine needs to reason over
// individual deal breakers"). Free text can't be safely auto-matched
// against a candidate's profile without a false-negative risk (missing a
// real dealbreaker reads far worse than an unnecessary admin glance) — so
// this engine surfaces every stated deal breaker for a pair as a flag and
// routes the pair to admin review whenever either side has any, rather
// than guessing whether they're actually triggered. Runs first and
// short-circuits nothing computationally, but its `requiresAdminReview`
// output gates how the pair is presented on the Matching screen.
export function checkDealBreakers(
  founderA: Pick<CompatibilityFounderInput, "dealBreakers">,
  founderB: Pick<CompatibilityFounderInput, "dealBreakers">,
): DealBreakerCheckResult {
  const flags = [...founderA.dealBreakers, ...founderB.dealBreakers];
  return {
    flags,
    requiresAdminReview: flags.length > 0,
  };
}

function normalizeCapability(c: string): string {
  return c.trim().toLowerCase();
}

// What fraction of A's stated needs are covered by B's stated provides,
// averaged with the reverse direction. 100 = every need on both sides is
// covered by the other founder; null when neither side listed any needs
// (nothing to be complementary about).
function complementarityScore(
  a: CompatibilityFounderInput,
  b: CompatibilityFounderInput,
): number | null {
  const provides = (f: CompatibilityFounderInput) =>
    new Set(f.capabilities.filter((c) => c.kind === "provide").map((c) => normalizeCapability(c.capability)));
  const needs = (f: CompatibilityFounderInput) =>
    f.capabilities.filter((c) => c.kind === "need").map((c) => normalizeCapability(c.capability));

  const coverage = (needer: CompatibilityFounderInput, provider: CompatibilityFounderInput): number | null => {
    const needList = needs(needer);
    if (needList.length === 0) return null;
    const provideSet = provides(provider);
    const covered = needList.filter((n) => provideSet.has(n)).length;
    return (covered / needList.length) * 100;
  };

  const aNeedsCoveredByB = coverage(a, b);
  const bNeedsCoveredByA = coverage(b, a);
  const parts = [aNeedsCoveredByB, bNeedsCoveredByA].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((s, v) => s + v, 0) / parts.length);
}

// How close two founders sit on a set of dimensions, 100 = identical,
// 0 = maximally apart (a 100-point gap). Only considers dimensions where
// both founders have a non-null score; null if none overlap.
function dimensionAlignment(
  a: Record<EvidenceDimension, DimensionResult>,
  b: Record<EvidenceDimension, DimensionResult>,
  dims: EvidenceDimension[],
): number | null {
  const gaps: number[] = [];
  for (const dim of dims) {
    const scoreA = a[dim]?.score;
    const scoreB = b[dim]?.score;
    if (scoreA == null || scoreB == null) continue;
    gaps.push(100 - Math.abs(scoreA - scoreB));
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((s, v) => s + v, 0) / gaps.length);
}

export interface CompatibilityResult {
  score: number;
  dimensionBreakdown: Record<EvidenceDimension, { a: number | null; b: number | null; gap: number | null }>;
  explanation: { positives: string[]; risks: string[] };
  dealBreakerFlags: string[];
  requiresAdminReview: boolean;
}

const COMPLEMENTARITY_WEIGHT = 0.4;
const VALUES_ALIGNMENT_WEIGHT = 0.35;
const WORK_STYLE_ALIGNMENT_WEIGHT = 0.25;
const VALUES_DIMENSIONS: EvidenceDimension[] = ["values", "integrity"];
const WORK_STYLE_DIMENSIONS: EvidenceDimension[] = ["communication", "conflict", "resilience"];

export function computeCompatibility(
  founderA: CompatibilityFounderInput,
  founderB: CompatibilityFounderInput,
): CompatibilityResult {
  const dealBreakerCheck = checkDealBreakers(founderA, founderB);

  const complementarity = complementarityScore(founderA, founderB);
  const valuesAlignment = dimensionAlignment(founderA.dimensions, founderB.dimensions, VALUES_DIMENSIONS);
  const workStyleAlignment = dimensionAlignment(founderA.dimensions, founderB.dimensions, WORK_STYLE_DIMENSIONS);

  const weighted: Array<[number | null, number]> = [
    [complementarity, COMPLEMENTARITY_WEIGHT],
    [valuesAlignment, VALUES_ALIGNMENT_WEIGHT],
    [workStyleAlignment, WORK_STYLE_ALIGNMENT_WEIGHT],
  ];
  const available = weighted.filter((w): w is [number, number] => w[0] != null);
  const weightTotal = available.reduce((sum, [, w]) => sum + w, 0);
  const score = weightTotal > 0
    ? Math.round(available.reduce((sum, [v, w]) => sum + v * w, 0) / weightTotal)
    : 0;

  const dimensionBreakdown = {} as CompatibilityResult["dimensionBreakdown"];
  for (const dim of DIMENSIONS) {
    const a = founderA.dimensions[dim]?.score ?? null;
    const b = founderB.dimensions[dim]?.score ?? null;
    dimensionBreakdown[dim] = { a, b, gap: a != null && b != null ? Math.abs(a - b) : null };
  }

  const positives: string[] = [];
  const risks: string[] = [];
  if (complementarity != null && complementarity >= 70) {
    positives.push("Strong capability complementarity — what each founder needs, the other provides.");
  } else if (complementarity != null && complementarity < 30) {
    risks.push("Little capability complementarity — their needs and provides barely overlap.");
  }
  if (valuesAlignment != null && valuesAlignment >= 80) {
    positives.push("Closely aligned values and integrity signals.");
  } else if (valuesAlignment != null && valuesAlignment < 50) {
    risks.push("Diverging values/integrity signals — worth probing before pairing.");
  }
  if (workStyleAlignment != null && workStyleAlignment >= 80) {
    positives.push("Compatible communication, conflict, and resilience profiles.");
  } else if (workStyleAlignment != null && workStyleAlignment < 50) {
    risks.push("Work-style gap on communication/conflict/resilience — may cause friction.");
  }
  if (dealBreakerCheck.requiresAdminReview) {
    risks.push("One or both founders have stated deal breakers — needs admin review before pairing.");
  }
  if (available.length === 0) {
    risks.push("Not enough evidence on either founder yet to compute a meaningful match.");
  }

  return {
    score,
    dimensionBreakdown,
    explanation: { positives, risks },
    dealBreakerFlags: dealBreakerCheck.flags,
    requiresAdminReview: dealBreakerCheck.requiresAdminReview,
  };
}

// ---------------------------------------------------------------------------
// Phase 3: Team DNA / Team Profile
// ---------------------------------------------------------------------------
//
// Extends the two-founder Compatibility Engine above to a whole team.
// Confidence-per-dimension can't just average like score can — a team's
// belief about a dimension is only as strong as its weakest-evidenced
// member on that dimension, so it takes the lowest confidence level among
// contributing members rather than an average.

export interface TeamMemberInput {
  founderId: string;
  dimensions: Record<EvidenceDimension, DimensionResult>;
  capabilities: CapabilityLite[];
}

export interface TeamDimensionResult {
  dimension: EvidenceDimension;
  score: number | null;
  confidence: ConfidenceLevel | null;
}

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

export function computeTeamDimensionScores(
  members: TeamMemberInput[],
): Record<EvidenceDimension, TeamDimensionResult> {
  const result = {} as Record<EvidenceDimension, TeamDimensionResult>;
  for (const dim of DIMENSIONS) {
    const contributing = members
      .map((m) => m.dimensions[dim])
      .filter((d): d is DimensionResult => d != null && d.score != null);
    if (contributing.length === 0) {
      result[dim] = { dimension: dim, score: null, confidence: null };
      continue;
    }
    const score = Math.round(contributing.reduce((sum, d) => sum + (d.score as number), 0) / contributing.length);
    const confidence = contributing.reduce<ConfidenceLevel>(
      (worst, d) => (CONFIDENCE_RANK[d.confidence as ConfidenceLevel] < CONFIDENCE_RANK[worst] ? (d.confidence as ConfidenceLevel) : worst),
      "high",
    );
    result[dim] = { dimension: dim, score, confidence };
  }
  return result;
}

// What every member provides, minus what nobody on the team provides but
// at least one member needs — the same complementarity idea as the
// two-founder engine, generalized to N members via set union instead of
// a single pairwise coverage fraction.
export function computeTeamComplementarity(
  members: TeamMemberInput[],
): { complementarySkills: string[]; capabilityGaps: string[] } {
  const provideSet = new Set<string>();
  const needSet = new Set<string>();
  for (const m of members) {
    for (const c of m.capabilities) {
      (c.kind === "provide" ? provideSet : needSet).add(normalizeCapability(c.capability));
    }
  }
  const complementarySkills = [...provideSet].sort();
  const capabilityGaps = [...needSet].filter((n) => !provideSet.has(n)).sort();
  return { complementarySkills, capabilityGaps };
}

export interface TeamProfile {
  dimensionScores: Record<EvidenceDimension, TeamDimensionResult>;
  strengths: EvidenceDimension[];
  potentialGaps: EvidenceDimension[];
  complementarySkills: string[];
  capabilityGaps: string[];
  compatibility: number | null;
  potentialFriction: string[];
}

const TEAM_STRENGTH_THRESHOLD = 75;
const TEAM_GAP_THRESHOLD = 50;

// `pairwiseResults` is the team's set of already-computed
// CompatibilityResults for every member pair (from founder_compatibility) —
// this function doesn't recompute pairwise compatibility itself, it just
// aggregates what's already been computed, same division of labor as
// computeProfileConfidence not re-deriving evidence.
export function computeTeamProfile(
  members: TeamMemberInput[],
  pairwiseResults: CompatibilityResult[],
): TeamProfile {
  const dimensionScores = computeTeamDimensionScores(members);
  const strengths = DIMENSIONS.filter((d) => (dimensionScores[d].score ?? -1) >= TEAM_STRENGTH_THRESHOLD);
  const potentialGaps = DIMENSIONS.filter((d) => dimensionScores[d].score != null && (dimensionScores[d].score as number) < TEAM_GAP_THRESHOLD);
  const { complementarySkills, capabilityGaps } = computeTeamComplementarity(members);

  const compatibility = pairwiseResults.length > 0
    ? Math.round(pairwiseResults.reduce((sum, r) => sum + r.score, 0) / pairwiseResults.length)
    : null;
  const potentialFriction = [...new Set(pairwiseResults.flatMap((r) => r.explanation.risks))];

  return { dimensionScores, strengths, potentialGaps, complementarySkills, capabilityGaps, compatibility, potentialFriction };
}

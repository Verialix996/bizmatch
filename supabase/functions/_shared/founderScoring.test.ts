// Run with: deno test supabase/functions/_shared/founderScoring.test.ts
// (not executed in this environment — no local `deno` binary available;
// verify these pass before relying on founderScoring.ts in an Edge Function.)

import { assertEquals, assert } from "https://deno.land/std/testing/asserts.ts";
import {
  computeDimensionScore,
  computeAllDimensionScores,
  computeProfileConfidence,
  detectContradiction,
  buildEmptyState,
  checkDealBreakers,
  computeCompatibility,
  DIMENSIONS,
  type EvidenceRow,
  type CompatibilityFounderInput,
} from "./founderScoring.ts";

// Section 29's worked example: Execution has self-report + evaluator +
// work_trial + peer + multiple activities -> HIGH confidence.
Deno.test("computeDimensionScore: rich multi-source evidence yields high confidence", () => {
  const rows: EvidenceRow[] = [
    { dimension: "execution", source_type: "self", score: 80, weight: 0.5 },
    { dimension: "execution", source_type: "evaluator", score: 85, weight: 1.0 },
    { dimension: "execution", source_type: "work_trial", score: 90, weight: 1.25 },
    { dimension: "execution", source_type: "peer", score: 88, weight: 0.8 },
    { dimension: "execution", source_type: "activity", score: 84, weight: 1.25 },
  ];
  const result = computeDimensionScore(rows);
  assertEquals(result.confidence, "high");
  assert(result.score !== null && result.score > 0);
  assertEquals(result.evidenceCount, 5);
});

// Section 29's other worked example: Resilience has only a self-report ->
// LOW confidence.
Deno.test("computeDimensionScore: self-report only yields low confidence", () => {
  const rows: EvidenceRow[] = [
    { dimension: "resilience", source_type: "self", score: 70, weight: 0.5 },
  ];
  const result = computeDimensionScore(rows);
  assertEquals(result.confidence, "low");
  assertEquals(result.score, 70);
});

// Section 11/30: no evidence at all must never fabricate a 0.
Deno.test("computeDimensionScore: no evidence returns null score, not 0", () => {
  const result = computeDimensionScore([]);
  assertEquals(result.score, null);
  assertEquals(result.confidence, null);
  assertEquals(result.evidenceCount, 0);
});

Deno.test("computeAllDimensionScores: covers all 8 dimensions even when most are empty", () => {
  const rows: EvidenceRow[] = [
    { dimension: "execution", source_type: "self", score: 80, weight: 0.5 },
  ];
  const result = computeAllDimensionScores(rows);
  assertEquals(Object.keys(result).length, DIMENSIONS.length);
  assertEquals(result.execution.evidenceCount, 1);
  assertEquals(result.integrity.evidenceCount, 0);
  assertEquals(result.integrity.score, null);
});

// Section 30's empty-state example: a brand new founder with only a self
// assessment should land at a low, not-fabricated confidence percentage
// (the doc's own example: 22%), never a misleadingly high number.
Deno.test("computeProfileConfidence: fresh founder with only self-report scores low", () => {
  const rows: EvidenceRow[] = DIMENSIONS.slice(0, 3).map((dimension) => ({
    dimension,
    source_type: "self" as const,
    score: 70,
    weight: 0.5,
  }));
  const dimensionResults = computeAllDimensionScores(rows);
  const confidence = computeProfileConfidence(dimensionResults);
  assert(confidence < 20, `expected a low confidence for self-report-only, got ${confidence}`);
});

Deno.test("computeProfileConfidence: rich evidence across all dimensions scores high", () => {
  const rows: EvidenceRow[] = DIMENSIONS.flatMap((dimension) => [
    { dimension, source_type: "self" as const, score: 80, weight: 0.5 },
    { dimension, source_type: "evaluator" as const, score: 85, weight: 1.0 },
    { dimension, source_type: "peer" as const, score: 82, weight: 0.8 },
    { dimension, source_type: "work_trial" as const, score: 88, weight: 1.25 },
  ]);
  const dimensionResults = computeAllDimensionScores(rows);
  const confidence = computeProfileConfidence(dimensionResults);
  assert(confidence >= 80, `expected a high confidence for rich multi-source evidence, got ${confidence}`);
});

// Section 31: self-report "High listening" vs peer feedback "Low" should
// surface as a contradiction.
Deno.test("detectContradiction: flags large self-vs-peer divergence", () => {
  const rows: EvidenceRow[] = [
    { dimension: "communication", source_type: "self", score: 90, weight: 0.5 },
    { dimension: "communication", source_type: "peer", score: 40, weight: 0.8 },
    { dimension: "communication", source_type: "peer", score: 45, weight: 0.8 },
  ];
  const flag = detectContradiction(rows);
  assert(flag !== null);
  assertEquals(flag?.dimension, "communication");
  assert(flag!.gap >= 30);
});

Deno.test("detectContradiction: no flag when self and others roughly agree", () => {
  const rows: EvidenceRow[] = [
    { dimension: "communication", source_type: "self", score: 80, weight: 0.5 },
    { dimension: "communication", source_type: "peer", score: 75, weight: 0.8 },
  ];
  assertEquals(detectContradiction(rows), null);
});

Deno.test("buildEmptyState: lists still-needed sources for a fresh founder", () => {
  const rows: EvidenceRow[] = [
    { dimension: "execution", source_type: "self", score: 70, weight: 0.5 },
  ];
  const dimensionResults = computeAllDimensionScores(rows);
  const summary = buildEmptyState(dimensionResults);
  assert(summary.present.includes("Self assessment"));
  assert(summary.stillNeeded.includes("Evaluator assessment"));
});

// --- Phase 2: Matching / Compatibility Engine ---------------------------

Deno.test("checkDealBreakers: no flags when neither founder listed any", () => {
  const result = checkDealBreakers({ dealBreakers: [] }, { dealBreakers: [] });
  assertEquals(result.flags, []);
  assertEquals(result.requiresAdminReview, false);
});

Deno.test("checkDealBreakers: any stated deal breaker routes the pair to admin review", () => {
  const result = checkDealBreakers(
    { dealBreakers: ["Not full-time"] },
    { dealBreakers: [] },
  );
  assertEquals(result.flags, ["Not full-time"]);
  assertEquals(result.requiresAdminReview, true);
});

function founderInput(
  evidence: EvidenceRow[],
  capabilities: CompatibilityFounderInput["capabilities"],
  dealBreakers: string[] = [],
): CompatibilityFounderInput {
  return { dimensions: computeAllDimensionScores(evidence), capabilities, dealBreakers };
}

Deno.test("computeCompatibility: complementary capabilities and aligned values score high", () => {
  const richEvidence = (dimension: EvidenceRow["dimension"], score: number): EvidenceRow[] => [
    { dimension, source_type: "evaluator", score, weight: 1.0 },
    { dimension, source_type: "peer", score, weight: 0.8 },
  ];
  const founderA = founderInput(
    [
      ...richEvidence("values", 85),
      ...richEvidence("integrity", 85),
      ...richEvidence("communication", 80),
      ...richEvidence("conflict", 80),
      ...richEvidence("resilience", 80),
    ],
    [
      { kind: "provide", capability: "Engineering" },
      { kind: "need", capability: "Sales" },
    ],
  );
  const founderB = founderInput(
    [
      ...richEvidence("values", 82),
      ...richEvidence("integrity", 88),
      ...richEvidence("communication", 78),
      ...richEvidence("conflict", 82),
      ...richEvidence("resilience", 79),
    ],
    [
      { kind: "provide", capability: "Sales" },
      { kind: "need", capability: "Engineering" },
    ],
  );
  const result = computeCompatibility(founderA, founderB);
  assert(result.score >= 80, `expected a high compatibility score, got ${result.score}`);
  assert(result.explanation.positives.length > 0);
  assertEquals(result.requiresAdminReview, false);
  assertEquals(result.dealBreakerFlags, []);
});

Deno.test("computeCompatibility: a stated deal breaker forces admin review regardless of score", () => {
  const founderA = founderInput([], [], ["Must be full-time"]);
  const founderB = founderInput([], []);
  const result = computeCompatibility(founderA, founderB);
  assertEquals(result.requiresAdminReview, true);
  assert(result.explanation.risks.some((r) => r.includes("deal breaker")));
});

Deno.test("computeCompatibility: two founders with no evidence yet score 0 with a risk note, not a fabricated match", () => {
  const founderA = founderInput([], []);
  const founderB = founderInput([], []);
  const result = computeCompatibility(founderA, founderB);
  assertEquals(result.score, 0);
  assert(result.explanation.risks.some((r) => r.includes("Not enough evidence")));
});

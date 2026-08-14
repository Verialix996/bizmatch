import type { EvidenceDimension } from "./founderScoring.ts";

export type EvaluationAnswerKind = "scale" | "yes_no";

export interface InterviewEvaluationQuestion {
  dimension: EvidenceDimension;
  kind: EvaluationAnswerKind;
  text: string;
}

// Mirrors the dimension sections of frontend/src/interview/data/questionTree.bizmatch.ts —
// question ids here MUST match the ids in that tree. On interview completion (see
// founder-interviews/index.ts), each answered question listed here is fanned out into a scored
// `evidence` row the same way the standalone evaluator-assessment form does (see the
// `assessments` function's itemToEvidenceScore), at source_type='interview' / weight 1.0
// (SOURCE_WEIGHTS.interview in founderScoring.ts).
//
// Only questions that produce a clean 1-5 scale or yes/no answer are listed. The two behavioral
// recall questions (`*_q1`/`*_q2`) that precede each dimension's rating in the tree, the context
// questions, and the closing "would you vouch for them" / notes questions are captured in the
// interview's raw answers but deliberately don't auto-score — the recall questions exist to
// ground the rating that follows them in a concrete example rather than an unprompted global
// impression, and the closing questions capture holistic sentiment, not evidence.
export const INTERVIEW_EVALUATION_QUESTIONS: Record<string, InterviewEvaluationQuestion> = {
  execution_scale: {
    dimension: "execution",
    kind: "scale",
    text: "Based on what they described, how would you rate their execution and follow-through?",
  },
  execution_ownership: {
    dimension: "execution",
    kind: "yes_no",
    text: "Did they take ownership of a problem without being asked to?",
  },
  integrity_scale: {
    dimension: "integrity",
    kind: "scale",
    text: "How honest and consistent were they between what they said and what they described actually doing?",
  },
  commitment_scale: {
    dimension: "commitment",
    kind: "scale",
    text: "How committed and available do they seem to this venture right now?",
  },
  communication_scale: {
    dimension: "communication",
    kind: "scale",
    text: "How direct and clear was their communication during this conversation?",
  },
  conflict_scale: {
    dimension: "conflict",
    kind: "scale",
    text: "Based on what they described, how did they handle disagreement or pushback?",
  },
  resilience_scale: {
    dimension: "resilience",
    kind: "scale",
    text: "Based on what they described, how did they handle pressure or setbacks?",
  },
  ego_scale: {
    dimension: "ego",
    kind: "scale",
    text: "How coachable and open to feedback did they seem?",
  },
  ego_yesno: {
    dimension: "ego",
    kind: "yes_no",
    text: "When challenged on something they said, were they open to it rather than defensive?",
  },
  values_scale: {
    dimension: "values",
    kind: "scale",
    text: "How well did their stated priorities match how they actually described making decisions?",
  },
};

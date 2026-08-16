import type { EvidenceDimension } from "./founderScoring.ts";

// v2: one interview-grounded, evidence-seeking question per DNA dimension
// (was 5 self-rating-adjacent questions/dimension, 40 total). Derived from a
// review of 47 founder interviews — see BizMatch_Interview_Grounded_Onboarding_Spec.
// Mirrored in frontend/src/config/dnaQuestions.js — keep both in sync; this
// copy is authoritative for scoring (dna-self-assessment validates the
// submitted question ids against it), the frontend copy is what's rendered.
//
// `id` is a stable identifier persisted alongside each answer (see
// dna_self_assessment_responses.question_id) — assessment_version=2 rows key
// on (founder_id, assessment_version, dimension, question_id), so changing an
// id here would orphan any already-submitted v2 answers for that dimension.
// The v1 (5-question) bank this replaced is not deleted from git history;
// existing v1 responses/evidence are untouched by this change (assessment_version=1).
export const DNA_QUESTIONS: Record<EvidenceDimension, { id: string; text: string }> = {
  execution: {
    id: "execution_v2",
    text: "Tell us about something you took from idea to a real result. What did you personally own, what shipped, and what did you cut or change when reality got in the way?",
  },
  integrity: {
    id: "integrity_v2",
    text: "Tell us about a time you made a mistake or could not keep a commitment that affected someone else. When and how did you tell them, and what did you do next?",
  },
  commitment: {
    id: "commitment_v2",
    text: "Tell us about the hardest goal you stayed committed to when progress was slow or uncertain. What did you keep doing, and what evidence would have made you stop?",
  },
  communication: {
    id: "communication_v2",
    text: "Tell us about a meaningful misunderstanding with a teammate or partner. What did each side understand differently, how did you address it, and what changed afterward?",
  },
  conflict: {
    id: "conflict_v2",
    text: "Tell us about a serious disagreement with a partner, teammate, or manager where you did not fully get your way. How did you behave, how was the decision made, and what happened to the relationship?",
  },
  resilience: {
    id: "resilience_v2",
    text: "Tell us about a professional low point, failure, or rejection. What did you do in the first 72 hours, and what did you change in the weeks that followed?",
  },
  // Question id is "learning_v2", not "ego_v2" — intentional, matches the
  // source spec exactly. Dimension key stays "ego".
  ego: {
    id: "learning_v2",
    text: "Tell us about feedback that was difficult to hear but turned out to be right. What did you change in your behavior or decisions because of it?",
  },
  values: {
    id: "values_v2",
    text: "What is one principle you would not compromise on in a partnership, even if it cost money, growth, or an important opportunity? Give one real example of when that principle affected a decision.",
  },
};

export const DNA_DIMENSIONS = Object.keys(DNA_QUESTIONS) as EvidenceDimension[];

export const DNA_ASSESSMENT_VERSION = 2;

/**
 * The BizMatch founder-evaluation interview: a structured, evaluator-run conversation with a
 * founder who is *already in the program* (not a cold-outreach prospect), aimed at mapping them
 * across the same 8 character dimensions the rest of the app scores (see
 * supabase/functions/_shared/founderScoring.ts's `DIMENSIONS`).
 *
 * This replaces an earlier version of this file that was a market/problem-validation interview
 * ported from a standalone app for pitching BizMatch itself to strangers (screening gate,
 * partner-search channel branching, a "golden question" about problems in an entrepreneur's
 * life generally). That content doesn't apply here — an already-registered founder doesn't need
 * to be screened for being an entrepreneur, and the point of this interview isn't to validate
 * BizMatch's own thesis, it's to produce evidence for *this specific founder's* profile.
 *
 * Structure: a brief context section (role, venture stage, team size — enough to frame the
 * answers that follow), then one section per dimension. Each dimension asks 2 behavioral
 * (STAR-style: situation/action, not hypotheticals) recall questions. These are deliberately
 * *different angles* from the founder's own DNA self-assessment questions for the same dimension
 * (supabase/functions/_shared/dnaQuestions.ts) - not just a reworded version of the same 5
 * prompts. Reusing the same prompt would let a founder replay a story they'd already prepared
 * for the self-assessment, giving the evaluator a live reading of the same data point instead of
 * genuinely independent evidence; asking something the self-assessment never asked is what makes
 * self (weight 0.5) and interview (weight 1.0) meaningfully different sources to average
 * together, not two copies of one source. The evaluator then rates that dimension 1-5 based on
 * what was actually described - the rating is
 * deliberately placed *after* the recall questions, not asked cold, so it's anchored to a
 * concrete answer rather than an unprompted global impression. Execution and ego each add one
 * yes/no question as a second, independent signal for that dimension. The interview closes with
 * a non-scored "would you personally vouch for them?" holistic call and a free-text notes field.
 *
 * Question ids are the scoring contract with the backend: supabase/functions/_shared/
 * interviewEvaluationQuestions.ts maps every `*_scale` and `*_yesno`/`*_ownership` id here to
 * {dimension, kind}, and supabase/functions/founder-interviews/index.ts fans them out into
 * scored `evidence` rows (source_type='interview', weight 1.0) when the interview is completed.
 * The two behavioral recall questions per dimension are stored as answers but don't auto-score -
 * they exist to ground the rating that follows them, not to be scored as evidence themselves.
 */

import type { QuestionDefinition, QuestionTree, Section } from "../engine/types";

export const sections: Section[] = [
  { id: "context", label: "Context", order: 1 },
  { id: "execution", label: "1. Execution", order: 2 },
  { id: "integrity", label: "2. Integrity", order: 3 },
  { id: "commitment", label: "3. Commitment", order: 4 },
  { id: "communication", label: "4. Communication", order: 5 },
  { id: "conflict", label: "5. Conflict", order: 6 },
  { id: "resilience", label: "6. Resilience", order: 7 },
  { id: "ego", label: "7. Ego", order: 8 },
  { id: "values", label: "8. Values", order: 9 },
  { id: "closing", label: "Closing", order: 10 },
];

let orderCounter = 0;
const nextOrder = () => ++orderCounter;

const SCALE_OPTIONS = [
  { id: "1", label: "1" },
  { id: "2", label: "2" },
  { id: "3", label: "3" },
  { id: "4", label: "4" },
  { id: "5", label: "5" },
];

const questions: QuestionDefinition[] = [
  // ---- Context ----
  {
    id: "context_intro",
    section: "context",
    type: "info",
    text: "Thanks for taking the time. This is a quick conversation to understand how you actually operate day to day — real examples, not hypotheticals.",
    order: nextOrder(),
    next: { kind: "linear", to: "context_role" },
  },
  {
    id: "context_role",
    section: "context",
    type: "short_text",
    text: "What's your actual role in the venture right now?",
    order: nextOrder(),
    summaryKey: "context.role",
    next: { kind: "linear", to: "context_venture_stage" },
  },
  {
    id: "context_venture_stage",
    section: "context",
    type: "single_choice",
    text: "What stage is the venture at?",
    order: nextOrder(),
    summaryKey: "context.ventureStage",
    options: [
      { id: "idea", label: "Idea" },
      { id: "mvp", label: "MVP" },
      { id: "product", label: "Product" },
      { id: "customers", label: "Customers" },
      { id: "revenue", label: "Revenue" },
      { id: "scale", label: "Scale" },
    ],
    next: { kind: "linear", to: "context_team_size" },
  },
  {
    id: "context_team_size",
    section: "context",
    type: "number",
    text: "How many people are on the team?",
    order: nextOrder(),
    summaryKey: "context.teamSize",
    next: { kind: "linear", to: "execution_q1" },
  },

  // ---- 1. Execution ----
  {
    id: "execution_q1",
    section: "execution",
    type: "long_text",
    text: "What's something on your plate right now that's overdue, and why?",
    order: nextOrder(),
    summaryKey: "execution.q1",
    next: { kind: "linear", to: "execution_q2" },
  },
  {
    id: "execution_q2",
    section: "execution",
    type: "long_text",
    text: "Tell me about a task you delegated that didn't get done the way you needed. What did you do?",
    order: nextOrder(),
    summaryKey: "execution.q2",
    next: { kind: "linear", to: "execution_scale" },
  },
  {
    id: "execution_scale",
    section: "execution",
    type: "single_choice",
    text: "Based on what they just described, how would you rate their execution and follow-through?",
    order: nextOrder(),
    summaryKey: "evaluation.executionScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "execution_ownership" },
  },
  {
    id: "execution_ownership",
    section: "execution",
    type: "yes_no",
    text: "Did they take ownership of a problem without being asked to?",
    order: nextOrder(),
    summaryKey: "evaluation.executionOwnership",
    next: { kind: "linear", to: "integrity_q1" },
  },

  // ---- 2. Integrity ----
  {
    id: "integrity_q1",
    section: "integrity",
    type: "long_text",
    text: "If I called your last co-founder or teammate right now, what would they say about whether you do what you say you'll do?",
    order: nextOrder(),
    summaryKey: "integrity.q1",
    next: { kind: "linear", to: "integrity_q2" },
  },
  {
    id: "integrity_q2",
    section: "integrity",
    type: "long_text",
    text: "Tell me about a time you had to report a result or number that made you look bad, but you reported it accurately anyway.",
    order: nextOrder(),
    summaryKey: "integrity.q2",
    next: { kind: "linear", to: "integrity_scale" },
  },
  {
    id: "integrity_scale",
    section: "integrity",
    type: "single_choice",
    text: "How honest and consistent were they between what they said and what they described actually doing?",
    order: nextOrder(),
    summaryKey: "evaluation.integrityScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "commitment_q1" },
  },

  // ---- 3. Commitment ----
  {
    id: "commitment_q1",
    section: "commitment",
    type: "long_text",
    text: "What does a bad week for this venture look like for you personally — do you still show up the same way?",
    order: nextOrder(),
    summaryKey: "commitment.q1",
    next: { kind: "linear", to: "commitment_q2" },
  },
  {
    id: "commitment_q2",
    section: "commitment",
    type: "long_text",
    text: "Tell me about something you keep doing for this venture even though no one is checking on it.",
    order: nextOrder(),
    summaryKey: "commitment.q2",
    next: { kind: "linear", to: "commitment_scale" },
  },
  {
    id: "commitment_scale",
    section: "commitment",
    type: "single_choice",
    text: "How committed and available do they seem to this venture right now?",
    order: nextOrder(),
    summaryKey: "evaluation.commitmentScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "communication_q1" },
  },

  // ---- 4. Communication ----
  {
    id: "communication_q1",
    section: "communication",
    type: "long_text",
    text: "Tell me about a time you had to ask for something you needed and weren't sure how it would land.",
    order: nextOrder(),
    summaryKey: "communication.q1",
    next: { kind: "linear", to: "communication_q2" },
  },
  {
    id: "communication_q2",
    section: "communication",
    type: "long_text",
    text: "How do you make sure people actually understood you, not just heard you?",
    order: nextOrder(),
    summaryKey: "communication.q2",
    next: { kind: "linear", to: "communication_scale" },
  },
  {
    id: "communication_scale",
    section: "communication",
    type: "single_choice",
    text: "How direct and clear was their communication during this conversation?",
    order: nextOrder(),
    summaryKey: "evaluation.communicationScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "conflict_q1" },
  },

  // ---- 5. Conflict ----
  {
    id: "conflict_q1",
    section: "conflict",
    type: "long_text",
    text: "Tell me about a time two people on your team disagreed and you had to step in.",
    order: nextOrder(),
    summaryKey: "conflict.q1",
    next: { kind: "linear", to: "conflict_q2" },
  },
  {
    id: "conflict_q2",
    section: "conflict",
    type: "long_text",
    text: "What's the last thing someone said to you that you initially wanted to argue with, but didn't?",
    order: nextOrder(),
    summaryKey: "conflict.q2",
    next: { kind: "linear", to: "conflict_scale" },
  },
  {
    id: "conflict_scale",
    section: "conflict",
    type: "single_choice",
    text: "Based on what they described, how did they handle disagreement or pushback?",
    order: nextOrder(),
    summaryKey: "evaluation.conflictScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "resilience_q1" },
  },

  // ---- 6. Resilience ----
  {
    id: "resilience_q1",
    section: "resilience",
    type: "long_text",
    text: "What's something about this venture that scares you right now, and what are you doing about it?",
    order: nextOrder(),
    summaryKey: "resilience.q1",
    next: { kind: "linear", to: "resilience_q2" },
  },
  {
    id: "resilience_q2",
    section: "resilience",
    type: "long_text",
    text: "Tell me about the last time a plan completely fell apart on short notice. What did the next 24 hours look like?",
    order: nextOrder(),
    summaryKey: "resilience.q2",
    next: { kind: "linear", to: "resilience_scale" },
  },
  {
    id: "resilience_scale",
    section: "resilience",
    type: "single_choice",
    text: "Based on what they described, how did they handle pressure or setbacks?",
    order: nextOrder(),
    summaryKey: "evaluation.resilienceScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "ego_q1" },
  },

  // ---- 7. Ego ----
  {
    id: "ego_q1",
    section: "ego",
    type: "long_text",
    text: "Who do you go to when you want to be told you're wrong, and why them?",
    order: nextOrder(),
    summaryKey: "ego.q1",
    next: { kind: "linear", to: "ego_q2" },
  },
  {
    id: "ego_q2",
    section: "ego",
    type: "long_text",
    text: "Tell me about the last time you asked someone junior to you for their honest opinion.",
    order: nextOrder(),
    summaryKey: "ego.q2",
    next: { kind: "linear", to: "ego_scale" },
  },
  {
    id: "ego_scale",
    section: "ego",
    type: "single_choice",
    text: "How coachable and open to feedback did they seem?",
    order: nextOrder(),
    summaryKey: "evaluation.egoScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "ego_yesno" },
  },
  {
    id: "ego_yesno",
    section: "ego",
    type: "yes_no",
    text: "When you challenged something they said, were they open to it rather than defensive?",
    order: nextOrder(),
    summaryKey: "evaluation.egoYesNo",
    next: { kind: "linear", to: "values_q1" },
  },

  // ---- 8. Values ----
  {
    id: "values_q1",
    section: "values",
    type: "long_text",
    text: "Tell me about a customer or user request you turned down even though saying yes would have helped the business.",
    order: nextOrder(),
    summaryKey: "values.q1",
    next: { kind: "linear", to: "values_q2" },
  },
  {
    id: "values_q2",
    section: "values",
    type: "long_text",
    text: "What's a rule you hold your team to that you'd never bend, even for your best performer?",
    order: nextOrder(),
    summaryKey: "values.q2",
    next: { kind: "linear", to: "values_scale" },
  },
  {
    id: "values_scale",
    section: "values",
    type: "single_choice",
    text: "How well did their stated priorities match how they actually described making decisions?",
    order: nextOrder(),
    summaryKey: "evaluation.valuesScale",
    options: SCALE_OPTIONS,
    next: { kind: "linear", to: "vouch_yesno" },
  },

  // ---- Closing ----
  {
    id: "vouch_yesno",
    section: "closing",
    type: "yes_no",
    text: "Based on this conversation, would you personally vouch for working with them?",
    order: nextOrder(),
    summaryKey: "evaluation.vouch",
    next: { kind: "linear", to: "closing_notes" },
  },
  {
    id: "closing_notes",
    section: "closing",
    type: "long_text",
    text: "Additional observations (optional).",
    order: nextOrder(),
    summaryKey: "evaluation.notes",
    next: { kind: "linear", to: "interview_end" },
  },
  {
    id: "interview_end",
    section: "closing",
    type: "end",
    text: "The interview has ended.",
    order: nextOrder(),
    next: { kind: "linear", to: null },
  },
];

export const questionTree: QuestionTree = {
  version: "bizmatch-2.0.0",
  rootId: "context_intro",
  sections,
  questions,
};

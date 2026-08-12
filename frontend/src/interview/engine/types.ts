/**
 * Core domain types for the interview decision-tree engine.
 * This module has zero React/browser dependencies so it can be unit tested in isolation
 * and reused by the UI, the PDF exporters and the template engine alike.
 *
 * Question *visibility* is never encoded as a standalone condition on the question itself.
 * It is always derived from tree reachability: a question is "active" if walking the tree
 * from the root, following the `next` pointers according to the answers given so far, reaches
 * that question's id. This keeps the id the single source of truth (never the question text).
 */

export type QuestionId = string;
export type SectionId = string;
export type OptionId = string;

export type QuestionType =
  | "yes_no"
  | "single_choice"
  | "multi_choice"
  | "short_text"
  | "long_text"
  | "number"
  | "duration"
  | "info"
  | "end";

export type QuestionStatus =
  | "unanswered"
  | "answered"
  | "skipped"
  | "inactive"
  | "archived";

export type DurationUnit = "minutes" | "hours" | "days" | "months" | "years";

export interface QuestionOption {
  id: OptionId;
  label: string;
  /** When true, selecting this option reveals a free-text field ("אחר"). */
  allowFreeText?: boolean;
}

/** Where the tree should go after this question receives an answer. */
export type NextSpec =
  | { kind: "linear"; to: QuestionId | null }
  | { kind: "yesNo"; yes: QuestionId | null; no: QuestionId | null }
  | {
      kind: "byOption";
      branches: Record<OptionId, QuestionId | null>;
      /** Used if the chosen option id has no explicit branch entry. */
      fallback?: QuestionId | null;
    }
  | {
      kind: "multiFlowDispatch";
      /** Entry question id of the repeatable flow instance for each option id. */
      flowEntryByOption: Record<OptionId, QuestionId>;
      /** Where to continue once every selected flow instance has been completed. */
      after: QuestionId | null;
    };

export interface Section {
  id: SectionId;
  label: string;
  order: number;
  /** Optional visual accent for this section's questions in the Focus View (data-driven, not hardcoded per tree). */
  theme?: "gold";
}

export interface QuestionDefinition {
  id: QuestionId;
  section: SectionId;
  type: QuestionType;
  /** Exact wording as supplied - never altered, shortened or paraphrased by code. */
  text: string;
  /** Static "always required" flag. yes_no questions are dynamically required whenever active. */
  required?: boolean;
  options?: QuestionOption[];
  next?: NextSpec;
  /** Key used by the template engine to pull this answer into a summary paragraph. */
  summaryKey?: string;
  /** Order of appearance in the draft document (defaults to declaration order if omitted). */
  order: number;
  /** Marks this question as belonging to a generated repeatable-flow instance. */
  repeatableFlow?: { templateId: string; instanceId: string; instanceLabel: string };
  helpText?: string;
  /**
   * For short_text/long_text questions that ask (in conversation) for something already
   * captured as a required field on the opening screen - the answer is pre-filled from that
   * meta field when the interview starts, so the interviewer isn't asked to type it twice.
   * They can still edit it when they reach the question.
   */
  prefillFromMeta?: keyof InterviewMeta;
}

export interface QuestionTree {
  version: string;
  rootId: QuestionId;
  sections: Section[];
  questions: QuestionDefinition[];
  /** Optional precomputed id -> question index. Build once via `compileTree`. */
  byId?: Record<QuestionId, QuestionDefinition>;
}

export type AnswerValue =
  | { type: "yes_no"; value: boolean }
  | { type: "single_choice"; optionId: OptionId; otherText?: string }
  | { type: "multi_choice"; optionIds: OptionId[]; otherText?: string }
  | { type: "short_text"; text: string }
  | { type: "long_text"; text: string }
  | { type: "number"; value: number }
  | { type: "duration"; amount: number; unit: DurationUnit }
  | { type: "info"; acknowledged: true }
  | { type: "end"; acknowledged: true };

export interface AnswerRecord {
  value?: AnswerValue;
  skipped?: boolean;
  interviewerNote?: string;
  updatedAt: string;
}

export type InterviewStatus =
  | "new"
  | "in_progress"
  | "draft"
  | "completed_full"
  | "completed_partial"
  | "stopped"
  | "not_relevant";

export interface InterviewMeta {
  entrepreneurName: string;
  ventureField: string;
  ventureName?: string;
  interviewerName?: string;
  interviewDate: string;
  interviewTime: string;
  location?: string;
  recordingConsent?: boolean;
  /** Optional - for following up with the entrepreneur after the interview. */
  entrepreneurPhone?: string;
}

/** A marker tying a point in the interview's audio recording to the question being asked then. */
export interface RecordingBookmark {
  questionId: QuestionId;
  timeSeconds: number;
}

/**
 * Manual classification of the free-text problem the entrepreneur named in the golden question
 * (`golden_question_core`). The tree already categorizes *questions* into fixed sections, but
 * every entrepreneur answers the golden question in their own words - the app has no way to know
 * that "קשה למצוא שותף טכנולוגי" and "חסר לי CTO שאפשר לסמוך עליו" are the same underlying theme
 * without a human (or an AI service this fully client-side app doesn't have) reading the text.
 * This tag is filled in by the interviewer after the fact so the KPI dashboard can turn free text
 * into a countable "% of interviews whose problem matches what BizMatch solves" number.
 */
export const GOLDEN_QUESTION_THEMES = [
  "partner",
  "investor",
  "trust",
  "liquidity",
  "team",
  "marketing",
  "management",
  "unclear",
  "other",
] as const;
export type GoldenQuestionTheme = (typeof GOLDEN_QUESTION_THEMES)[number];

/**
 * Fixed personal-curation marker for the main interviews list - each color has one specific,
 * fixed meaning (not a free-form label) so a glance across the whole list is enough to read it,
 * the same way a flagged/starred email works. See COLOR_TAG_META for the exact label per color:
 * gold = especially valuable information, green = matches BizMatch's thesis, red = interview
 * that didn't turn out to be very useful.
 */
export const INTERVIEW_COLOR_TAGS = ["gold", "green", "red"] as const;
export type InterviewColorTag = (typeof INTERVIEW_COLOR_TAGS)[number];

export interface InterviewState {
  id: string;
  /** Optional custom display name for the draft list; falls back to entrepreneur/venture name. */
  label?: string;
  meta: InterviewMeta;
  treeVersion: string;
  answers: Record<QuestionId, AnswerRecord>;
  currentQuestionId: QuestionId;
  status: InterviewStatus;
  endReason?: string;
  endedAtQuestionId?: QuestionId;
  createdAt: string;
  updatedAt: string;
  /** Whether an audio recording blob exists for this interview (see RecordingStorageAdapter). */
  hasRecording?: boolean;
  /** Timestamps within the recording, tagged with the question active at that moment. */
  recordingBookmarks?: RecordingBookmark[];
  /** Total recorded duration (seconds) accumulated across every start/stop session for this
   *  interview - lets "continue recording" resume its elapsed-time counter (and thus new
   *  bookmark timestamps) from exactly where the last session left off, instead of restarting
   *  at 0 and landing on top of the existing audio's timestamps once the two are combined. */
  recordingDurationSeconds?: number;
  /** Interviewer's manual classification of the golden-question answer - primary problem, plus an
   *  optional secondary one, each with its own 1-5 weight (importance to solve / pain). See
   *  GoldenQuestionTheme. */
  goldenQuestionPrimaryTheme?: GoldenQuestionTheme;
  /** Free text describing the actual problem when goldenQuestionPrimaryTheme is "other" - lets the
   *  KPI dashboard show this specific problem type instead of lumping it into the generic "אחר"
   *  bucket. Cleared automatically whenever the tag changes away from "other". */
  goldenQuestionPrimaryThemeOtherText?: string;
  /** 1-5 severity: how important/painful this problem is. Defaults to 3 the moment a theme is
   *  first picked (see setGoldenQuestionPrimaryTheme in InterviewStore). */
  goldenQuestionPrimaryWeight?: number;
  goldenQuestionSecondaryTheme?: GoldenQuestionTheme;
  goldenQuestionSecondaryThemeOtherText?: string;
  goldenQuestionSecondaryWeight?: number;
  /** @deprecated superseded by goldenQuestionPrimaryTheme - kept only so interviews saved before
   *  the primary/secondary split still surface their existing tag (see computeKpis.ts). */
  goldenQuestionTheme?: GoldenQuestionTheme;
  /** @deprecated superseded by goldenQuestionPrimaryThemeOtherText. */
  goldenQuestionThemeOtherText?: string;
  /** Fixed-meaning personal marker for the main interviews list - see INTERVIEW_COLOR_TAGS. */
  colorTag?: InterviewColorTag;
}

export interface DraftSummary {
  id: string;
  entrepreneurName: string;
  ventureName?: string;
  ventureField: string;
  interviewDate: string;
  updatedAt: string;
  completionPercent: number;
  status: InterviewStatus;
  colorTag?: InterviewColorTag;
}

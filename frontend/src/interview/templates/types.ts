import type {
  AnswerRecord,
  DurationUnit,
  InterviewMeta,
  QuestionDefinition,
  QuestionId,
  QuestionTree,
} from "../engine/types";

/** The 18 fixed top-level sections every summary document shares, regardless of template. */
export const DOCUMENT_SECTION_IDS = [
  "interview_details",
  "entrepreneur_summary",
  "venture_details",
  "venture_stage",
  "prior_experience",
  "team_structure",
  "entrepreneur_role",
  "partnership_status",
  "partner_search_process",
  "search_channels",
  "difficulties_frustrations",
  "trust_screening",
  "info_exposure_concerns",
  "core_problem",
  "solution_gaps",
  "key_insights",
  "interviewer_notes",
  "missing_info",
] as const;

export type DocumentSectionId = (typeof DOCUMENT_SECTION_IDS)[number];

export const DOCUMENT_SECTION_TITLES: Record<DocumentSectionId, string> = {
  interview_details: "פרטי הראיון",
  entrepreneur_summary: "תקציר היזם",
  venture_details: "פרטי המיזם",
  venture_stage: "שלב המיזם",
  prior_experience: "ניסיון יזמי קודם",
  team_structure: "מבנה הצוות",
  entrepreneur_role: "תפקיד היזם",
  partnership_status: "מצב השותפות",
  partner_search_process: "תהליך חיפוש שותף",
  search_channels: "ערוצי חיפוש",
  difficulties_frustrations: "קשיים ותסכולים",
  trust_screening: "אמון וסינון",
  info_exposure_concerns: "חששות מחשיפת מידע",
  core_problem: "הבעיה המרכזית של היזם",
  solution_gaps: "פערים בפתרונות הקיימים",
  key_insights: "תובנות מרכזיות",
  interviewer_notes: "הערות מראיין המשויכות לשאלות",
  missing_info: "מידע חסר ושאלות שדולגו",
};

export interface TemplateContext {
  tree: QuestionTree;
  answers: Record<QuestionId, AnswerRecord>;
  activePath: QuestionId[];
  meta: InterviewMeta;
  /** Formats an answer for display; returns undefined when unanswered/skipped/missing. */
  text: (questionId: QuestionId) => string | undefined;
  isYes: (questionId: QuestionId) => boolean | undefined;
  optionLabel: (questionId: QuestionId) => string | undefined;
  optionLabels: (questionId: QuestionId) => string[];
  duration: (questionId: QuestionId) => { amount: number; unit: DurationUnit } | undefined;
  /** Groups answers belonging to a repeatable-flow template by instance (e.g. per platform). */
  flowInstances: (
    templateId: string
  ) => { instanceId: string; instanceLabel: string; questions: QuestionDefinition[] }[];
}

export interface SummaryParagraph {
  section: DocumentSectionId;
  /** Lower renders first within the section. */
  order: number;
  render: (ctx: TemplateContext) => string | null | undefined;
}

export interface SummaryTemplate {
  id: string;
  label: string;
  /** Higher priority templates are preferred/merged first when several match. */
  priority: number;
  matches: (ctx: TemplateContext) => boolean;
  paragraphs: SummaryParagraph[];
}

/**
 * ValidationManager - required-field checks for starting an interview and for exporting
 * a summary. Never blocks a *draft* export - only the final/summary export is gated.
 */

import { isQuestionDynamicallyRequired } from "./InterviewEngine";
import type {
  AnswerRecord,
  InterviewMeta,
  QuestionId,
  QuestionTree,
} from "./types";

export function isOpeningMetaValid(meta: Pick<InterviewMeta, "entrepreneurName" | "ventureField">): boolean {
  return meta.entrepreneurName.trim().length > 0 && meta.ventureField.trim().length > 0;
}

export interface SummaryReadiness {
  missingRequired: { id: QuestionId; text: string }[];
  skippedOptional: { id: QuestionId; text: string }[];
  metaMissing: string[];
  canProduceFinalSummary: boolean;
  isPartial: boolean;
}

export function checkSummaryReadiness(
  tree: QuestionTree,
  activePath: QuestionId[],
  answers: Record<QuestionId, AnswerRecord>,
  meta: InterviewMeta
): SummaryReadiness {
  const byId = tree.byId ?? Object.fromEntries(tree.questions.map((q) => [q.id, q]));

  const metaMissing: string[] = [];
  if (!meta.entrepreneurName?.trim()) metaMissing.push("שם היזם");
  if (!meta.ventureField?.trim()) metaMissing.push("תחום המיזם");

  const missingRequired: { id: QuestionId; text: string }[] = [];
  const skippedOptional: { id: QuestionId; text: string }[] = [];

  for (const id of activePath) {
    const question = byId[id];
    if (!question || question.type === "info" || question.type === "end") continue;
    const record = answers[id];
    const answered = Boolean(record && record.value !== undefined);
    const skipped = Boolean(record && record.skipped);

    if (isQuestionDynamicallyRequired(question)) {
      if (!answered) missingRequired.push({ id, text: question.text });
    } else if (skipped) {
      skippedOptional.push({ id, text: question.text });
    }
  }

  const canProduceFinalSummary = metaMissing.length === 0;
  const isPartial = missingRequired.length > 0 || skippedOptional.length > 0;

  return { missingRequired, skippedOptional, metaMissing, canProduceFinalSummary, isPartial };
}

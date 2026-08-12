/**
 * ProgressCalculator - progress is computed strictly from the *current* active path.
 * It intentionally can go down after a new branch opens (more active questions appear) -
 * that is correct behaviour, not a bug.
 */

import { isCountableQuestion } from "./InterviewEngine";
import type {
  AnswerRecord,
  QuestionId,
  QuestionTree,
} from "./types";

export interface ProgressInfo {
  percent: number;
  completedCount: number;
  remainingCount: number;
  totalActiveCount: number;
  currentSectionLabel: string | undefined;
}

export function calculateProgress(
  tree: QuestionTree,
  activePath: QuestionId[],
  answers: Record<QuestionId, AnswerRecord>,
  currentQuestionId: QuestionId | undefined
): ProgressInfo {
  const byId = tree.byId ?? Object.fromEntries(tree.questions.map((q) => [q.id, q]));

  const countableIds = activePath.filter((id) => {
    const q = byId[id];
    return q && isCountableQuestion(q);
  });

  const completedCount = countableIds.filter((id) => {
    const record = answers[id];
    return Boolean(record && (record.skipped || record.value !== undefined));
  }).length;

  const totalActiveCount = countableIds.length;
  const remainingCount = Math.max(totalActiveCount - completedCount, 0);
  const percent =
    totalActiveCount === 0 ? 0 : Math.round((completedCount / totalActiveCount) * 100);

  const currentQuestion = currentQuestionId ? byId[currentQuestionId] : undefined;
  const currentSectionLabel = currentQuestion
    ? tree.sections.find((s) => s.id === currentQuestion.section)?.label
    : undefined;

  return { percent, completedCount, remainingCount, totalActiveCount, currentSectionLabel };
}

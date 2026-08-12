/**
 * NavigationManager - back/forward semantics over the currently active path.
 * Never deletes or mutates answers; purely computes "where should the current pointer move".
 */

import type { QuestionId } from "./types";

export function getPreviousQuestionId(
  activePath: QuestionId[],
  currentQuestionId: QuestionId
): QuestionId | undefined {
  const idx = activePath.indexOf(currentQuestionId);
  if (idx <= 0) return undefined;
  return activePath[idx - 1];
}

export function getNextQuestionId(
  activePath: QuestionId[],
  currentQuestionId: QuestionId
): QuestionId | undefined {
  const idx = activePath.indexOf(currentQuestionId);
  if (idx === -1 || idx >= activePath.length - 1) return undefined;
  return activePath[idx + 1];
}

/**
 * Where the pointer should land right after `answeredId` receives a new answer/skip.
 *
 * Jumps all the way to the current frontier (the active path's last entry) rather than just one
 * step forward: by construction, `computeActivePath` only ever continues past a question that
 * already has a stored answer, so everything between `answeredId` and the frontier is already
 * answered too (e.g. a question pre-filled from the opening screen's meta fields) - stopping on
 * one of those would just show the interviewer something they don't need to act on.
 */
export function getNextAfterAnswering(
  newActivePath: QuestionId[],
  answeredId: QuestionId
): QuestionId {
  const idx = newActivePath.indexOf(answeredId);
  if (idx === -1) return answeredId;
  return newActivePath[newActivePath.length - 1] ?? answeredId;
}

/**
 * A node is reachable by direct navigation (e.g. a Mini Map click) only if it is part of the
 * current active path - i.e. it has already been opened (answered, skipped, or is the current
 * frontier). Future questions that the tree hasn't reached yet are never clickable.
 */
export function isNavigableTo(
  activePath: QuestionId[],
  questionId: QuestionId
): boolean {
  return activePath.includes(questionId);
}

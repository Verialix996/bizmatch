import type { InterviewMeta } from "./types";

/**
 * Substitutes `{שם_המראיין}` in question text with the interviewer name entered on the opening
 * screen. Falls back to a neutral label when no interviewer name was given, so the sentence
 * still reads naturally instead of showing an empty gap.
 */
export function substituteQuestionPlaceholders(text: string, meta: InterviewMeta): string {
  const interviewerName = meta.interviewerName?.trim() || "המראיין";
  return text.replaceAll("{שם_המראיין}", interviewerName);
}

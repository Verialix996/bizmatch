/**
 * TemplateEngine - selects the summary templates whose conditions match the interview state,
 * merges their paragraphs into the 18 fixed document sections (in priority order), and produces
 * a document that never contains `undefined`, `null`, empty variables or leftover placeholders:
 * any paragraph builder that has nothing to say simply returns null/undefined and is dropped.
 */

import { checkSummaryReadiness } from "../engine/ValidationManager";
import type {
  AnswerRecord,
  DurationUnit,
  InterviewMeta,
  QuestionDefinition,
  QuestionId,
  QuestionTree,
} from "../engine/types";
import {
  DOCUMENT_SECTION_IDS,
  DOCUMENT_SECTION_TITLES,
  type DocumentSectionId,
  type SummaryTemplate,
  type TemplateContext,
} from "./types";

const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  minutes: "דקות",
  hours: "שעות",
  days: "ימים",
  months: "חודשים",
  years: "שנים",
};

function formatAnswer(record: AnswerRecord | undefined): string | undefined {
  const value = record?.value;
  if (!value) return undefined;
  switch (value.type) {
    case "yes_no":
      return value.value ? "כן" : "לא";
    case "short_text":
    case "long_text":
      return value.text.trim() || undefined;
    case "number":
      return Number.isFinite(value.value) ? String(value.value) : undefined;
    case "duration":
      return `${value.amount} ${DURATION_UNIT_LABELS[value.unit]}`;
    case "single_choice":
    case "multi_choice":
    case "info":
    case "end":
      return undefined; // handled separately (needs option labels / no display value)
  }
}

function optionLabelOf(question: QuestionDefinition | undefined, optionId: string): string | undefined {
  return question?.options?.find((o) => o.id === optionId)?.label;
}

export function buildTemplateContext(
  tree: QuestionTree,
  answers: Record<QuestionId, AnswerRecord>,
  activePath: QuestionId[],
  meta: InterviewMeta
): TemplateContext {
  const byId = tree.byId ?? Object.fromEntries(tree.questions.map((q) => [q.id, q]));

  const text = (questionId: QuestionId): string | undefined => {
    const record = answers[questionId];
    const question = byId[questionId];
    if (!question || !record || record.value === undefined) return undefined;
    if (record.value.type === "single_choice") {
      const label = optionLabelOf(question, record.value.optionId);
      const other = record.value.optionId === "other" ? record.value.otherText : undefined;
      return other ? `${label ?? "אחר"} (${other})` : label;
    }
    if (record.value.type === "multi_choice") {
      const labels = record.value.optionIds
        .map((id) => optionLabelOf(question, id))
        .filter((l): l is string => Boolean(l));
      if (record.value.otherText) labels.push(`אחר: ${record.value.otherText}`);
      return labels.length > 0 ? labels.join(", ") : undefined;
    }
    return formatAnswer(record);
  };

  const isYes = (questionId: QuestionId): boolean | undefined => {
    const value = answers[questionId]?.value;
    return value?.type === "yes_no" ? value.value : undefined;
  };

  const optionLabel = (questionId: QuestionId): string | undefined => {
    const value = answers[questionId]?.value;
    if (value?.type !== "single_choice") return undefined;
    return optionLabelOf(byId[questionId], value.optionId);
  };

  const optionLabels = (questionId: QuestionId): string[] => {
    const value = answers[questionId]?.value;
    if (value?.type !== "multi_choice") return [];
    return value.optionIds
      .map((id) => optionLabelOf(byId[questionId], id))
      .filter((l): l is string => Boolean(l));
  };

  const duration = (questionId: QuestionId) => {
    const value = answers[questionId]?.value;
    return value?.type === "duration" ? { amount: value.amount, unit: value.unit } : undefined;
  };

  const flowInstances = (templateId: string) => {
    const grouped = new Map<string, { instanceLabel: string; questions: QuestionDefinition[] }>();
    for (const q of tree.questions) {
      if (q.repeatableFlow?.templateId !== templateId) continue;
      const { instanceId, instanceLabel } = q.repeatableFlow;
      if (!grouped.has(instanceId)) grouped.set(instanceId, { instanceLabel, questions: [] });
      grouped.get(instanceId)!.questions.push(q);
    }
    return Array.from(grouped.entries()).map(([instanceId, v]) => ({
      instanceId,
      instanceLabel: v.instanceLabel,
      questions: v.questions.sort((a, b) => a.order - b.order),
    }));
  };

  return { tree, answers, activePath, meta, text, isYes, optionLabel, optionLabels, duration, flowInstances };
}

export function selectMatchingTemplates(
  templates: SummaryTemplate[],
  ctx: TemplateContext
): SummaryTemplate[] {
  return templates
    .filter((t) => t.matches(ctx))
    .sort((a, b) => b.priority - a.priority);
}

export interface SummaryDocumentSection {
  id: DocumentSectionId;
  title: string;
  paragraphs: string[];
}

export interface SummaryDocument {
  sections: SummaryDocumentSection[];
}

function buildSystemParagraphs(ctx: TemplateContext): Partial<Record<DocumentSectionId, string[]>> {
  const { meta, tree, answers, activePath } = ctx;

  const details: string[] = [];
  details.push(`תאריך ריאיון: ${meta.interviewDate} בשעה ${meta.interviewTime}`);
  if (meta.interviewerName) details.push(`מראיין/ת: ${meta.interviewerName}`);
  if (meta.location) details.push(`מקום/אופן ביצוע: ${meta.location}`);
  if (meta.recordingConsent !== undefined) {
    details.push(meta.recordingConsent ? "המרואיין אישר הקלטה." : "המרואיין לא אישר הקלטה.");
  }

  const summaryParts: string[] = [`שם היזם: ${meta.entrepreneurName}`, `תחום המיזם: ${meta.ventureField}`];
  if (meta.ventureName) summaryParts.push(`שם המיזם: ${meta.ventureName}`);
  if (meta.entrepreneurPhone) summaryParts.push(`טלפון ליצירת קשר: ${meta.entrepreneurPhone}`);

  const notes: string[] = [];
  const byId = tree.byId ?? Object.fromEntries(tree.questions.map((q) => [q.id, q]));
  for (const id of activePath) {
    const note = answers[id]?.interviewerNote?.trim();
    if (note) notes.push(`${byId[id]?.text ?? id}: ${note}`);
  }

  const readiness = checkSummaryReadiness(tree, activePath, answers, meta);
  const missing: string[] = [];
  if (readiness.missingRequired.length > 0) {
    missing.push(`שאלות חובה שלא נענו: ${readiness.missingRequired.map((m) => m.text).join("; ")}`);
  }
  if (readiness.skippedOptional.length > 0) {
    missing.push(`שאלות אופציונליות שדולגו: ${readiness.skippedOptional.map((m) => m.text).join("; ")}`);
  }

  return {
    interview_details: details,
    entrepreneur_summary: [summaryParts.join(" | ")],
    interviewer_notes: notes,
    missing_info: missing,
  };
}

export function buildSummaryDocument(
  templates: SummaryTemplate[],
  ctx: TemplateContext
): SummaryDocument {
  const matched = selectMatchingTemplates(templates, ctx);
  const bySection = new Map<DocumentSectionId, string[]>();

  const system = buildSystemParagraphs(ctx);
  for (const id of DOCUMENT_SECTION_IDS) bySection.set(id, [...(system[id] ?? [])]);

  for (const template of matched) {
    const sorted = [...template.paragraphs].sort((a, b) => a.order - b.order);
    for (const paragraph of sorted) {
      const rendered = paragraph.render(ctx);
      if (!rendered || !rendered.trim()) continue; // never emit empty/placeholder content
      bySection.get(paragraph.section)?.push(rendered.trim());
    }
  }

  return {
    sections: DOCUMENT_SECTION_IDS.map((id) => ({
      id,
      title: DOCUMENT_SECTION_TITLES[id],
      paragraphs: bySection.get(id) ?? [],
    })),
  };
}

/**
 * repeatableFlow - a single generic factory for "the same set of follow-up questions, repeated
 * once per selected option" (e.g. the platforms a founder searches for a partner on). Called
 * once per option at data-definition time so the resulting questions are ordinary static tree
 * nodes; the multi-choice question's `multiFlowDispatch` next-spec decides, at runtime, which
 * instances are actually reachable. No per-platform logic is duplicated anywhere.
 */

import type { QuestionDefinition, QuestionOption, QuestionType, SectionId } from "./types";

export interface FlowStepTemplate {
  stepId: string;
  type: QuestionType;
  /** Receives the instance label (e.g. a platform name) so text can reference it naturally. */
  text: (instanceLabel: string) => string;
  options?: QuestionOption[];
  required?: boolean;
  summaryKeySuffix?: string;
  helpText?: string;
}

export interface BuiltFlow {
  entryId: string;
  questions: QuestionDefinition[];
}

export function buildRepeatableFlow(
  templateId: string,
  instanceId: string,
  instanceLabel: string,
  section: SectionId,
  steps: FlowStepTemplate[],
  orderStart: number
): BuiltFlow {
  const idOf = (stepId: string) => `${templateId}__${instanceId}__${stepId}`;

  const questions: QuestionDefinition[] = steps.map((step, index) => {
    const isLast = index === steps.length - 1;
    const nextId = isLast ? null : idOf(steps[index + 1].stepId);

    return {
      id: idOf(step.stepId),
      section,
      type: step.type,
      text: step.text(instanceLabel),
      required: step.required,
      options: step.options,
      order: orderStart + index,
      summaryKey: step.summaryKeySuffix ? `${templateId}.${step.summaryKeySuffix}` : undefined,
      helpText: step.helpText,
      repeatableFlow: { templateId, instanceId, instanceLabel },
      next:
        step.type === "yes_no"
          ? { kind: "yesNo", yes: nextId, no: nextId }
          : { kind: "linear", to: nextId },
    };
  });

  return { entryId: idOf(steps[0].stepId), questions };
}

/**
 * miniMapModel - pure, framework-agnostic computation of what the Mini Map should show.
 * Repeatable-flow instances (e.g. one per selected search platform) are only expanded into their
 * real sub-questions once that option is actually selected - so the interviewer can see and jump
 * to them (they were previously invisible entirely, always collapsed). Unselected options still
 * collapse into a single stub node so the map doesn't explode into dozens of irrelevant nodes for
 * a single multi-choice question.
 */
import {
  computeActivePath,
  resolveQuestionStatus,
} from "./InterviewEngine";
import { isNavigableTo } from "./NavigationManager";
import type { AnswerRecord, QuestionId, QuestionStatus, QuestionTree } from "./types";

export interface MiniMapNodeModel {
  id: string;
  label: string;
  sectionId: string;
  status: QuestionStatus;
  isCurrent: boolean;
  navigable: boolean;
  /** The real question id a click on this node should jump to. */
  targetQuestionId: QuestionId;
  fullText: string;
  /** 0 for an ordinary top-level question; 1 for a node "contained within" another question's
   *  choice (e.g. a platform's sub-questions, nested under the multi-choice that dispatches into
   *  them) - lets the UI indent it so it doesn't read as a sibling of the same level. */
  depth: 0 | 1;
}

export interface MiniMapEdgeModel {
  id: string;
  source: string;
  target: string;
}

export interface MiniMapModel {
  nodes: MiniMapNodeModel[];
  edges: MiniMapEdgeModel[];
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildMiniMapModel(
  tree: QuestionTree,
  answers: Record<QuestionId, AnswerRecord>,
  currentQuestionId: QuestionId | undefined
): MiniMapModel {
  const activePath = computeActivePath(tree, answers);
  const activePathSet = new Set(activePath);

  const nodes: MiniMapNodeModel[] = [];
  const edges: MiniMapEdgeModel[] = [];

  const mainQuestions = tree.questions.filter((q) => !q.repeatableFlow).sort((a, b) => a.order - b.order);

  for (const q of mainQuestions) {
    nodes.push({
      id: q.id,
      label: truncate(q.text, 22),
      sectionId: q.section,
      status: resolveQuestionStatus(q.id, answers, activePathSet),
      isCurrent: q.id === currentQuestionId,
      navigable: isNavigableTo(activePath, q.id),
      targetQuestionId: q.id,
      fullText: q.text,
      depth: 0,
    });

    const spec = q.next;
    if (!spec) continue;

    if (spec.kind === "linear") {
      if (spec.to) edges.push({ id: `${q.id}->${spec.to}`, source: q.id, target: spec.to });
    } else if (spec.kind === "yesNo") {
      if (spec.yes) edges.push({ id: `${q.id}->${spec.yes}:yes`, source: q.id, target: spec.yes });
      if (spec.no) edges.push({ id: `${q.id}->${spec.no}:no`, source: q.id, target: spec.no });
    } else if (spec.kind === "byOption") {
      const targets = new Set([...Object.values(spec.branches), spec.fallback].filter(Boolean) as string[]);
      for (const t of targets) edges.push({ id: `${q.id}->${t}`, source: q.id, target: t });
    } else if (spec.kind === "multiFlowDispatch") {
      const answerValue = answers[q.id]?.value;
      const selectedIds = answerValue?.type === "multi_choice" ? answerValue.optionIds : [];

      for (const option of q.options ?? []) {
        const instanceQuestions = tree.questions
          .filter((iq) => iq.repeatableFlow?.templateId && iq.repeatableFlow.instanceId === option.id)
          .sort((a, b) => a.order - b.order);
        const isSelected = selectedIds.includes(option.id);
        const instanceIds = instanceQuestions.map((iq) => iq.id);
        const hasAnyData = instanceIds.some((id) => {
          const r = answers[id];
          return Boolean(r && (r.value !== undefined || r.skipped));
        });

        if (isSelected && instanceQuestions.length > 0) {
          // Selected - show the real sub-questions (not just a collapsed stub) so the interviewer
          // can see and jump directly to any of them, same as every other question in the tree.
          let previousId: string = q.id;
          for (const iq of instanceQuestions) {
            nodes.push({
              id: iq.id,
              label: truncate(`${option.label}: ${iq.text}`, 26),
              sectionId: q.section,
              status: resolveQuestionStatus(iq.id, answers, activePathSet),
              isCurrent: iq.id === currentQuestionId,
              navigable: isNavigableTo(activePath, iq.id),
              targetQuestionId: iq.id,
              fullText: `${option.label}: ${iq.text}`,
              depth: 1,
            });
            edges.push({ id: `${previousId}->${iq.id}`, source: previousId, target: iq.id });
            previousId = iq.id;
          }
          if (spec.after) edges.push({ id: `${previousId}->${spec.after}`, source: previousId, target: spec.after });
          continue;
        }

        // Not selected (or has no defined flow) - collapse into a single stub so the map doesn't
        // show dozens of irrelevant nodes for platforms the founder never picked.
        const stubId = `${q.id}::${option.id}`;
        const status: QuestionStatus = hasAnyData ? "archived" : "inactive";

        nodes.push({
          id: stubId,
          label: truncate(option.label, 24),
          sectionId: q.section,
          status,
          isCurrent: false,
          navigable: false,
          targetQuestionId: instanceQuestions[0]?.id ?? q.id,
          fullText: `${option.label} - חלק מ"${q.text}"`,
          depth: 1,
        });

        edges.push({ id: `${q.id}->${stubId}`, source: q.id, target: stubId });
        if (spec.after) edges.push({ id: `${stubId}->${spec.after}`, source: stubId, target: spec.after });
      }
    }
  }

  return { nodes, edges };
}

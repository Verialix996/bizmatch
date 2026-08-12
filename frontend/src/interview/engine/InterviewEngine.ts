/**
 * InterviewEngine - the pure decision-tree traversal core.
 *
 * The central idea: nothing about "which branch is active" or "is this question archived"
 * is ever stored as a mutable flag. Every time an answer changes, `computeActivePath` walks
 * the tree again from the root using the current answers, and every question's status is
 * *derived* from whether it lands on that freshly computed path. Answers themselves are never
 * deleted, so navigating back to a branch that had previously been abandoned automatically
 * "un-archives" it - its stored answers simply become live again.
 */

import type {
  AnswerRecord,
  AnswerValue,
  OptionId,
  QuestionDefinition,
  QuestionId,
  QuestionStatus,
  QuestionTree,
} from "./types";

interface FlowContext {
  remainingEntries: QuestionId[];
  after: QuestionId | null;
}

export function getQuestionById(
  tree: QuestionTree,
  id: QuestionId
): QuestionDefinition | undefined {
  return tree.byId ? tree.byId[id] : tree.questions.find((q) => q.id === id);
}

/** Builds an id -> question lookup map once; cheap to memoize by callers. */
export function indexTree(
  tree: QuestionTree
): Record<QuestionId, QuestionDefinition> {
  const byId: Record<QuestionId, QuestionDefinition> = {};
  for (const q of tree.questions) byId[q.id] = q;
  return byId;
}

/** Returns a tree with `byId` populated, computing it once. Safe to call repeatedly. */
export function compileTree(tree: QuestionTree): QuestionTree {
  if (tree.byId) return tree;
  return { ...tree, byId: indexTree(tree) };
}

function answerStatusOf(record: AnswerRecord | undefined): "answered" | "skipped" | "none" {
  if (!record) return "none";
  if (record.skipped) return "skipped";
  if (record.value !== undefined) return "answered";
  return "none";
}

function selectedOptionIds(value: AnswerValue | undefined): OptionId[] {
  if (!value) return [];
  if (value.type === "single_choice") return [value.optionId];
  if (value.type === "multi_choice") return value.optionIds;
  return [];
}

function popStackForNext(stack: FlowContext[]): QuestionId | null {
  while (stack.length > 0) {
    const ctx = stack[stack.length - 1];
    if (ctx.remainingEntries.length > 0) {
      return ctx.remainingEntries.shift()!;
    }
    stack.pop();
    if (ctx.after !== null) return ctx.after;
    // ctx.after is null: keep unwinding further stack levels.
  }
  return null;
}

function resolveNext(
  question: QuestionDefinition,
  record: AnswerRecord | undefined,
  stack: FlowContext[]
): QuestionId | null {
  const spec = question.next;
  if (!spec) return null;

  let nextId: QuestionId | null = null;

  if (spec.kind === "linear") {
    nextId = spec.to;
  } else if (spec.kind === "yesNo") {
    const v = record?.value;
    const yes = v && v.type === "yes_no" ? v.value : undefined;
    nextId = yes === true ? spec.yes : yes === false ? spec.no : null;
  } else if (spec.kind === "byOption") {
    const v = record?.value;
    const optionId = v && v.type === "single_choice" ? v.optionId : undefined;
    nextId =
      optionId !== undefined
        ? (spec.branches[optionId] ?? spec.fallback ?? null)
        : (spec.fallback ?? null);
  } else if (spec.kind === "multiFlowDispatch") {
    const ids = selectedOptionIds(record?.value);
    const entries = ids
      .map((id) => spec.flowEntryByOption[id])
      .filter((id): id is QuestionId => Boolean(id));
    if (entries.length === 0) {
      nextId = spec.after;
    } else {
      const [first, ...rest] = entries;
      stack.push({ remainingEntries: rest, after: spec.after });
      nextId = first;
    }
  }

  if (nextId === null && stack.length > 0) {
    return popStackForNext(stack);
  }
  return nextId;
}

/**
 * Walks the tree from the root following the answers given so far and returns the ordered
 * list of currently-active question ids. Traversal stops at the first question that has
 * neither an answer nor a skip recorded - that is the current "frontier".
 */
export function computeActivePath(
  tree: QuestionTree,
  answers: Record<QuestionId, AnswerRecord>
): QuestionId[] {
  const byId = tree.byId ?? indexTree(tree);
  const path: QuestionId[] = [];
  const stack: FlowContext[] = [];
  const seen = new Set<QuestionId>();

  let currentId: QuestionId | null = tree.rootId;

  while (currentId !== null) {
    if (seen.has(currentId)) break; // guard against accidental cycles in hand-authored data
    seen.add(currentId);

    const question = byId[currentId];
    if (!question) break;
    path.push(currentId);

    const status = answerStatusOf(answers[currentId]);
    if (status === "none") break;

    let nextId = resolveNext(question, answers[currentId], stack);
    while (nextId === null && stack.length > 0) {
      nextId = popStackForNext(stack);
    }
    currentId = nextId;
  }

  return path;
}

/**
 * A question's status is always derived from (a) whether it is on the current active path and
 * (b) whether it has stored answer data - never from a persisted flag.
 */
export function resolveQuestionStatus(
  questionId: QuestionId,
  answers: Record<QuestionId, AnswerRecord>,
  activePathSet: Set<QuestionId>
): QuestionStatus {
  const record = answers[questionId];
  const inActivePath = activePathSet.has(questionId);
  const hasData = Boolean(record && (record.skipped || record.value !== undefined));

  if (inActivePath) {
    if (record?.skipped) return "skipped";
    if (record?.value !== undefined) return "answered";
    return "unanswered";
  }
  return hasData ? "archived" : "inactive";
}

export function isQuestionDynamicallyRequired(question: QuestionDefinition): boolean {
  return Boolean(question.required) || question.type === "yes_no";
}

export function getCurrentFrontierId(activePath: QuestionId[]): QuestionId | undefined {
  return activePath[activePath.length - 1];
}

/** Real, counted questions exclude interviewer-only info screens and the terminal end node. */
export function isCountableQuestion(question: QuestionDefinition): boolean {
  return question.type !== "info" && question.type !== "end";
}

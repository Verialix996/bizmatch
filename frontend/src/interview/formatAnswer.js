// Renders one answer record as plain text — used by both the runner's completed-interview
// review and the Summary screen. Mirrors the record shapes recordAnswer()/skipQuestion()
// produce (value.type discriminates, or a bare `skipped` flag).
export function formatAnswerForReview(question, record) {
  if (!record) return '—';
  if (record.skipped) return 'Skipped';
  const v = record.value;
  if (!v) return '—';
  switch (v.type) {
    case 'yes_no': return v.value ? 'Yes' : 'No';
    case 'single_choice': {
      const opt = (question.options || []).find((o) => o.id === v.optionId);
      return opt?.label || v.optionId;
    }
    case 'multi_choice': {
      const labels = (v.optionIds || []).map((id) => (question.options || []).find((o) => o.id === id)?.label || id);
      return labels.length ? labels.join(', ') : '—';
    }
    case 'short_text':
    case 'long_text':
      return v.text?.trim() || '—';
    case 'number':
      return String(v.value ?? '—');
    case 'duration':
      return `${v.amount ?? '—'} ${v.unit || ''}`.trim();
    default:
      return '—';
  }
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Buckets chronologically-sorted bookmarks by the section their question belongs to, so the
// list reads as a topic outline instead of a flat timeline. Groups are emitted in the order
// their first bookmark occurred.
export function groupBookmarksBySection(tree, bookmarks) {
  const groups = new Map();
  for (const bookmark of bookmarks) {
    const sectionId = tree.byId?.[bookmark.questionId]?.section ?? '';
    if (!groups.has(sectionId)) {
      const sectionLabel = tree.sections.find((s) => s.id === sectionId)?.label ?? sectionId;
      groups.set(sectionId, { sectionId, sectionLabel, bookmarks: [] });
    }
    groups.get(sectionId).bookmarks.push(bookmark);
  }
  return Array.from(groups.values());
}

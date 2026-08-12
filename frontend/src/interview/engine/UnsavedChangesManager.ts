/**
 * UnsavedChangesManager - tracks whether the in-memory interview state has changes that have
 * not yet been persisted, and warns the user before anything destructive would discard them
 * (closing the tab, loading a JSON file over an open interview, resetting the interview).
 */

export function computeIsDirty(lastSavedAt: string | null, updatedAt: string): boolean {
  if (!lastSavedAt) return true;
  return new Date(updatedAt).getTime() > new Date(lastSavedAt).getTime();
}

/** Client-only: registers a `beforeunload` warning while `getIsDirty()` returns true. */
export function attachBeforeUnloadWarning(getIsDirty: () => boolean): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (event: BeforeUnloadEvent) => {
    if (!getIsDirty()) return;
    event.preventDefault();
    event.returnValue = "";
  };

  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}

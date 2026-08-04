// deno-lint-ignore no-explicit-any
const edgeRuntime = (globalThis as any).EdgeRuntime;

// Lets a fire-and-forget promise keep running after the response is sent.
// Falls back to a plain unawaited call (best-effort) when EdgeRuntime isn't
// present, e.g. local `deno test` — never throws.
export function background(promise: Promise<unknown>): void {
  const guarded = promise.catch((err) => console.error("[background]", err));
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(guarded);
  }
}

// Plain fetch to the Gemini REST API instead of the @google/generative-ai SDK —
// avoids npm-in-Deno SDK compatibility risk for what's just a single POST call.
//
// The free tier's request quota is per-project-PER-MODEL-per-day, not a single
// shared bucket — so when one model is exhausted, a different model name still
// has its own untouched allowance. generateText() tries each model in
// MODEL_CHAIN in order and only fails once all of them have been exhausted.
const MODEL_CHAIN = (Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest,gemini-2.5-flash-lite,gemini-2.0-flash-lite,gemini-flash-lite-latest,gemini-pro-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

// Statuses that mean "this model can't serve the request right now" (quota
// exhausted, model unavailable/renamed, overloaded) — worth trying the next
// model in the chain. Anything else (400 bad request, 401/403 auth) will fail
// identically on every model, so those throw immediately instead of burning
// through the whole chain for nothing.
const RETRYABLE_STATUSES = new Set([404, 429, 500, 503]);

export function isGeminiConfigured(): boolean {
  return !!Deno.env.get("GEMINI_API_KEY");
}

interface GenerateOptions {
  model?: string;
  inlineData?: { mimeType: string; data: string };
}

async function callModel(
  model: string,
  key: string,
  parts: unknown[],
): Promise<{ ok: true; text: string } | { ok: false; status: number; body: string }> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, body: await res.text() };
  }
  const json = await res.json();
  return { ok: true, text: (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim() };
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const parts: unknown[] = [];
  if (opts.inlineData) parts.push({ inlineData: opts.inlineData });
  parts.push({ text: prompt });

  // An explicit model override (opts.model) is used as-is, no fallback chain —
  // callers that pin a specific model presumably have a reason to.
  const chain = opts.model ? [opts.model] : MODEL_CHAIN;

  let lastError: string | null = null;
  for (const model of chain) {
    const result = await callModel(model, key, parts);
    if (result.ok) return result.text;
    lastError = `Gemini API error ${result.status} (model ${model}): ${result.body}`;
    if (!RETRYABLE_STATUSES.has(result.status)) throw new Error(lastError);
    console.warn(`[gemini] ${model} unavailable (${result.status}), trying next model in chain`);
  }
  throw new Error(lastError ?? "Gemini API error: no models configured");
}

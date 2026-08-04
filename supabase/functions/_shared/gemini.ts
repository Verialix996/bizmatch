// Plain fetch to the Gemini REST API instead of the @google/generative-ai SDK —
// avoids npm-in-Deno SDK compatibility risk for what's just a single POST call.
const DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";

export function isGeminiConfigured(): boolean {
  return !!Deno.env.get("GEMINI_API_KEY");
}

interface GenerateOptions {
  model?: string;
  inlineData?: { mimeType: string; data: string };
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const model = opts.model ?? DEFAULT_MODEL;

  const parts: unknown[] = [];
  if (opts.inlineData) parts.push({ inlineData: opts.inlineData });
  parts.push({ text: prompt });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  );
  if (!res.ok) {
    throw new Error(`Gemini API error ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

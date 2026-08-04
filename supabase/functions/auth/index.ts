import { moderateText } from "../_shared/moderation.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { checkRateLimit, clientIp } from "../_shared/rateLimit.ts";

const FN = "auth";

// POST /functions/v1/auth/precheck-name — called by the client immediately
// before supabase.auth.signUp, since Supabase has no pre-insert hook for
// custom validation. Registration/login/verification/reset/OAuth are all
// handled directly by the Supabase Auth client SDK — this is the only
// server-side check left.
async function precheckName(req: Request): Promise<Response> {
  const ip = clientIp(req);
  if (!(await checkRateLimit(`auth:${ip}`, 50, 15 * 60 * 1000))) {
    return json({ error: "Too many auth attempts, please try again later." }, 429);
  }

  const body = await req.json().catch(() => ({}));
  const name = (body as { name?: string }).name;
  if (!name || !name.trim()) {
    return json({ error: "Name is required" }, 400);
  }
  const mod = moderateText(name.trim());
  if (!mod.ok) return json({ error: `Name flagged by moderation: ${mod.reason}` }, 400);
  return json({ ok: true });
}

serveFunction(FN, [
  route(FN, "POST", "/precheck-name", precheckName),
]);

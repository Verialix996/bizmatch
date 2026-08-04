import { corsHeaders } from "./cors.ts";
import { json } from "./respond.ts";
import { Route, dispatch } from "./router.ts";
import { checkRateLimit, clientIp } from "./rateLimit.ts";

// Shared Deno.serve wrapper for every function: CORS on every response
// (including errors), the global rate limit, route dispatch, and a
// catch-all 500/404 — replaces app.js's middleware stack.
export function serveFunction(functionName: string, routes: Route[]): void {
  Deno.serve(async (req) => {
    const cors = corsHeaders(req);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    const attach = (res: Response) => {
      cors.forEach((v, k) => res.headers.set(k, v));
      return res;
    };

    try {
      const ip = clientIp(req);
      if (!(await checkRateLimit(`api:${ip}`, 3000, 15 * 60 * 1000))) {
        return attach(json({ error: "Too many requests, please try again later." }, 429));
      }

      const res = await dispatch(functionName, routes, req);
      return attach(res ?? json({ error: "Route not found" }, 404));
    } catch (err) {
      console.error(err);
      return attach(json({ error: (err as Error).message ?? "Internal server error" }, 500));
    }
  });
}

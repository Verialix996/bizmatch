// Tiny path-based dispatcher — Edge Functions have no Express Router, so each
// function's index.ts defines its own route table and calls dispatch().
//
// Supabase's Edge Runtime is inconsistent about whether req.url includes the
// "/functions/v1/<name>" prefix (varies between local `functions serve` and
// deployed instances) — so instead of matching an absolute path, we locate
// the function's own name in the pathname and match everything after it.
export type Handler = (req: Request, params: Record<string, string>) => Promise<Response>;

export interface Route {
  method: string;
  pattern: URLPattern;
  handler: Handler;
}

export function route(functionName: string, method: string, path: string, handler: Handler): Route {
  return {
    method,
    // Relative pattern (baseURL supplied at match time) — the leading slash
    // makes it match against just the subpath, not the full request path.
    pattern: new URLPattern({ pathname: path === "" ? "/" : path }),
    handler,
  };
}

function subpath(url: URL, functionName: string): string {
  const marker = `/${functionName}`;
  const idx = url.pathname.indexOf(marker);
  const rest = idx === -1 ? url.pathname : url.pathname.slice(idx + marker.length);
  return rest === "" ? "/" : rest;
}

export async function dispatch(functionName: string, routes: Route[], req: Request): Promise<Response | null> {
  const url = new URL(req.url);
  const rel = subpath(url, functionName);
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const match = r.pattern.exec({ pathname: rel });
    if (match) {
      return await r.handler(req, match.pathname.groups as Record<string, string>);
    }
  }
  return null;
}

import { json } from "../_shared/respond.ts";

// Supabase Auth "Send Email" hook target. Registered in the Dashboard under
// Authentication -> Hooks, not via _shared/serve.ts: this is called
// server-to-server by Supabase itself (Standard Webhooks signature, not a
// user JWT), so it deliberately skips serveFunction()'s CORS/user-rate-limit
// wrapper and the router. Taking over delivery here bypasses Supabase's
// built-in mailer and its low default send rate.
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("SEND_EMAIL_FROM") ?? "BizMatch <onboarding@resend.dev>";

interface HookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: "signup" | "recovery" | "email_change" | "magiclink" | "invite" | "reauthentication";
    site_url: string;
  };
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatureHeader = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader || !HOOK_SECRET) return false;

  const secretBytes = base64Decode(HOOK_SECRET.trim().replace(/^v1,/, "").replace(/^whsec_/, ""));
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = base64Encode(new Uint8Array(sigBytes));

  return signatureHeader
    .split(" ")
    .some((part) => part.split(",")[1] === expected);
}

function base64Decode(b64: string): Uint8Array {
  // Standard Webhooks secrets are sometimes URL-safe base64 (- and _) and/or
  // unpadded; atob() only accepts standard base64, so normalize first.
  let normalized = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const bin = atob(normalized);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const ACTION_COPY: Record<string, { subject: string; heading: string; body: string }> = {
  signup: {
    subject: "Confirm your BizMatch account",
    heading: "Confirm your email",
    body: "Enter this code in the app to finish creating your account:",
  },
  recovery: {
    subject: "Reset your BizMatch password",
    heading: "Reset your password",
    body: "Enter this code in the app to reset your password:",
  },
  email_change: {
    subject: "Confirm your new email",
    heading: "Confirm your new email",
    body: "Enter this code in the app to confirm your new email address:",
  },
  magiclink: {
    subject: "Your BizMatch sign-in code",
    heading: "Sign in to BizMatch",
    body: "Enter this code in the app to sign in:",
  },
  invite: {
    subject: "You've been invited to BizMatch",
    heading: "You're invited",
    body: "Enter this code in the app to accept your invite:",
  },
  reauthentication: {
    subject: "Confirm it's you",
    heading: "Confirm it's you",
    body: "Enter this code to continue:",
  },
};

// Password reset is the one flow the frontend drives via a redirect link
// (ForgotPasswordScreen -> resetPasswordForEmail -> Supabase session picked up
// from the URL) rather than a code the user types in, so it needs a real link.
const LINK_ACTIONS = new Set(["recovery"]);

function renderEmail(
  actionType: string,
  token: string,
  tokenHash: string,
  siteUrl: string,
  redirectTo: string,
): { subject: string; html: string } {
  const copy = ACTION_COPY[actionType] ?? ACTION_COPY.signup;

  if (LINK_ACTIONS.has(actionType)) {
    const verifyUrl = `${siteUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(actionType)}&redirect_to=${encodeURIComponent(redirectTo)}`;
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
        <h1 style="color: #1e3a8a; font-size: 20px;">${copy.heading}</h1>
        <p style="color: #333; font-size: 15px;">${copy.body.replace("Enter this code in the app to", "Click the button below to")}</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #1e3a8a; color: #fff; font-weight: 600; padding: 14px 28px; border-radius: 8px; text-decoration: none;">Reset password</a>
        </div>
        <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>`;
    return { subject: copy.subject, html };
  }

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="color: #1e3a8a; font-size: 20px;">${copy.heading}</h1>
      <p style="color: #333; font-size: 15px;">${copy.body}</p>
      <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; background: #f1f5f9; padding: 16px 24px; border-radius: 8px; text-align: center; margin: 24px 0;">${token}</div>
      <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
    </div>`;
  return { subject: copy.subject, html };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: { http_code: 405, message: "Method not allowed" } }, 405);

    const rawBody = await req.text();

    if (!HOOK_SECRET) {
      console.error("[send-email] SEND_EMAIL_HOOK_SECRET not configured");
      return json({ error: { http_code: 500, message: "SEND_EMAIL_HOOK_SECRET not configured" } }, 500);
    }
    if (!(await verifySignature(req, rawBody))) {
      console.error("[send-email] signature verification failed", {
        hasId: !!req.headers.get("webhook-id"),
        hasTimestamp: !!req.headers.get("webhook-timestamp"),
        hasSignature: !!req.headers.get("webhook-signature"),
      });
      return json({ error: { http_code: 401, message: "Invalid webhook signature" } }, 401);
    }

    if (!RESEND_API_KEY) {
      console.error("[send-email] RESEND_API_KEY not configured");
      return json({ error: { http_code: 500, message: "RESEND_API_KEY not configured" } }, 500);
    }

    let payload: HookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return json({ error: { http_code: 400, message: "Invalid JSON payload" } }, 400);
    }

    const { subject, html } = renderEmail(
      payload.email_data.email_action_type,
      payload.email_data.token,
      payload.email_data.token_hash,
      payload.email_data.site_url,
      payload.email_data.redirect_to,
    );

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [payload.user.email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[send-email] Resend error", res.status, detail);
      return json({ error: { http_code: 500, message: "Failed to send email" } }, 500);
    }

    return json({});
  } catch (err) {
    console.error("[send-email] unhandled error", err);
    return json({ error: { http_code: 500, message: (err as Error).message ?? "Internal error" } }, 500);
  }
});

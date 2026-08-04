import { authenticate, requireVerified, requireAdmin } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { moderateText } from "../_shared/moderation.ts";
import { uploadBuffer, BUCKETS } from "../_shared/storage.ts";
import { UserModel } from "./model.ts";

const FN = "users";

function omitPasswordHash(user: Record<string, unknown>) {
  const { password_hash: _password_hash, ...safe } = user;
  return safe;
}

// GET /functions/v1/users/me
async function getMe(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  // has_seen_onboarding lives on user_activity, not users — the frontend reads
  // it off this response to decide whether to show the onboarding walkthrough.
  const activityRows = await query<{ has_seen_onboarding: boolean }>(
    "SELECT has_seen_onboarding FROM user_activity WHERE user_id = $1",
    [user.id],
  );
  return json({ ...omitPasswordHash(user), has_seen_onboarding: activityRows[0]?.has_seen_onboarding ?? false });
}

// PATCH /functions/v1/users/me  { name }
async function updateMe(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const body = await req.json().catch(() => ({}));
  const { name } = body as { name?: string };
  if (!name || !name.trim()) return json({ error: "Name cannot be empty." }, 400);

  const mod = moderateText(name.trim());
  if (!mod.ok) return json({ error: `Name flagged by moderation: ${mod.reason}` }, 400);

  await UserModel.updateName(user.id, name.trim());
  return json({ name: name.trim() });
}

// DELETE /functions/v1/users/me
async function deleteAccount(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  await UserModel.hardDelete(user.id);
  return json({ message: "Account deleted" });
}

// GET /functions/v1/users/:id
async function getUser(req: Request, params: Record<string, string>): Promise<Response> {
  const authed = await authenticate(req);
  if (!authed) return json({ error: "Unauthorized" }, 401);

  const target = await UserModel.findById(params.id) as Record<string, unknown> | null;
  if (!target) return json({ error: "User not found" }, 404);
  return json(omitPasswordHash(target));
}

// PATCH /functions/v1/users/:id/verification  (admin)  { status }
async function setVerificationStatus(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };
  await UserModel.setVerificationStatus(params.id, status ?? "pending");
  return json({ message: "Verification status updated" });
}

// PATCH /functions/v1/users/me/role  { role }
async function setRole(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { role } = body as { role?: string };
  if (!role || !["entrepreneur", "investor"].includes(role)) {
    return json({ error: "role must be entrepreneur or investor" }, 400);
  }
  await UserModel.setRole(user.id, role);
  return json({ role });
}

// POST /functions/v1/users/me/photo  { photo: base64 data URI }
async function uploadPhoto(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { photo } = body as { photo?: string };
  if (!photo) return json({ error: "No image provided" }, 400);

  const match = /^data:(image\/(?:jpe?g|png));base64,(.+)$/.exec(photo);
  if (!match) return json({ error: "Image must be a base64 JPEG or PNG data URI" }, 400);
  const [, mimeType, base64Data] = match;
  const buffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const ext = mimeType === "image/png" ? "png" : "jpg";

  const url = await uploadBuffer(BUCKETS.photo, `${user.id}-${Date.now()}.${ext}`, buffer, mimeType);
  await UserModel.updatePhoto(user.id, url);
  return json({ photo_url: url });
}

// PATCH /functions/v1/users/me/push-token  { pushToken }
async function savePushToken(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { pushToken } = body as { pushToken?: string };
  if (!pushToken) return json({ error: "pushToken required" }, 400);

  await query("UPDATE user_activity SET push_token = $1 WHERE user_id = $2", [pushToken, user.id]);
  return json({ ok: true });
}

// POST /functions/v1/users/me/premium/activate
async function activatePremium(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const rows = await query<{ premium_expires_at: string }>(
    "UPDATE users SET is_premium = true, premium_expires_at = now() + interval '30 days' WHERE id = $1 RETURNING premium_expires_at",
    [user.id],
  );
  return json({ ok: true, expiresAt: rows[0].premium_expires_at });
}

// GET /functions/v1/users/me/who-liked-me  (premium only)
async function whoLikedMe(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const isPremium = user.is_premium && user.premium_expires_at && new Date(user.premium_expires_at as string) > new Date();
  if (!isPremium) return json({ error: "Premium required" }, 403);

  const rows = await query(
    `SELECT u.id, u.name, u.photo_url AS "photoUrl", s.is_super_like AS "isSuperLike"
     FROM swipes s
     JOIN users u ON u.id = s.swiper_id
     WHERE s.swiped_id = $1 AND s.direction = 'like' AND u.deleted_at IS NULL`,
    [user.id],
  );
  return json(rows);
}

// DELETE /functions/v1/users/me/premium
async function cancelPremium(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  await query("UPDATE users SET is_premium = false, premium_expires_at = NULL WHERE id = $1", [user.id]);
  return json({ ok: true });
}

// POST /functions/v1/users/me/verify-self — skip ID review, mark verified instantly (demo)
async function verifySelf(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  await query("UPDATE users SET verification_status = 'verified' WHERE id = $1", [user.id]);
  return json({ ok: true, verification_status: "verified" });
}

// PATCH /functions/v1/users/me/onboarding
async function markOnboardingSeen(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  await UserModel.setHasSeenOnboarding(user.id);
  return json({ ok: true });
}

serveFunction(FN, [
  // /me* routes must be registered before the /:id catch-all
  route(FN, "GET", "/me", getMe),
  route(FN, "PATCH", "/me", updateMe),
  route(FN, "DELETE", "/me", deleteAccount),
  route(FN, "PATCH", "/me/role", setRole),
  route(FN, "POST", "/me/photo", uploadPhoto),
  route(FN, "PATCH", "/me/push-token", savePushToken),
  route(FN, "PATCH", "/me/onboarding", markOnboardingSeen),
  route(FN, "POST", "/me/premium/activate", activatePremium),
  route(FN, "DELETE", "/me/premium", cancelPremium),
  route(FN, "GET", "/me/who-liked-me", whoLikedMe),
  route(FN, "POST", "/me/verify-self", verifySelf),
  route(FN, "PATCH", "/:id/verification", setVerificationStatus),
  route(FN, "GET", "/:id", getUser),
]);

import { authenticate, requireVerified } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { moderateText } from "../_shared/moderation.ts";
import { uploadBuffer, BUCKETS } from "../_shared/storage.ts";
import { background } from "../_shared/background.ts";
import { preScoreUser } from "../_shared/matchModel.ts";
import { ProfileModel } from "./model.ts";

const FN = "profile";
const MB = 1024 * 1024;

// GET /functions/v1/profile/public/:userId
async function getPublicProfile(req: Request, params: Record<string, string>): Promise<Response> {
  const authed = await authenticate(req);
  if (!authed) return json({ error: "Unauthorized" }, 401);

  const targetId = params.userId;
  if (!targetId) return json({ error: "userId required" }, 400);

  const rows = await query<Record<string, unknown>>(
    `SELECT u.id, u.name, u.photo_url, u.role, u.is_premium, u.premium_expires_at,
            u.bio, u.skills, u.hobbies, ip.investment_domain,
            ip.preferred_stage, ip.max_investment,
            proj.stage AS venture_stage, proj.funding_needed AS funding_needs
     FROM users u
     LEFT JOIN investor_profiles ip ON ip.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT t.stage, t.funding_needed
       FROM team_members tm JOIN teams t ON t.id = tm.team_id AND t.is_active = true
       WHERE tm.user_id = u.id AND tm.status = 'accepted'
       ORDER BY t.created_at DESC LIMIT 1
     ) proj ON true
     WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [targetId],
  );
  const row = rows[0];
  if (!row) return json({ error: "User not found" }, 404);

  return json({
    userId: row.id,
    name: row.name,
    photoUrl: row.photo_url,
    role: row.role,
    isPremium: !!(row.is_premium && row.premium_expires_at && new Date(row.premium_expires_at as string) > new Date()),
    bio: row.bio || null,
    skills: row.skills || [],
    hobbies: row.hobbies || [],
    investmentDomain: row.investment_domain || null,
    preferredStage: row.preferred_stage || null,
    maxInvestment: row.max_investment || null,
    ventureStage: row.venture_stage || null,
    fundingNeeds: row.funding_needs || null,
  });
}

// GET /functions/v1/profile
async function getMyProfile(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const profile = await ProfileModel.findByUserId(user.id);
  return json(profile || {});
}

async function moderateProfileFields(body: Record<string, unknown>): Promise<string | null> {
  if (body.bio) {
    const mod = moderateText(body.bio as string);
    if (!mod.ok) return `Bio flagged by moderation: ${mod.reason}`;
  }
  if (body.experience) {
    const mod = moderateText(body.experience as string);
    if (!mod.ok) return `Experience flagged by moderation: ${mod.reason}`;
  }
  if (body.skills) {
    const skillsText = Array.isArray(body.skills) ? (body.skills as string[]).join(" ") : String(body.skills);
    const mod = moderateText(skillsText);
    if (!mod.ok) return `Skills flagged by moderation: ${mod.reason}`;
  }
  return null;
}

// POST /functions/v1/profile
async function createProfile(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const body = await req.json().catch(() => ({}));
  const modError = await moderateProfileFields(body);
  if (modError) return json({ error: modError }, 400);

  const profile = await ProfileModel.create(user.id, { ...body, role_type: user.role });
  background(preScoreUser(user.id));
  return json(profile, 201);
}

// PUT /functions/v1/profile
async function updateProfile(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const body = await req.json().catch(() => ({}));
  const modError = await moderateProfileFields(body);
  if (modError) return json({ error: modError }, 400);

  await ProfileModel.update(user.id, { ...body, role_type: user.role });
  // Re-enter user into the match pool by clearing pass swipes targeting them
  await query("DELETE FROM swipes WHERE swiped_id = $1 AND direction = 'pass'", [user.id]);
  background(preScoreUser(user.id));
  return json({ message: "Profile updated" });
}

// POST /functions/v1/profile/upload-cv
async function uploadCv(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const form = await req.formData();
  const file = form.get("cv") as File | null;
  if (!file) return json({ error: "No file uploaded" }, 400);
  if (file.size > 20 * MB) return json({ error: "File too large" }, 413);

  const buffer = new Uint8Array(await file.arrayBuffer());
  const url = await uploadBuffer(BUCKETS.cv, `${user.id}-${Date.now()}.pdf`, buffer, "application/pdf");
  await query("UPDATE users SET cv_url = $1 WHERE id = $2", [url, user.id]);
  return json({ cv_url: url });
}

// GET /functions/v1/profile/cv — proxy from Supabase Storage with correct Content-Type
async function serveCv(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const rows = await query<{ cv_url: string | null }>("SELECT cv_url FROM users WHERE id = $1", [user.id]);
  const cvUrl = rows[0]?.cv_url;
  if (!cvUrl) return json({ error: "No CV uploaded" }, 404);

  const response = await fetch(cvUrl);
  if (!response.ok) return json({ error: "Failed to fetch CV from storage" }, 502);
  const buf = await response.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="cv.pdf"',
    },
  });
}

serveFunction(FN, [
  route(FN, "GET", "/public/:userId", getPublicProfile),
  route(FN, "GET", "/cv", serveCv),
  route(FN, "POST", "/upload-cv", uploadCv),
  route(FN, "GET", "", getMyProfile),
  route(FN, "POST", "", createProfile),
  route(FN, "PUT", "", updateProfile),
]);

import { query } from "./db.ts";
import {
  computeAllDimensionScores,
  computeTeamDimensionScores,
  computeTeamProfile,
  DIMENSIONS,
  type CompatibilityResult,
  type EvidenceDimension,
  type EvidenceRow,
  type TeamMemberInput,
  type TeamProfile,
} from "./founderScoring.ts";

// Shared by the `teams` Edge Function. Mirrors dnaRecompute.ts/
// matchRecompute.ts's placement: fetch rows, call the pure functions in
// founderScoring.ts, persist/return. Team Profile (MVP screen 10) reads a
// fresh computation on every GET (same as founder-dna's insights read);
// team_dna_snapshots is only written on an explicit recompute, for future
// Profile-Evolution-style history.

interface TeamMemberBasic {
  id: string;
  name: string | null;
  photoUrl: string | null;
  roleTitle: string | null;
}

async function fetchTeamMembers(teamId: number): Promise<TeamMemberBasic[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT u.id, u.name, u.photo_url, fp.role_title
     FROM team_founders tf
     JOIN users u ON u.id = tf.founder_id
     LEFT JOIN founder_profiles fp ON fp.user_id = u.id
     WHERE tf.team_id = $1
     ORDER BY tf.joined_at`,
    [teamId],
  );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string | null,
    photoUrl: r.photo_url as string | null,
    roleTitle: r.role_title as string | null,
  }));
}

async function fetchTeamMemberInputs(memberIds: string[]): Promise<TeamMemberInput[]> {
  const inputs: TeamMemberInput[] = [];
  for (const founderId of memberIds) {
    const evidenceRows = await query<Record<string, unknown>>(
      `SELECT dimension, source_type, score, weight, is_negative FROM evidence WHERE founder_id = $1`,
      [founderId],
    );
    const evidence: EvidenceRow[] = evidenceRows.map((r) => ({
      dimension: r.dimension as EvidenceDimension,
      source_type: r.source_type as EvidenceRow["source_type"],
      score: Number(r.score),
      weight: Number(r.weight),
      is_negative: !!r.is_negative,
    }));
    const capabilityRows = await query<{ kind: "provide" | "need"; capability: string }>(
      `SELECT kind, capability FROM founder_capabilities WHERE founder_id = $1`,
      [founderId],
    );
    inputs.push({ founderId, dimensions: computeAllDimensionScores(evidence), capabilities: capabilityRows });
  }
  return inputs;
}

// Reads whatever pairwise compatibility has already been cached for this
// team's members (from the `matches` function's background recompute) —
// doesn't recompute pairwise scores itself, matching computeTeamProfile's
// division of labor.
async function fetchPairwiseCompatibility(memberIds: string[]): Promise<CompatibilityResult[]> {
  if (memberIds.length < 2) return [];
  const rows = await query<Record<string, unknown>>(
    `SELECT score, dimension_breakdown, explanation, deal_breaker_flags, requires_admin_review
     FROM founder_compatibility
     WHERE founder_a_id = ANY($1::uuid[]) AND founder_b_id = ANY($1::uuid[])`,
    [memberIds],
  );
  return rows.map((r) => ({
    score: Number(r.score),
    dimensionBreakdown: r.dimension_breakdown as CompatibilityResult["dimensionBreakdown"],
    explanation: r.explanation as CompatibilityResult["explanation"],
    dealBreakerFlags: r.deal_breaker_flags as string[],
    requiresAdminReview: !!r.requires_admin_review,
  }));
}

export interface TeamInsights {
  members: TeamMemberBasic[];
  profile: TeamProfile;
}

export async function computeTeamInsights(teamId: number): Promise<TeamInsights> {
  const members = await fetchTeamMembers(teamId);
  const memberInputs = await fetchTeamMemberInputs(members.map((m) => m.id));
  const pairwise = await fetchPairwiseCompatibility(members.map((m) => m.id));
  const profile = computeTeamProfile(memberInputs, pairwise);
  return { members, profile };
}

// Preview a not-yet-created team's profile from a candidate member list
// (MVP screen 9 — Team Creation's "compatibility/skills/gaps summary before
// creating"), without persisting anything.
export async function previewTeamProfile(founderIds: string[]): Promise<TeamProfile> {
  const memberInputs = await fetchTeamMemberInputs(founderIds);
  const pairwise = await fetchPairwiseCompatibility(founderIds);
  return computeTeamProfile(memberInputs, pairwise);
}

export async function recomputeTeamDna(teamId: number): Promise<void> {
  const members = await fetchTeamMembers(teamId);
  const memberInputs = await fetchTeamMemberInputs(members.map((m) => m.id));
  const results = computeTeamDimensionScores(memberInputs);

  for (const dimension of DIMENSIONS) {
    const r = results[dimension];
    await query(
      `INSERT INTO team_dna_snapshots (team_id, dimension, score, confidence) VALUES ($1, $2, $3, $4)`,
      [teamId, dimension, r.score, r.confidence],
    );
  }
}

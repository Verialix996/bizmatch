import { query } from "../_shared/db.ts";

export interface Team {
  id: number;
  name: string;
  creator_id: string;
  stage: string | null;
  industry: string | null;
  funding_needed: number | null;
  is_active: boolean;
}

export async function createTeam(
  creatorId: string,
  data: { name: string; stage?: string; industry?: string; fundingNeeded?: number },
): Promise<Team> {
  const rows = await query<Team>(
    `INSERT INTO teams (name, creator_id, stage, industry, funding_needed)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, creatorId, data.stage || null, data.industry || null, data.fundingNeeded || null],
  );
  const team = rows[0];
  await query(
    `INSERT INTO team_members (team_id, user_id, invited_by_id, status, responded_at)
     VALUES ($1, $2, $2, 'accepted', now())`,
    [team.id, creatorId],
  );
  return team;
}

export async function updateTeam(
  teamId: string,
  creatorId: string,
  data: { stage?: string; industry?: string; fundingNeeded?: number },
): Promise<Team | null> {
  const rows = await query<Team>(
    `UPDATE teams SET stage = COALESCE($1, stage), industry = COALESCE($2, industry),
       funding_needed = COALESCE($3, funding_needed), updated_at = now()
     WHERE id = $4 AND creator_id = $5 RETURNING *`,
    [data.stage ?? null, data.industry ?? null, data.fundingNeeded ?? null, teamId, creatorId],
  );
  return rows[0] || null;
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  const rows = await query<Team>("SELECT * FROM teams WHERE id = $1 AND is_active = true", [teamId]);
  return rows[0] || null;
}

export async function isAcceptedMember(teamId: string, userId: string): Promise<boolean> {
  const rows = await query(
    "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'accepted'",
    [teamId, userId],
  );
  return rows.length > 0;
}

export async function acceptedMemberCount(teamId: string): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*) FROM team_members WHERE team_id = $1 AND status = 'accepted'",
    [teamId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function getMembers(teamId: string) {
  return await query(
    `SELECT tm.user_id, tm.status, tm.invited_by_id, tm.created_at, tm.responded_at,
            u.name, u.photo_url, u.skills
     FROM team_members tm JOIN users u ON u.id = tm.user_id
     WHERE tm.team_id = $1
     ORDER BY tm.created_at ASC`,
    [teamId],
  );
}

export async function getMyPendingInvites(userId: string) {
  return await query(
    `SELECT tm.team_id, tm.created_at, t.name AS team_name, u.name AS invited_by_name
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     JOIN users u ON u.id = tm.invited_by_id
     WHERE tm.user_id = $1 AND tm.status = 'invited'
     ORDER BY tm.created_at DESC`,
    [userId],
  );
}

export async function getMyTeams(userId: string) {
  const teams = await query<Team>(
    `SELECT DISTINCT t.* FROM teams t
     JOIN team_members tm ON tm.team_id = t.id
     WHERE t.is_active = true AND tm.user_id = $1 AND (tm.status = 'accepted' OR t.creator_id = $1)
     ORDER BY t.created_at DESC`,
    [userId],
  );
  const result = [];
  for (const team of teams) {
    result.push({ ...team, members: await getMembers(String(team.id)) });
  }
  return result;
}

export async function hasExistingMatch(userIdA: string, userIdB: string): Promise<number | null> {
  const rows = await query<{ id: number }>(
    "SELECT id FROM matches WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)",
    [userIdA, userIdB],
  );
  return rows[0]?.id ?? null;
}

export async function isAlreadyOnTeam(teamId: string, userId: string): Promise<boolean> {
  const rows = await query("SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2", [teamId, userId]);
  return rows.length > 0;
}

export async function inviteMember(teamId: string, userId: string, invitedById: string, matchId: number) {
  const rows = await query<{ id: number }>(
    `INSERT INTO team_members (team_id, user_id, invited_by_id, status, match_id)
     VALUES ($1, $2, $3, 'invited', $4) RETURNING id`,
    [teamId, userId, invitedById, matchId],
  );
  return rows[0];
}

export async function respondToInvite(teamId: string, userId: string, accept: boolean) {
  const rows = await query<{ id: number }>(
    `UPDATE team_members SET status = $1, responded_at = now()
     WHERE team_id = $2 AND user_id = $3 AND status = 'invited'
     RETURNING id`,
    [accept ? "accepted" : "declined", teamId, userId],
  );
  return rows[0] || null;
}

export async function leaveTeam(teamId: string, userId: string): Promise<boolean> {
  const rows = await query<{ id: number }>(
    `UPDATE team_members SET status = 'declined'
     WHERE team_id = $1 AND user_id = $2 AND status = 'accepted'
       AND user_id != (SELECT creator_id FROM teams WHERE id = $1)
     RETURNING id`,
    [teamId, userId],
  );
  return rows.length > 0;
}

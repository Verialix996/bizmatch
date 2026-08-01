import { query } from "../_shared/db.ts";

export interface Challenge {
  id: number;
  investor_id: string | null;
  type: "cohesion_test" | "hackathon";
  team_id: number | null;
  title: string;
  description: string | null;
  judging_criteria: string | null;
  investment_teaser: string | null;
  submission_deadline: string;
  status: string;
  winning_team_id: number | null;
}

export async function createChallenge(
  investorId: string,
  data: { title: string; description?: string; judgingCriteria?: string; investmentTeaser?: string; submissionDeadline: string },
): Promise<Challenge> {
  const rows = await query<Challenge>(
    `INSERT INTO challenges (investor_id, type, title, description, judging_criteria, investment_teaser, submission_deadline)
     VALUES ($1, 'hackathon', $2, $3, $4, $5, $6) RETURNING *`,
    [investorId, data.title, data.description || null, data.judgingCriteria || null, data.investmentTeaser || null, data.submissionDeadline],
  );
  return rows[0];
}

export async function getOpenChallenges(limit = 50, offset = 0) {
  return await query(
    `SELECT c.*, u.name AS investor_name, u.photo_url AS investor_photo
     FROM challenges c JOIN users u ON u.id = c.investor_id
     WHERE c.type = 'hackathon' AND c.status = 'open' AND c.submission_deadline > now()
     ORDER BY c.submission_deadline ASC LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

export async function getChallengeById(id: string): Promise<Challenge | null> {
  const rows = await query<Challenge>("SELECT * FROM challenges WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function getMyChallenges(investorId: string) {
  return await query(
    "SELECT * FROM challenges WHERE investor_id = $1 AND type = 'hackathon' ORDER BY created_at DESC",
    [investorId],
  );
}

export async function hasCompletedCohesionTest(teamId: string): Promise<boolean> {
  const rows = await query(
    `SELECT 1 FROM challenge_signups cs
     JOIN challenges c ON c.id = cs.challenge_id
     WHERE c.team_id = $1 AND c.type = 'cohesion_test' AND cs.status = 'submitted'`,
    [teamId],
  );
  return rows.length > 0;
}

export async function getSignup(challengeId: string, teamId: string) {
  const rows = await query(
    "SELECT * FROM challenge_signups WHERE challenge_id = $1 AND team_id = $2",
    [challengeId, teamId],
  );
  return rows[0] || null;
}

export async function getSignupById(id: string) {
  const rows = await query<Record<string, unknown>>("SELECT * FROM challenge_signups WHERE id = $1", [id]);
  return rows[0] || null;
}

export async function createSignup(challengeId: string, teamId: string) {
  const rows = await query<{ id: number }>(
    "INSERT INTO challenge_signups (challenge_id, team_id) VALUES ($1, $2) RETURNING *",
    [challengeId, teamId],
  );
  return rows[0];
}

export async function updateSignupFile(id: string, column: "deck_url" | "video_url", url: string) {
  await query(`UPDATE challenge_signups SET ${column} = $1, updated_at = now() WHERE id = $2`, [url, id]);
}

export async function saveAiReview(id: string, review: unknown) {
  await query("UPDATE challenge_signups SET ai_review = $1, updated_at = now() WHERE id = $2", [JSON.stringify(review), id]);
}

export async function submitSignup(id: string, description: string) {
  const rows = await query(
    `UPDATE challenge_signups SET status = 'submitted', description = $1, submitted_at = now(), updated_at = now()
     WHERE id = $2 RETURNING *`,
    [description, id],
  );
  return rows[0] || null;
}

export async function getChallengeSignups(challengeId: string) {
  return await query(
    `SELECT cs.*, t.name AS team_name
     FROM challenge_signups cs JOIN teams t ON t.id = cs.team_id
     WHERE cs.challenge_id = $1
     ORDER BY cs.created_at ASC`,
    [challengeId],
  );
}

export async function getMySignups(userId: string) {
  return await query(
    `SELECT cs.*, c.title AS challenge_title, c.type AS challenge_type, c.submission_deadline, t.name AS team_name
     FROM challenge_signups cs
     JOIN challenges c ON c.id = cs.challenge_id
     JOIN teams t ON t.id = cs.team_id
     JOIN team_members tm ON tm.team_id = t.id
     WHERE tm.user_id = $1 AND tm.status = 'accepted'
     ORDER BY cs.created_at DESC`,
    [userId],
  );
}

export async function selectWinner(challengeId: string, teamId: string) {
  await query(
    "UPDATE challenges SET status = 'winner_selected', winning_team_id = $1, updated_at = now() WHERE id = $2",
    [teamId, challengeId],
  );
}

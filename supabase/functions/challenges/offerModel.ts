import { query } from "../_shared/db.ts";
import type { PublicUser } from "../_shared/auth.ts";

export type Party = "investor" | "team";

export interface OfferInput {
  amount: number;
  equityPercent: number;
  valuation?: number;
  terms?: string;
}

export async function currentRound(challengeId: string, teamId: string) {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM investment_offers WHERE challenge_id = $1 AND team_id = $2 ORDER BY round DESC LIMIT 1",
    [challengeId, teamId],
  );
  return rows[0] ?? null;
}

export async function resolveCallerParty(user: PublicUser, challengeId: string, teamId: string): Promise<Party | null> {
  const c = await query<{ investor_id: string }>("SELECT investor_id FROM challenges WHERE id = $1", [challengeId]);
  if (c[0]?.investor_id === user.id) return "investor";
  const m = await query(
    "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'accepted'",
    [teamId, user.id],
  );
  return m[0] ? "team" : null;
}

export async function createInitialOffer(challengeId: string, teamId: string, proposedById: string, input: OfferInput) {
  const rows = await query(
    `INSERT INTO investment_offers (challenge_id, team_id, round, direction, amount, equity_percent, valuation, terms, status, proposed_by_id)
     VALUES ($1, $2, 1, 'investor', $3, $4, $5, $6, 'pending', $7) RETURNING *`,
    [challengeId, teamId, input.amount, input.equityPercent, input.valuation ?? null, input.terms ?? null, proposedById],
  );
  return rows[0];
}

export async function insertCounterRound(
  challengeId: string, teamId: string, prevId: number, prevRound: number,
  party: Party, proposedById: string, input: OfferInput,
) {
  await query("UPDATE investment_offers SET status = 'countered' WHERE id = $1", [prevId]);
  const rows = await query(
    `INSERT INTO investment_offers (challenge_id, team_id, round, direction, amount, equity_percent, valuation, terms, status, proposed_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9) RETURNING *`,
    [challengeId, teamId, prevRound + 1, party, input.amount, input.equityPercent, input.valuation ?? null, input.terms ?? null, proposedById],
  );
  return rows[0];
}

export async function setOfferStatus(id: number, status: "accepted" | "declined") {
  await query("UPDATE investment_offers SET status = $1 WHERE id = $2", [status, id]);
}

export async function getOfferHistory(challengeId: string, teamId: string) {
  return await query(
    "SELECT * FROM investment_offers WHERE challenge_id = $1 AND team_id = $2 ORDER BY round ASC",
    [challengeId, teamId],
  );
}

export async function getAcceptedMemberIds(teamId: string): Promise<string[]> {
  const rows = await query<{ user_id: string }>(
    "SELECT user_id FROM team_members WHERE team_id = $1 AND status = 'accepted'",
    [teamId],
  );
  return rows.map((r) => r.user_id);
}

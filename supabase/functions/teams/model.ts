import { query } from "../_shared/db.ts";

export interface TeamListItem {
  id: number;
  name: string;
  memberCount: number;
}

export const TeamsModel = {
  // MVP screens 9/10's companion list — not a dedicated MVP screen itself,
  // but useful for admin navigation to an existing Team Profile.
  async list(programId: number | null): Promise<TeamListItem[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT t.id, t.name, count(tf.founder_id)::int AS member_count
       FROM teams t
       LEFT JOIN team_founders tf ON tf.team_id = t.id
       WHERE ($1::bigint IS NULL OR t.program_id = $1)
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [programId],
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name as string, memberCount: Number(r.member_count) }));
  },

  async get(teamId: number): Promise<Record<string, unknown> | null> {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, program_id, name, created_by, created_at FROM teams WHERE id = $1`,
      [teamId],
    );
    return rows[0] ?? null;
  },

  async findByFounder(founderId: string): Promise<number | null> {
    const rows = await query<{ team_id: number }>(
      `SELECT team_id FROM team_founders WHERE founder_id = $1`,
      [founderId],
    );
    return rows[0] ? Number(rows[0].team_id) : null;
  },

  // MVP screen 9 — Team Creation: select founders, team name, Create Team.
  // team_founders.founder_id is unique (a founder is on at most one team) —
  // pre-checked here so a founder who's already on a team produces a clean,
  // named error instead of a raw unique-violation reaching the client (the
  // frontend also filters already-teamed founders out of the picker, but
  // this is the actual enforcement point, e.g. against a race or a stale
  // client-side list).
  async create(name: string, programId: number | null, createdBy: string, founderIds: string[]): Promise<number> {
    const alreadyTeamed = await query<{ name: string | null }>(
      `SELECT u.name FROM team_founders tf JOIN users u ON u.id = tf.founder_id WHERE tf.founder_id = ANY($1::uuid[])`,
      [founderIds],
    );
    if (alreadyTeamed.length > 0) {
      const names = alreadyTeamed.map((r) => r.name || "A founder").join(", ");
      throw new Error(`${names} already ${alreadyTeamed.length === 1 ? "has" : "have"} a team.`);
    }

    const rows = await query<{ id: number }>(
      `INSERT INTO teams (name, program_id, created_by) VALUES ($1, $2, $3) RETURNING id`,
      [name, programId, createdBy],
    );
    const teamId = Number(rows[0].id);
    for (const founderId of founderIds) {
      await query(`INSERT INTO team_founders (team_id, founder_id) VALUES ($1, $2)`, [teamId, founderId]);
    }
    return teamId;
  },

  async setMembers(teamId: number, founderIds: string[]): Promise<void> {
    await query("DELETE FROM team_founders WHERE team_id = $1", [teamId]);
    for (const founderId of founderIds) {
      await query(`INSERT INTO team_founders (team_id, founder_id) VALUES ($1, $2)`, [teamId, founderId]);
    }
  },

  async remove(teamId: number): Promise<void> {
    await query("DELETE FROM teams WHERE id = $1", [teamId]);
  },
};

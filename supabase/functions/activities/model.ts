import { query } from "../_shared/db.ts";

export interface ActivityListItem {
  id: number;
  type: string;
  title: string;
  scheduledAt: string | null;
  status: string;
  participantCount: number;
}

export const ActivitiesModel = {
  // MVP screen 5 — Activities list: type, date, participant count, status.
  // Also backs MVP screen 10's "Team Activities" via the teamId filter.
  async list(programId: number | null, teamId: number | null = null): Promise<ActivityListItem[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT a.id, a.type, a.title, a.scheduled_at, a.status,
              count(ap.founder_id)::int AS participant_count
       FROM activities a
       LEFT JOIN activity_participants ap ON ap.activity_id = a.id
       WHERE ($1::bigint IS NULL OR a.program_id = $1)
         AND ($2::bigint IS NULL OR a.team_id = $2)
       GROUP BY a.id
       ORDER BY a.scheduled_at DESC NULLS LAST, a.id DESC`,
      [programId, teamId],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      type: r.type as string,
      title: r.title as string,
      scheduledAt: r.scheduled_at as string | null,
      status: r.status as string,
      participantCount: Number(r.participant_count),
    }));
  },

  async get(activityId: number): Promise<Record<string, unknown> | null> {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, program_id, type, title, description, scheduled_at, status
       FROM activities WHERE id = $1`,
      [activityId],
    );
    const activity = rows[0];
    if (!activity) return null;

    const participants = await query<Record<string, unknown>>(
      `SELECT u.id, u.name, u.photo_url
       FROM activity_participants ap JOIN users u ON u.id = ap.founder_id
       WHERE ap.activity_id = $1 ORDER BY u.name`,
      [activityId],
    );
    const evaluators = await query<Record<string, unknown>>(
      `SELECT u.id, u.name FROM activity_evaluators ae JOIN users u ON u.id = ae.evaluator_id
       WHERE ae.activity_id = $1 ORDER BY u.name`,
      [activityId],
    );

    return { ...activity, participants, evaluators };
  },

  async create(fields: Record<string, unknown>): Promise<number> {
    const { programId, type, title, description, scheduledAt } = fields as {
      programId?: number; type: string; title: string; description?: string; scheduledAt?: string;
    };
    const rows = await query<{ id: number }>(
      `INSERT INTO activities (program_id, type, title, description, scheduled_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [programId ?? null, type, title, description ?? null, scheduledAt ?? null],
    );
    return Number(rows[0].id);
  },

  async update(activityId: number, fields: Record<string, unknown>): Promise<void> {
    const { title, description, scheduledAt, status } = fields as {
      title?: string; description?: string; scheduledAt?: string; status?: string;
    };
    await query(
      `UPDATE activities SET
         title = COALESCE($2, title),
         description = COALESCE($3, description),
         scheduled_at = COALESCE($4, scheduled_at),
         status = COALESCE($5, status)
       WHERE id = $1`,
      [activityId, title ?? null, description ?? null, scheduledAt ?? null, status ?? null],
    );
  },

  async setParticipants(activityId: number, founderIds: string[]): Promise<void> {
    await query("DELETE FROM activity_participants WHERE activity_id = $1", [activityId]);
    for (const founderId of founderIds) {
      await query(
        "INSERT INTO activity_participants (activity_id, founder_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [activityId, founderId],
      );
    }
  },

  async setEvaluators(activityId: number, evaluatorIds: string[]): Promise<void> {
    await query("DELETE FROM activity_evaluators WHERE activity_id = $1", [activityId]);
    for (const evaluatorId of evaluatorIds) {
      await query(
        "INSERT INTO activity_evaluators (activity_id, evaluator_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [activityId, evaluatorId],
      );
    }
  },

  async remove(activityId: number): Promise<void> {
    await query("DELETE FROM activities WHERE id = $1", [activityId]);
  },
};

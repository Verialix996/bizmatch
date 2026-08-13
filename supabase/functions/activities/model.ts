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
  // Admin-only view — sees every activity regardless of participation.
  async list(programId: number | null, teamId: number | null = null, founderId: string | null = null): Promise<ActivityListItem[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT a.id, a.type, a.title, a.scheduled_at, a.status,
              count(ap.founder_id) FILTER (WHERE ap.status = 'approved')::int AS participant_count
       FROM activities a
       LEFT JOIN activity_participants ap ON ap.activity_id = a.id
       WHERE ($1::bigint IS NULL OR a.program_id = $1)
         AND ($2::bigint IS NULL OR a.team_id = $2)
         AND ($3::uuid IS NULL OR EXISTS (
           SELECT 1 FROM activity_participants ap2
           WHERE ap2.activity_id = a.id AND ap2.founder_id = $3
         ))
       GROUP BY a.id
       ORDER BY a.scheduled_at DESC NULLS LAST, a.id DESC`,
      [programId, teamId, founderId],
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

  // Founder-scoped view: activities open for browsing/signup ('upcoming',
  // regardless of participation), plus anything this founder already has a
  // participant row for (pending/approved/rejected, any activity status),
  // plus (when teamId is given, e.g. TeamProfileScreen's "Team Activities"
  // panel) any activity scoped to that team — a founder never sees an
  // active/completed activity outside those cases. `myStatus` is null when
  // they haven't requested to join yet.
  async listForFounder(founderId: string, teamId: number | null = null): Promise<Array<ActivityListItem & { myStatus: string | null }>> {
    const rows = await query<Record<string, unknown>>(
      `SELECT a.id, a.type, a.title, a.scheduled_at, a.status,
              count(ap.founder_id) FILTER (WHERE ap.status = 'approved')::int AS participant_count,
              me.status AS my_status
       FROM activities a
       LEFT JOIN activity_participants ap ON ap.activity_id = a.id
       LEFT JOIN activity_participants me ON me.activity_id = a.id AND me.founder_id = $1
       WHERE a.status = 'upcoming' OR me.founder_id IS NOT NULL
          OR ($2::bigint IS NOT NULL AND a.team_id = $2)
       GROUP BY a.id, me.status
       ORDER BY a.scheduled_at DESC NULLS LAST, a.id DESC`,
      [founderId, teamId],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      type: r.type as string,
      title: r.title as string,
      scheduledAt: r.scheduled_at as string | null,
      status: r.status as string,
      participantCount: Number(r.participant_count),
      myStatus: (r.my_status as string | null) ?? null,
    }));
  },

  async get(activityId: number, viewerId: string | null = null): Promise<Record<string, unknown> | null> {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, program_id, team_id, type, title, description, scheduled_at, status
       FROM activities WHERE id = $1`,
      [activityId],
    );
    const activity = rows[0];
    if (!activity) return null;

    const participants = await query<Record<string, unknown>>(
      `SELECT u.id, u.name, u.photo_url, ap.status, ap.requested_at
       FROM activity_participants ap JOIN users u ON u.id = ap.founder_id
       WHERE ap.activity_id = $1 ORDER BY ap.status, u.name`,
      [activityId],
    );
    const evaluators = await query<Record<string, unknown>>(
      `SELECT u.id, u.name FROM activity_evaluators ae JOIN users u ON u.id = ae.evaluator_id
       WHERE ae.activity_id = $1 ORDER BY u.name`,
      [activityId],
    );

    const myStatus = viewerId ? (participants.find((p) => p.id === viewerId)?.status as string | undefined) ?? null : null;

    return { ...activity, participants, evaluators, myStatus };
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

  // Admin bulk-replace — a direct assignment, not a request, so it's
  // inserted pre-approved rather than going through the pending queue.
  async setParticipants(activityId: number, founderIds: string[]): Promise<void> {
    await query("DELETE FROM activity_participants WHERE activity_id = $1", [activityId]);
    for (const founderId of founderIds) {
      await query(
        `INSERT INTO activity_participants (activity_id, founder_id, status, requested_at, decided_at)
         VALUES ($1, $2, 'approved', now(), now())
         ON CONFLICT DO NOTHING`,
        [activityId, founderId],
      );
    }
  },

  // Founder self-service: request to join an upcoming activity. Idempotent —
  // re-requesting just returns whatever status the existing row already has.
  async requestJoin(activityId: number, founderId: string): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
    const activityRows = await query<{ status: string }>("SELECT status FROM activities WHERE id = $1", [activityId]);
    if (!activityRows[0]) return { ok: false, error: "Activity not found" };
    if (activityRows[0].status !== "upcoming") {
      return { ok: false, error: "Registration is only open for upcoming activities" };
    }

    await query(
      `INSERT INTO activity_participants (activity_id, founder_id, status, requested_at)
       VALUES ($1, $2, 'pending', now())
       ON CONFLICT (activity_id, founder_id) DO NOTHING`,
      [activityId, founderId],
    );
    const rows = await query<{ status: string }>(
      "SELECT status FROM activity_participants WHERE activity_id = $1 AND founder_id = $2",
      [activityId, founderId],
    );
    return { ok: true, status: rows[0].status };
  },

  async isFounderOnTeam(teamId: number, founderId: string): Promise<boolean> {
    const rows = await query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM team_founders WHERE team_id = $1 AND founder_id = $2) AS exists",
      [teamId, founderId],
    );
    return !!rows[0]?.exists;
  },

  // Admin approve/reject of a single pending (or existing) registration.
  async decideParticipant(activityId: number, founderId: string, status: "approved" | "rejected"): Promise<void> {
    await query(
      `UPDATE activity_participants SET status = $3, decided_at = now()
       WHERE activity_id = $1 AND founder_id = $2`,
      [activityId, founderId, status],
    );
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

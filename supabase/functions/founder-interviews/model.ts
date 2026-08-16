import { query, parseJsonColumn } from "../_shared/db.ts";

function row(r: Record<string, unknown>) {
  return {
    id: r.id,
    founderId: r.founder_id,
    interviewerId: r.interviewer_id,
    interviewerName: r.interviewer_name ?? null,
    status: r.status,
    meta: parseJsonColumn(r.meta, {}),
    answers: parseJsonColumn(r.answers, {}),
    startedAt: r.started_at,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowWithFounder(r: Record<string, unknown>) {
  return {
    ...row(r),
    founderName: r.founder_name ?? null,
    founderPhotoUrl: r.founder_photo_url ?? null,
  };
}

export const FounderInterviewsModel = {
  async list(founderId: string) {
    const rows = await query<Record<string, unknown>>(
      `SELECT fi.*, u.name AS interviewer_name
       FROM founder_interviews fi
       LEFT JOIN users u ON u.id = fi.interviewer_id
       WHERE fi.founder_id = $1
       ORDER BY fi.created_at DESC`,
      [founderId],
    );
    return rows.map(row);
  },

  // Cohort-wide list for the Interviews dashboard (MVP screen: interview
  // tab) — every interview across every founder, most recently active
  // first, with enough founder identity to render a list row without an
  // extra per-row fetch.
  async listAll() {
    const rows = await query<Record<string, unknown>>(
      `SELECT fi.*, u.name AS interviewer_name, fu.name AS founder_name, fu.photo_url AS founder_photo_url
       FROM founder_interviews fi
       LEFT JOIN users u ON u.id = fi.interviewer_id
       JOIN users fu ON fu.id = fi.founder_id
       ORDER BY fi.updated_at DESC`,
    );
    return rows.map(rowWithFounder);
  },

  async get(id: string) {
    const rows = await query<Record<string, unknown>>(
      `SELECT fi.*, u.name AS interviewer_name
       FROM founder_interviews fi
       LEFT JOIN users u ON u.id = fi.interviewer_id
       WHERE fi.id = $1`,
      [id],
    );
    return rows[0] ? row(rows[0]) : null;
  },

  async create(founderId: string, interviewerId: string, meta: unknown) {
    const rows = await query<{ id: string }>(
      `INSERT INTO founder_interviews (founder_id, interviewer_id, meta)
       VALUES ($1, $2, $3) RETURNING id`,
      [founderId, interviewerId, JSON.stringify(meta ?? {})],
    );
    return rows[0].id;
  },

  async save(id: string, meta: unknown, answers: unknown) {
    await query(
      `UPDATE founder_interviews
       SET meta = COALESCE($2, meta), answers = COALESCE($3, answers), updated_at = now()
       WHERE id = $1`,
      [id, meta != null ? JSON.stringify(meta) : null, answers != null ? JSON.stringify(answers) : null],
    );
  },

  async complete(id: string) {
    await query(
      `UPDATE founder_interviews SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    );
  },

  async remove(id: string) {
    await query(`DELETE FROM founder_interviews WHERE id = $1`, [id]);
  },
};

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
    // Each { url, durationSeconds } — one per start/stop take, never merged into a single
    // file (see the recording_segments migration for why: naive concatenation of two
    // already-finalized WebM/m4a files isn't reliably playable past the first one).
    recordingSegments: parseJsonColumn(r.recording_segments, []),
    recordingBookmarks: parseJsonColumn(r.recording_bookmarks, []),
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
    // Lets the cohort-wide list show "12 answered" for an in-progress interview
    // without every row re-walking the question tree client-side.
    answeredCount: Number(r.answered_count ?? 0),
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
      `SELECT fi.*,
              -- query()'s simple-query-protocol writes (see _shared/db.ts) store jsonb columns
              -- double-encoded — a JSON string scalar holding the real JSON text, not an object —
              -- which parseJsonColumn compensates for on the JS side. This raw SQL count has no
              -- such helper, so it unwraps the same way by hand: read the app through both forms
              -- rather than trusting whichever one a given row happens to be in.
              CASE
                WHEN jsonb_typeof(fi.answers) = 'object' THEN (SELECT count(*) FROM jsonb_object_keys(fi.answers))
                WHEN jsonb_typeof(fi.answers) = 'string' THEN (SELECT count(*) FROM jsonb_object_keys((fi.answers #>> '{}')::jsonb))
                ELSE 0
              END AS answered_count,
              u.name AS interviewer_name, fu.name AS founder_name, fu.photo_url AS founder_photo_url
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
       VALUES ($1, $2, $3::jsonb) RETURNING id`,
      [founderId, interviewerId, meta ?? {}],
    );
    return rows[0].id;
  },

  async save(id: string, meta: unknown, answers: unknown, recordingBookmarks?: unknown) {
    // Pass meta/answers/recordingBookmarks as raw JS values (objects/arrays), NOT pre-stringified
    // — query()'s postgres.js driver already serializes object/array parameters to JSON text
    // itself when binding them. Calling JSON.stringify() here too used to double-encode: the
    // driver would serialize the JSON.stringify() result AGAIN, so what actually landed in the
    // jsonb column was a string scalar containing escaped JSON, not the object. parseJsonColumn
    // on the read side quietly unwraps exactly one such extra layer, which is how this went
    // unnoticed until this file's recording_segments needed to unwrap correctly nested content.
    // The ::jsonb casts still matter — without them, a bare `null` parameter can't disambiguate
    // "clear the column" from "don't touch it" the way COALESCE needs.
    await query(
      `UPDATE founder_interviews
       SET meta = COALESCE($2::jsonb, meta),
           answers = COALESCE($3::jsonb, answers),
           recording_bookmarks = COALESCE($4::jsonb, recording_bookmarks),
           updated_at = now()
       WHERE id = $1`,
      [id, meta ?? null, answers ?? null, recordingBookmarks ?? null],
    );
  },

  // Appends one finished take to the segments array — kept separate from save() since it's
  // driven by the upload endpoint, not the answers autosave. Never overwrites or merges with
  // an existing segment (see the recording_segments migration).
  async appendRecordingSegment(id: string, segment: { url: string; durationSeconds: number }) {
    await query(
      `UPDATE founder_interviews
       SET recording_segments = recording_segments || jsonb_build_array($2::jsonb),
           updated_at = now()
       WHERE id = $1`,
      [id, segment],
    );
  },

  async complete(id: string) {
    await query(
      `UPDATE founder_interviews SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1`,
      [id],
    );
  },

  // Full reset per user decision: answers, recording, and bookmarks all clear
  // together, back to a fresh in-progress interview at question 1.
  async reset(id: string) {
    await query(
      `UPDATE founder_interviews
       SET answers = '{}'::jsonb,
           recording_segments = '[]'::jsonb,
           recording_bookmarks = '[]'::jsonb,
           status = 'in_progress',
           completed_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [id],
    );
  },

  async remove(id: string) {
    await query(`DELETE FROM founder_interviews WHERE id = $1`, [id]);
  },
};

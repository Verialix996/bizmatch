import { query } from "../_shared/db.ts";

interface CreateMeetingInput {
  matchId: string | number;
  proposerId: string;
  receiverId: string;
  title?: string | null;
  scheduledAt: string;
  locationType: string;
  videoLink?: string | null;
  address?: string | null;
}

export async function createMeeting(data: CreateMeetingInput) {
  const { matchId, proposerId, receiverId, title, scheduledAt, locationType, videoLink, address } = data;
  const rows = await query<{ id: number }>(
    `INSERT INTO meetings (match_id, proposer_id, receiver_id, title, scheduled_at, location_type, video_link, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [matchId, proposerId, receiverId, title || null, scheduledAt, locationType, videoLink || null, address || null],
  );
  return getMeetingById(rows[0].id);
}

export async function getMeetingById(id: string | number) {
  const rows = await query(
    `SELECT m.*,
            pu.name AS proposer_name, pu.photo_url AS proposer_photo,
            ru.name AS receiver_name, ru.photo_url AS receiver_photo
     FROM meetings m
     JOIN users pu ON pu.id = m.proposer_id
     JOIN users ru ON ru.id = m.receiver_id
     WHERE m.id = $1`,
    [id],
  );
  return rows[0] || null;
}

export async function getMeetingsForUser(userId: string) {
  return await query(
    `SELECT m.*,
            pu.name AS proposer_name, pu.photo_url AS proposer_photo,
            ru.name AS receiver_name, ru.photo_url AS receiver_photo
     FROM meetings m
     JOIN users pu ON pu.id = m.proposer_id
     JOIN users ru ON ru.id = m.receiver_id
     WHERE (m.proposer_id = $1 OR m.receiver_id = $1)
       AND m.status != 'cancelled'
     ORDER BY m.scheduled_at ASC`,
    [userId],
  );
}

export async function updateMeetingStatus(id: string | number, status: string) {
  await query("UPDATE meetings SET status = $1 WHERE id = $2", [status, id]);
  return getMeetingById(id);
}

export async function saveBriefing(id: string | number, briefing: Record<string, unknown>) {
  await query("UPDATE meetings SET briefing = $1 WHERE id = $2", [JSON.stringify(briefing), id]);
}

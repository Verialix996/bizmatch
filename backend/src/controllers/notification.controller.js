const { query } = require('../config/db');

async function emitNotification(userId, type, refId, payload = {}) {
  try {
    await query(
      'INSERT INTO notifications (user_id, type, ref_id, payload) VALUES ($1, $2, $3, $4)',
      [userId, type, refId || null, JSON.stringify(payload)]
    );
  } catch (err) {
    console.error('[emitNotification] failed:', type, err.message);
  }
}

const getNotifications = async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, type, ref_id AS "refId", payload, read_at AS "readAt", created_at AS "createdAt"
       FROM notifications WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    const { ids, types } = req.body;
    if (ids?.length) {
      await query(
        `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::bigint[]) AND read_at IS NULL`,
        [req.user.id, ids]
      );
    }
    if (types?.length) {
      await query(
        `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND type = ANY($2::notification_type[]) AND read_at IS NULL`,
        [req.user.id, types]
      );
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { getNotifications, markRead, emitNotification };

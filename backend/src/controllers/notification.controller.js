const { query } = require('../config/db');

async function emitNotification(userId, type, refId, payload = {}) {
  try {
    await query(
      'INSERT INTO notifications (user_id, type, ref_id, payload) VALUES (?, ?, ?, ?)',
      [userId, type, refId || null, JSON.stringify(payload)]
    );
  } catch {
    // non-critical — never block the request
  }
}

const getNotifications = async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT id, type, ref_id AS refId, payload, read_at AS readAt, created_at AS createdAt
       FROM notifications WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const parsed = rows.map(r => ({
      ...r,
      payload: (() => { try { return JSON.parse(r.payload || '{}'); } catch { return {}; } })(),
    }));
    res.json(parsed);
  } catch (err) { next(err); }
};

const markRead = async (req, res, next) => {
  try {
    const { ids, types } = req.body;
    if (ids?.length) {
      const placeholders = ids.map(() => '?').join(',');
      await query(
        `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND id IN (${placeholders}) AND read_at IS NULL`,
        [req.user.id, ...ids]
      );
    }
    if (types?.length) {
      const placeholders = types.map(() => '?').join(',');
      await query(
        `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND type IN (${placeholders}) AND read_at IS NULL`,
        [req.user.id, ...types]
      );
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { getNotifications, markRead, emitNotification };

const { getFeed, recordSwipe, getMatches } = require('../models/match.model');
const { query } = require('../config/db');

const DAILY_SWIPE_LIMIT = 20;

const feed = async (req, res, next) => {
  try {
    const mode = req.query.mode === 'partners' ? 'partners' : 'investors';
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const candidates = await getFeed(req.user.id, req.user.role, mode, projectId);
    res.json(candidates);
  } catch (err) {
    next(err);
  }
};

const swipe = async (req, res, next) => {
  try {
    const { targetUserId, direction, superLike } = req.body;

    if (!targetUserId || !['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'targetUserId and direction (like|pass) are required' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot swipe on yourself' });
    }

    // Premium check + daily swipe limit
    const userRows = await query(
      'SELECT is_premium, premium_expires_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const u = userRows[0];
    const isPremium = u?.is_premium && new Date(u?.premium_expires_at) > new Date();

    if (!isPremium) {
      const countRows = await query(
        "SELECT COUNT(*) AS cnt FROM swipes WHERE swiper_id = ? AND DATE(created_at) = CURDATE()",
        [req.user.id]
      );
      if ((countRows[0]?.cnt ?? 0) >= DAILY_SWIPE_LIMIT) {
        return res.status(429).json({ error: 'Daily swipe limit reached', upgradeRequired: true });
      }
    }

    const isSuperLike = superLike === true && isPremium;
    const result = await recordSwipe(req.user.id, targetUserId, direction, isSuperLike);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const matches = async (req, res, next) => {
  try {
    res.json(await getMatches(req.user.id));
  } catch (err) {
    next(err);
  }
};

module.exports = { feed, swipe, matches };

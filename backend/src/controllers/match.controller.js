const { getFeed, recordSwipe, getMatches } = require('../models/match.model');

const feed = async (req, res, next) => {
  try {
    const mode = req.query.mode === 'partners' ? 'partners' : 'investors';
    const candidates = await getFeed(req.user.id, req.user.role, mode);
    res.json(candidates);
  } catch (err) {
    next(err);
  }
};

const swipe = async (req, res, next) => {
  try {
    const { targetUserId, direction } = req.body;

    if (!targetUserId || !['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'targetUserId and direction (like|pass) are required' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot swipe on yourself' });
    }

    const result = await recordSwipe(req.user.id, targetUserId, direction);
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

const { sendMessage, getMessages, getConversations } = require('../models/message.model');

const conversations = async (req, res, next) => {
  try {
    res.json(await getConversations(req.user.id));
  } catch (err) {
    next(err);
  }
};

const messages = async (req, res, next) => {
  try {
    const matchId = Number(req.params.matchId);
    if (!matchId) return res.status(400).json({ error: 'Invalid matchId' });

    const limit  = Math.min(Number(req.query.limit)  || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const after  = req.query.after != null ? Number(req.query.after) : null;

    const rows = await getMessages(matchId, req.user.id, limit, offset, after);
    if (rows === null) return res.status(403).json({ error: 'Not part of this match' });

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const send = async (req, res, next) => {
  try {
    const matchId = Number(req.params.matchId);
    const { body } = req.body;

    if (!matchId) return res.status(400).json({ error: 'Invalid matchId' });
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });

    const msg = await sendMessage(matchId, req.user.id, body.trim());
    if (!msg) return res.status(403).json({ error: 'Not part of this match' });

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

module.exports = { conversations, messages, send };

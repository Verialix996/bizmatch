const { sendMessage, getMessages, getConversations, markMessagesRead } = require('../models/message.model');
const { query } = require('../config/db');
const { moderateText } = require('../services/moderation.service');
const { emitNotification } = require('./notification.controller');

const conversations = async (req, res, next) => {
  try {
    res.json(await getConversations(req.user.id));
  } catch (err) {
    next(err);
  }
};

const messages = async (req, res, next) => {
  try {
    const matchId = req.params.matchId;
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
    const matchId = req.params.matchId;
    const { body } = req.body;

    if (!matchId) return res.status(400).json({ error: 'Invalid matchId' });
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body required' });

    const mod = await moderateText(body.trim());
    if (!mod.ok) return res.status(400).json({ error: `Message flagged by moderation: ${mod.reason}` });

    const msg = await sendMessage(matchId, req.user.id, body.trim());
    if (!msg) return res.status(403).json({ error: 'Not part of this match' });

    // Emit in-app bell notification to receiver (skip if one already unread for this match)
    ;(async () => {
      try {
        const matchRows = await query('SELECT user1_id, user2_id FROM matches WHERE id = $1', [matchId]);
        if (!matchRows[0]) return;
        const receiverId = matchRows[0].user1_id === req.user.id ? matchRows[0].user2_id : matchRows[0].user1_id;
        const existing = await query(
          `SELECT id FROM notifications WHERE user_id = $1 AND type = 'message' AND ref_id = $2 AND read_at IS NULL LIMIT 1`,
          [receiverId, matchId]
        );
        if (existing.length) return; // already an unread badge for this chat
        const senderRows = await query('SELECT name FROM users WHERE id = $1', [req.user.id]);
        await emitNotification(receiverId, 'message', matchId, {
          matchId,
          fromName: senderRows[0]?.name || 'Someone',
        });
      } catch { /* non-critical */ }
    })();

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId/share-project  { projectId }
// Project owner shares project details with the other match participant.
const shareProject = async (req, res, next) => {
  try {
    const matchId   = req.params.matchId;
    const projectId = req.body.projectId;
    const userId    = req.user.id;

    if (!matchId || !projectId) return res.status(400).json({ error: 'matchId and projectId required' });

    // Verify caller is in this match
    const matchRows = await query(
      'SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, userId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    // Verify caller owns the project
    const projectRows = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2 AND is_active = true', [projectId, userId]);
    if (!projectRows[0]) return res.status(403).json({ error: 'Project not found or not yours' });
    const project = projectRows[0];

    const msg = await sendMessage(
      matchId, userId,
      `Project details shared: "${project.title}"`,
      'project_shared',
      {
        projectId:     project.id,
        title:         project.title,
        description:   project.description   || null,
        industry:      project.industry      || null,
        stage:         project.stage         || null,
        fundingNeeded: project.funding_needed || null,
        deckUrl:       project.deck_url      || null,
        videoUrl:      project.video_url     || null,
      }
    );

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const matchId = req.params.matchId;
    if (!matchId) return res.status(400).json({ error: 'Invalid matchId' });
    await markMessagesRead(matchId, req.user.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { conversations, messages, send, markRead, shareProject };

const { sendMessage, getMessages, getConversations } = require('../models/message.model');
const { query } = require('../config/db');

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

// POST /api/messages/:matchId/invite  { projectId }
// Entrepreneur sends a partner invite to the other user in a match
const sendInvite = async (req, res, next) => {
  try {
    const matchId   = Number(req.params.matchId);
    const projectId = Number(req.body.projectId);
    const senderId  = req.user.id;

    if (!matchId || !projectId) return res.status(400).json({ error: 'matchId and projectId required' });

    // Verify sender is part of this match
    const matchRows = await query(
      'SELECT id, user1_id, user2_id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [matchId, senderId, senderId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    // Verify sender owns the project
    const projectRows = await query(
      'SELECT id, title FROM projects WHERE id = ? AND user_id = ?',
      [projectId, senderId]
    );
    if (!projectRows[0]) return res.status(403).json({ error: 'Project not found or not yours' });
    const project = projectRows[0];

    const match    = matchRows[0];
    const inviteeId = match.user1_id === senderId ? match.user2_id : match.user1_id;

    // Prevent duplicate pending invites
    const existing = await query(
      `SELECT id FROM partner_invitations
       WHERE project_id = ? AND invitee_id = ? AND status = 'pending'`,
      [projectId, inviteeId]
    );
    if (existing[0]) return res.status(409).json({ error: 'Invite already pending' });

    // Create invitation record
    const invResult = await query(
      `INSERT INTO partner_invitations (project_id, match_id, inviter_id, invitee_id, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [projectId, matchId, senderId, inviteeId]
    );
    const invitationId = invResult.insertId;

    // Send the invite as a chat message
    const msg = await sendMessage(
      matchId, senderId,
      `You've been invited to join "${project.title}" as a partner. Please review and sign the NDA to accept.`,
      'partner_invite',
      { projectId, projectTitle: project.title, invitationId }
    );

    res.status(201).json({ invitation: { id: invitationId, projectId, inviteeId }, message: msg });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId/invite/:invitationId/respond  { accepted: bool }
// The invitee responds to a partner invite — they must have already signed the NDA
const respondToInvite = async (req, res, next) => {
  try {
    const matchId      = Number(req.params.matchId);
    const invitationId = Number(req.params.invitationId);
    const accepted     = req.body.accepted === true || req.body.accepted === 'true';
    const userId       = req.user.id;

    const invRows = await query(
      `SELECT * FROM partner_invitations WHERE id = ? AND invitee_id = ? AND status = 'pending'`,
      [invitationId, userId]
    );
    if (!invRows[0]) return res.status(404).json({ error: 'Invitation not found or already resolved' });
    const inv = invRows[0];

    // If accepting, require a signed NDA for this project
    if (accepted) {
      const ndaRows = await query(
        'SELECT id FROM project_ndas WHERE project_id = ? AND user_id = ?',
        [inv.project_id, userId]
      );
      if (!ndaRows[0]) return res.status(403).json({ error: 'You must sign the NDA before accepting' });
    }

    const newStatus = accepted ? 'accepted' : 'rejected';
    await query('UPDATE partner_invitations SET status = ? WHERE id = ?', [newStatus, invitationId]);

    let msg;
    if (accepted) {
      // Add to project partners
      await query(
        'INSERT IGNORE INTO project_partners (project_id, user_id) VALUES (?, ?)',
        [inv.project_id, userId]
      );
      msg = await sendMessage(
        matchId, userId,
        'Partner invite accepted! Welcome to the team.',
        'partner_invite_response',
        { invitationId, accepted: true, projectId: inv.project_id }
      );
    } else {
      msg = await sendMessage(
        matchId, userId,
        'Partner invite declined.',
        'partner_invite_response',
        { invitationId, accepted: false, projectId: inv.project_id }
      );
    }

    res.json({ status: newStatus, message: msg });
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId/nda-request  { projectId }
// Investor requests NDA signing to access full project details
const requestNda = async (req, res, next) => {
  try {
    const matchId   = Number(req.params.matchId);
    const projectId = Number(req.body.projectId);
    const senderId  = req.user.id;

    if (!matchId || !projectId) return res.status(400).json({ error: 'matchId and projectId required' });

    const matchRows = await query(
      'SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [matchId, senderId, senderId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    const projectRows = await query('SELECT id, title FROM projects WHERE id = ?', [projectId]);
    if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    const msg = await sendMessage(
      matchId, senderId,
      `NDA requested for "${project.title}". Please review and sign to grant access.`,
      'nda_request',
      { projectId, projectTitle: project.title }
    );

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId/nda-sign  { projectId }
// Project owner signs (approves) the NDA — records it and notifies via chat
const signNda = async (req, res, next) => {
  try {
    const matchId   = Number(req.params.matchId);
    const projectId = Number(req.body.projectId);
    const userId    = req.user.id;

    if (!matchId || !projectId) return res.status(400).json({ error: 'matchId and projectId required' });

    const matchRows = await query(
      'SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [matchId, userId, userId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    // Record the NDA signature (INSERT IGNORE handles duplicates gracefully)
    await query(
      'INSERT IGNORE INTO project_ndas (project_id, user_id) VALUES (?, ?)',
      [projectId, userId]
    );

    const msg = await sendMessage(
      matchId, userId,
      'NDA signed. You now have access to the full project details.',
      'nda_signed',
      { projectId }
    );

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

module.exports = { conversations, messages, send, sendInvite, respondToInvite, requestNda, signNda };

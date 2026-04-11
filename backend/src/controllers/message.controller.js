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

    // Check for an existing invite for this project+invitee
    const existing = await query(
      `SELECT id, status FROM partner_invitations WHERE project_id = ? AND invitee_id = ?`,
      [projectId, inviteeId]
    );

    let invitationId;
    if (existing[0]) {
      if (existing[0].status === 'pending') return res.status(409).json({ error: 'Invite already pending' });
      if (existing[0].status === 'accepted') return res.status(409).json({ error: 'User is already a partner' });
      // Previously rejected — reset to pending so they can be re-invited
      await query(
        `UPDATE partner_invitations SET status = 'pending', inviter_id = ?, match_id = ?, created_at = NOW() WHERE id = ?`,
        [senderId, matchId, existing[0].id]
      );
      invitationId = existing[0].id;
    } else {
      const invResult = await query(
        `INSERT INTO partner_invitations (project_id, match_id, inviter_id, invitee_id, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [projectId, matchId, senderId, inviteeId]
      );
      invitationId = invResult.insertId;
    }

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
// Signs the NDA — records it, notifies via chat, and auto-shares project details
// if the signer is not the project owner (i.e. owner shared → other party signs)
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

    // If the signer is NOT the project owner, the owner wanted to share — auto-send project details
    const projectRows = await query('SELECT * FROM projects WHERE id = ? AND is_active = 1', [projectId]);
    const project = projectRows[0];
    if (project && project.user_id !== userId) {
      await sendMessage(
        matchId, project.user_id,
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
    }

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId/share-project  { projectId }
// Project owner directly shares project details when NDA is already signed by the other party
const shareProject = async (req, res, next) => {
  try {
    const matchId   = Number(req.params.matchId);
    const projectId = Number(req.body.projectId);
    const userId    = req.user.id;

    if (!matchId || !projectId) return res.status(400).json({ error: 'matchId and projectId required' });

    // Verify caller is in this match
    const matchRows = await query(
      'SELECT id, user1_id, user2_id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [matchId, userId, userId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    // Verify caller owns the project
    const projectRows = await query('SELECT * FROM projects WHERE id = ? AND user_id = ? AND is_active = 1', [projectId, userId]);
    if (!projectRows[0]) return res.status(403).json({ error: 'Project not found or not yours' });
    const project = projectRows[0];

    // Verify the other party has signed the NDA
    const match = matchRows[0];
    const otherUserId = match.user1_id === userId ? match.user2_id : match.user1_id;
    const ndaRows = await query(
      'SELECT id FROM project_ndas WHERE project_id = ? AND user_id = ?',
      [projectId, otherUserId]
    );
    if (!ndaRows[0]) return res.status(409).json({ error: 'NDA not yet signed by the other party' });

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

module.exports = { conversations, messages, send, sendInvite, respondToInvite, requestNda, signNda, shareProject };

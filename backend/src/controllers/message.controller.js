const { sendMessage, getMessages, getConversations, markMessagesRead } = require('../models/message.model');
const { query } = require('../config/db');
const PDFDocument = require('pdfkit');
const { moderateText } = require('../services/moderation.service');
const { emitNotification } = require('./notification.controller');

const conversations = async (req, res, next) => {
  try {
    res.json(await getConversations(req.user.id));
  } catch (err) {
    return res.status(500).json({ error: `[diag] ${err.errno || ''} ${err.sqlMessage || err.message}` });
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

    const mod = await moderateText(body.trim());
    if (!mod.ok) return res.status(400).json({ error: `Message flagged by moderation: ${mod.reason}` });

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
    const roleTitle = req.body.role_title ? String(req.body.role_title).trim() : null;
    const equityPct = req.body.equity_pct != null ? Number(req.body.equity_pct) : null;
    const salary    = req.body.salary    != null ? Number(req.body.salary)    : null;

    if (!matchId || !projectId) return res.status(400).json({ error: 'matchId and projectId required' });

    if (roleTitle) {
      const mod = await moderateText(roleTitle);
      if (!mod.ok) return res.status(400).json({ error: `Role title flagged: ${mod.reason}` });
    }

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
      if (existing[0].status === 'accepted') {
        // Verify the user is still an active partner — they may have been removed
        const partnerRows = await query(
          'SELECT 1 FROM project_partners WHERE project_id = ? AND user_id = ?',
          [projectId, inviteeId]
        );
        if (partnerRows[0]) return res.status(409).json({ error: 'User is already a partner' });
        // Stale accepted record — clear it and allow re-invite
        await query('DELETE FROM partner_invitations WHERE id = ?', [existing[0].id]);
      } else {
        // Previously rejected — reset to pending so they can be re-invited
        await query(
          `UPDATE partner_invitations SET status = 'pending', inviter_id = ?, match_id = ?, role_title = ?, equity_pct = ?, salary = ?, created_at = NOW() WHERE id = ?`,
          [senderId, matchId, roleTitle, equityPct, salary, existing[0].id]
        );
        invitationId = existing[0].id;
      }
    }
    if (!invitationId) {
      const invResult = await query(
        `INSERT INTO partner_invitations (project_id, match_id, inviter_id, invitee_id, status, role_title, equity_pct, salary)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [projectId, matchId, senderId, inviteeId, roleTitle, equityPct, salary]
      );
      invitationId = invResult.insertId;
    }

    const roleLabel = roleTitle ? ` as ${roleTitle}` : ' as a partner';
    // Send the invite as a chat message
    const msg = await sendMessage(
      matchId, senderId,
      `You've been invited to join "${project.title}"${roleLabel}. Please review and sign the NDA to accept.`,
      'partner_invite',
      { projectId, projectTitle: project.title, invitationId, roleTitle, equityPct, salary }
    );

    emitNotification(inviteeId, 'partner_invite', invitationId, { projectId, projectTitle: project.title }).catch(() => {});

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
      // Add to project partners, carrying the role from the invitation (default 'member')
      const partnerRole = (inv.role_title || 'member').trim().slice(0, 100);
      await query(
        'INSERT INTO project_partners (project_id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)',
        [inv.project_id, userId, partnerRole]
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

async function generateNdaPdf(signerName, ownerName, projectTitle, signedAt) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title block
    doc.fontSize(24).font('Helvetica-Bold').text('BizMatch', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(16).font('Helvetica-Bold').text('NON-DISCLOSURE AGREEMENT', { align: 'center', underline: true });
    doc.moveDown(2);

    // Parties & project
    doc.fontSize(11).font('Helvetica-Bold').text('Effective Date:  ', { continued: true });
    doc.font('Helvetica').text(signedAt);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Project:  ', { continued: true });
    doc.font('Helvetica').text(`"${projectTitle}"`);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Disclosing Party:  ', { continued: true });
    doc.font('Helvetica').text(ownerName);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Receiving Party:  ', { continued: true });
    doc.font('Helvetica').text(signerName);
    doc.moveDown(1.5);

    doc.font('Helvetica').text(
      'This Non-Disclosure Agreement ("Agreement") is entered into between the parties named above with respect to the Project identified above.',
      { lineGap: 4 }
    );
    doc.moveDown(1);

    const clauses = [
      ['1. Confidential Information', 'The Receiving Party agrees to keep all non-public information about the Project strictly confidential and not to disclose it to any third party without prior written consent from the Disclosing Party.'],
      ['2. Non-Use', 'The Receiving Party shall not use the Confidential Information for any purpose other than evaluating a potential collaboration or investment in the Project.'],
      ['3. Duration', 'This obligation of confidentiality shall remain in effect for a period of two (2) years from the Effective Date.'],
      ['4. Exceptions', 'This Agreement does not apply to information that is or becomes publicly available through no breach of this Agreement, or that the Receiving Party can demonstrate was independently known prior to disclosure.'],
      ['5. Governing Law', 'This Agreement shall be governed by and construed in accordance with the laws of the State of Israel, and any disputes shall be resolved in the competent courts thereof.'],
    ];

    for (const [heading, body] of clauses) {
      doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke('#CCCCCC');
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(11).text(heading);
      doc.font('Helvetica').fontSize(11).text(body, { lineGap: 3 });
      doc.moveDown(1);
    }

    // Signature block
    doc.moveTo(60, doc.y).lineTo(doc.page.width - 60, doc.y).stroke('#CCCCCC');
    doc.moveDown(1.5);
    doc.font('Helvetica-Bold').fontSize(12).text('SIGNATURE', { align: 'center' });
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').fontSize(11).text('Receiving Party:  ', { continued: true });
    doc.font('Helvetica').text(signerName);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Disclosing Party:  ', { continued: true });
    doc.font('Helvetica').text(ownerName);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').text('Signed On:  ', { continued: true });
    doc.font('Helvetica').text(signedAt);
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(9).fillColor('#888888')
      .text('Electronically signed via the BizMatch platform. This digital signature is legally binding.', { align: 'center' });

    doc.end();
  });
}

// POST /api/messages/:matchId/nda-sign  { projectId }
// Signs the NDA — generates a PDF, uploads to Cloudinary, records it, notifies via chat
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

    const projectRows = await query('SELECT * FROM projects WHERE id = ? AND is_active = 1', [projectId]);
    const project = projectRows[0];
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const signerRows = await query('SELECT name FROM users WHERE id = ?', [userId]);
    const ownerRows  = await query('SELECT name FROM users WHERE id = ?', [project.user_id]);
    const signerName = signerRows[0]?.name || 'Unknown';
    const ownerName  = ownerRows[0]?.name  || 'Unknown';
    const signedAt   = new Date().toISOString().split('T')[0];

    // Generate PDF and store as BLOB in DB
    const pdfBuffer = await generateNdaPdf(signerName, ownerName, project.title, signedAt);

    await query(
      `INSERT INTO project_ndas (project_id, user_id, pdf_data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE pdf_data = VALUES(pdf_data)`,
      [projectId, userId, pdfBuffer]
    );

    const msg = await sendMessage(
      matchId, userId,
      'NDA signed. You now have access to the full project details.',
      'nda_signed',
      { projectId }
    );

    // If the signer is NOT the project owner, the owner wanted to share — auto-send project details
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

// POST /api/messages/:matchId/job-offer  { roleTitle, description }
// Only between two entrepreneurs
const sendJobOffer = async (req, res, next) => {
  try {
    const matchId = Number(req.params.matchId);
    const { roleTitle, description } = req.body;
    const senderId = req.user.id;

    if (!matchId) return res.status(400).json({ error: 'Invalid matchId' });
    if (!roleTitle?.trim()) return res.status(400).json({ error: 'roleTitle is required' });

    // Validate sender is entrepreneur
    if (req.user.role !== 'entrepreneur') {
      return res.status(403).json({ error: 'Only entrepreneurs can send job offers' });
    }

    // Validate match membership and get other user's role
    const matchRows = await query(
      'SELECT user1_id, user2_id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [matchId, senderId, senderId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    const otherId = matchRows[0].user1_id === senderId ? matchRows[0].user2_id : matchRows[0].user1_id;
    const otherRows = await query('SELECT role FROM users WHERE id = ?', [otherId]);
    if (otherRows[0]?.role !== 'entrepreneur') {
      return res.status(403).json({ error: 'Job offers can only be sent to other entrepreneurs' });
    }

    const msg = await sendMessage(matchId, senderId, `Job offer: ${roleTitle.trim()}`, 'job_offer', {
      roleTitle: roleTitle.trim(),
      description: description?.trim() || '',
    });

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

// POST /api/messages/:matchId/job-offer/respond  { messageId, accepted }
const respondToJobOffer = async (req, res, next) => {
  try {
    const matchId = Number(req.params.matchId);
    const { messageId, accepted } = req.body;
    const responderId = req.user.id;

    if (!matchId || !messageId) return res.status(400).json({ error: 'matchId and messageId are required' });

    const offerRows = await query(
      'SELECT * FROM messages WHERE id = ? AND match_id = ? AND message_type = ?',
      [messageId, matchId, 'job_offer']
    );
    if (!offerRows[0]) return res.status(404).json({ error: 'Job offer not found' });
    if (offerRows[0].sender_id === responderId) return res.status(400).json({ error: 'Cannot respond to your own offer' });

    const offerMeta = (() => { try { return JSON.parse(offerRows[0].metadata); } catch { return {}; } })();

    const msg = await sendMessage(matchId, responderId,
      accepted ? `Accepted job offer: ${offerMeta.roleTitle}` : `Declined job offer: ${offerMeta.roleTitle}`,
      'job_offer_response',
      { originalMessageId: messageId, accepted: !!accepted, roleTitle: offerMeta.roleTitle }
    );

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
};

const markRead = async (req, res, next) => {
  try {
    const matchId = Number(req.params.matchId);
    if (!matchId) return res.status(400).json({ error: 'Invalid matchId' });
    await markMessagesRead(matchId, req.user.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { conversations, messages, send, markRead, sendInvite, respondToInvite, requestNda, signNda, shareProject, sendJobOffer, respondToJobOffer };

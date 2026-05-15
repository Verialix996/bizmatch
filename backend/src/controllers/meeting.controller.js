const { createMeeting, getMeetingById, getMeetingsForUser, updateMeetingStatus, saveBriefing, toMysqlDatetime } = require('../models/meeting.model');
const { sendMessage } = require('../models/message.model');
const { query } = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');
const { emitNotification } = require('./notification.controller');

// POST /api/meetings  { matchId, title, scheduledAt, locationType, videoLink, address }
const propose = async (req, res, next) => {
  try {
    const proposerId = req.user.id;
    const { matchId, title, scheduledAt, locationType, videoLink, address } = req.body;

    if (!matchId || !scheduledAt || !locationType) {
      return res.status(400).json({ error: 'matchId, scheduledAt, and locationType are required' });
    }
    if (!['virtual', 'in_person'].includes(locationType)) {
      return res.status(400).json({ error: 'locationType must be virtual or in_person' });
    }
    if (locationType === 'virtual' && !videoLink) {
      return res.status(400).json({ error: 'videoLink is required for virtual meetings' });
    }
    if (locationType === 'in_person' && !address) {
      return res.status(400).json({ error: 'address is required for in-person meetings' });
    }

    const matchRows = await query(
      'SELECT id, user1_id, user2_id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
      [matchId, proposerId, proposerId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    const userRows = await query('SELECT is_premium, premium_expires_at FROM users WHERE id = ?', [proposerId]);
    const u = userRows[0];
    const isPremium = u?.is_premium && new Date(u?.premium_expires_at) > new Date();
    if (!isPremium) {
      const countRows = await query(
        "SELECT COUNT(*) AS cnt FROM meetings WHERE proposer_id = ? AND status = 'proposed'",
        [proposerId]
      );
      if ((countRows[0]?.cnt ?? 0) >= 3) {
        return res.status(429).json({ error: 'Meeting limit reached. Upgrade to Premium for unlimited meetings.', upgradeRequired: true });
      }
    }

    const match = matchRows[0];
    const receiverId = match.user1_id === proposerId ? match.user2_id : match.user1_id;

    const meeting = await createMeeting({ matchId, proposerId, receiverId, title, scheduledAt, locationType, videoLink, address });

    await sendMessage(matchId, proposerId, `Meeting proposed: ${title || 'Untitled'}`, 'meeting_proposal', {
      meetingId: meeting.id,
      title: meeting.title,
      scheduledAt: meeting.scheduled_at,
      locationType: meeting.location_type,
      address: meeting.address || null,
      videoLink: meeting.video_link || null,
      status: meeting.status,
    });

    emitNotification(receiverId, 'meeting', meeting.id, { title: meeting.title, matchId }).catch(() => {});

    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
};

// PUT /api/meetings/:id  { status: 'confirmed' | 'declined' | 'cancelled' }
const respond = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!['confirmed', 'declined', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'status must be confirmed, declined, or cancelled' });
    }

    const meeting = await getMeetingById(id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.receiver_id !== userId && meeting.proposer_id !== userId) {
      return res.status(403).json({ error: 'Not part of this meeting' });
    }
    if (status === 'cancelled') {
      const isProposer = meeting.proposer_id === userId;
      const isReceiverCancellingConfirmed = meeting.receiver_id === userId && meeting.status === 'confirmed';
      if (!isProposer && !isReceiverCancellingConfirmed) {
        return res.status(403).json({ error: 'You cannot cancel this meeting' });
      }
    }
    if (['confirmed', 'declined'].includes(status) && meeting.receiver_id !== userId) {
      return res.status(403).json({ error: 'Only the receiver can confirm or decline' });
    }

    const updated = await updateMeetingStatus(id, userId, status);

    await sendMessage(meeting.match_id, userId, `Meeting ${status}`, 'meeting_response', {
      meetingId: id,
      status,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// GET /api/meetings
const list = async (req, res, next) => {
  try {
    res.json(await getMeetingsForUser(req.user.id));
  } catch (err) {
    next(err);
  }
};

// GET /api/meetings/:id/briefing  — AI due diligence report
const briefing = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const id = Number(req.params.id);

    const meeting = await getMeetingById(id);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.proposer_id !== userId && meeting.receiver_id !== userId) {
      return res.status(403).json({ error: 'Not part of this meeting' });
    }

    if (meeting.ai_briefing) {
      return res.json(JSON.parse(meeting.ai_briefing));
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI briefing not configured' });
    }

    const MAX_DAILY = parseInt(process.env.MAX_DAILY_BRIEFINGS || '50', 10);
    const usageRows = await query('SELECT briefing_count FROM api_usage WHERE date = CURDATE()');
    if ((usageRows[0]?.briefing_count ?? 0) >= MAX_DAILY) {
      return res.status(429).json({ error: 'Daily AI briefing limit reached. Try again tomorrow.' });
    }

    const otherId = meeting.proposer_id === userId ? meeting.receiver_id : meeting.proposer_id;

    const [profileRows, projectRows] = await Promise.all([
      query(
        `SELECT u.name, u.role, p.bio, p.skills, p.hobbies, p.role_type,
                p.investment_domain, p.preferred_stage, p.max_investment
         FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`,
        [otherId]
      ),
      query(
        `SELECT title, description, industry, stage, funding_needed
         FROM projects WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 3`,
        [otherId]
      ),
    ]);

    const other = profileRows[0];
    if (!other) return res.status(404).json({ error: 'Other user not found' });

    const projectSummary = projectRows.length
      ? projectRows.map(p => `- ${p.title} (${p.stage}, ${p.industry}, $${p.funding_needed?.toLocaleString() || 'N/A'})`).join('\n')
      : 'No active projects.';

    const prompt = `You are a business meeting preparation assistant for BizMatch, a startup matchmaking platform.

Generate a structured due diligence briefing for a meeting with the following person. Respond ONLY with valid JSON matching this exact structure:
{
  "personSummary": "2-3 sentence overview of who they are",
  "matchRationale": "1-2 sentences on why you two connected",
  "talkingPoints": ["point 1", "point 2", "point 3"],
  "questionsToAsk": ["question 1", "question 2", "question 3"],
  "watchOutFor": ["concern 1", "concern 2"]
}

Person profile:
- Name: ${other.name}
- Role: ${other.role} (${other.role_type || other.role})
- Bio: ${other.bio || 'Not provided'}
- Skills: ${other.skills || 'Not provided'}
- Investment domain: ${other.investment_domain || 'N/A'}
- Preferred stage: ${other.preferred_stage || 'N/A'}
- Max investment: ${other.max_investment ? '$' + Number(other.max_investment).toLocaleString() : 'N/A'}
- Projects:\n${projectSummary}`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0]?.text?.trim() || '{}';
    const briefingData = JSON.parse(raw);

    await saveBriefing(id, JSON.stringify(briefingData));
    await query(
      `INSERT INTO api_usage (date, briefing_count) VALUES (CURDATE(), 1)
       ON DUPLICATE KEY UPDATE briefing_count = briefing_count + 1`
    );
    res.json(briefingData);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/meetings/:id/reschedule  { scheduledAt, videoLink?, address? }
const reschedule = async (req, res, next) => {
  try {
    const meetingId = Number(req.params.id);
    const userId = req.user.id;
    const { scheduledAt, videoLink, address } = req.body;

    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });

    const meeting = await getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
    if (meeting.receiver_id !== userId) return res.status(403).json({ error: 'Only the receiver can reschedule' });
    if (meeting.status !== 'proposed') return res.status(400).json({ error: 'Can only reschedule a proposed meeting' });

    await query(
      `UPDATE meetings SET
         scheduled_at = ?,
         video_link   = ?,
         address      = ?,
         proposer_id  = receiver_id,
         receiver_id  = proposer_id,
         status       = 'proposed'
       WHERE id = ?`,
      [toMysqlDatetime(scheduledAt), videoLink || null, address || null, meetingId]
    );

    const updated = await getMeetingById(meetingId);

    await sendMessage(
      meeting.match_id, userId,
      `Meeting rescheduled to ${new Date(scheduledAt).toLocaleString()}. Please confirm or decline.`,
      'meeting_response',
      { meetingId, status: 'rescheduled' }
    );

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = { propose, respond, list, briefing, reschedule };

const { createMeeting, getMeetingById, getMeetingsForUser, updateMeetingStatus } = require('../models/meeting.model');
const { sendMessage } = require('../models/message.model');
const { query } = require('../config/db');
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
      'SELECT id, user1_id, user2_id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
      [matchId, proposerId]
    );
    if (!matchRows[0]) return res.status(403).json({ error: 'Not part of this match' });

    const isPremium = req.user.is_premium && new Date(req.user.premium_expires_at) > new Date();
    if (!isPremium) {
      return res.status(403).json({ error: 'Meeting proposals are a Premium feature. Upgrade to send meeting invites.', upgradeRequired: true });
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
    const id = req.params.id;
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

// PATCH /api/meetings/:id/reschedule  { scheduledAt, locationType?, videoLink?, address? }
const reschedule = async (req, res, next) => {
  try {
    const meetingId = req.params.id;
    const userId = req.user.id;
    const { scheduledAt, locationType, videoLink, address } = req.body;

    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });

    const meeting = await getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: 'Meeting not found' });

    const isParticipant = meeting.proposer_id === userId || meeting.receiver_id === userId;
    if (!isParticipant) return res.status(403).json({ error: 'Not part of this meeting' });

    if (!['proposed', 'confirmed'].includes(meeting.status)) {
      return res.status(400).json({ error: 'Can only reschedule a proposed or confirmed meeting' });
    }
    if (meeting.status === 'proposed' && meeting.receiver_id !== userId) {
      return res.status(403).json({ error: 'Only the receiver can reschedule a proposed meeting' });
    }

    const otherUserId = meeting.proposer_id === userId ? meeting.receiver_id : meeting.proposer_id;
    const newLocationType = locationType || meeting.location_type;

    await query(
      `UPDATE meetings SET
         scheduled_at  = $1,
         location_type = $2,
         video_link    = $3,
         address       = $4,
         proposer_id   = $5,
         receiver_id   = $6,
         status        = 'proposed'
       WHERE id = $7`,
      [
        scheduledAt,
        newLocationType,
        newLocationType === 'virtual'   ? (videoLink || null) : null,
        newLocationType === 'in_person' ? (address  || null)  : null,
        userId, otherUserId, meetingId,
      ]
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

module.exports = { propose, respond, list, reschedule };

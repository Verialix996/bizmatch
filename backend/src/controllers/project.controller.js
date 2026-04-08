const path = require('path');
const multer = require('multer');
const {
  createProject, getProjectsByUser, getProjectById, updateProject, deleteProject,
  getProjectFeed, swipeProject, getProjectMatches,
  getProjectPartners, addProjectPartner, removeProjectPartner,
  setProjectVisibility,
  getNdaStatus, signNda,
  createPartnerInvitation, getPartnerInvitation, respondPartnerInvitation,
} = require('../models/project.model');
const { sendMessage: sendMessageModel } = require('../models/message.model');
const { getDb } = require('../config/db');

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || 'uploads/',
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.pptx', '.ppt', '.mp4', '.mov', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// POST /api/projects/:id/upload-deck
const uploadDeck = [
  upload.single('deck'),
  (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const fileUrl = `/uploads/${req.file.filename}`;
      getDb().prepare('UPDATE projects SET deck_url = ? WHERE id = ? AND user_id = ?')
        .run(fileUrl, Number(req.params.id), req.user.id);
      res.json({ deck_url: fileUrl });
    } catch (err) { next(err); }
  },
];

// POST /api/projects/:id/upload-video
const uploadVideo = [
  upload.single('video'),
  (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const fileUrl = `/uploads/${req.file.filename}`;
      getDb().prepare('UPDATE projects SET video_url = ? WHERE id = ? AND user_id = ?')
        .run(fileUrl, Number(req.params.id), req.user.id);
      res.json({ video_url: fileUrl });
    } catch (err) { next(err); }
  },
];

// GET /api/projects/feed  — investor only
const feed = (req, res, next) => {
  try {
    if (req.user.role !== 'investor') {
      return res.status(403).json({ error: 'Only investors can browse the project feed' });
    }
    res.json(getProjectFeed(req.user.id));
  } catch (err) { next(err); }
};

// GET /api/projects/matches
const matches = (req, res, next) => {
  try {
    res.json(getProjectMatches(req.user.id, req.user.role));
  } catch (err) { next(err); }
};

// POST /api/projects/swipe
const swipe = (req, res, next) => {
  try {
    if (req.user.role !== 'investor') {
      return res.status(403).json({ error: 'Only investors can swipe on projects' });
    }
    const { projectId, direction } = req.body;
    if (!projectId || !['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'projectId and direction (like|pass) required' });
    }
    const result = swipeProject(req.user.id, Number(projectId), direction);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/projects/mine — entrepreneur's own projects
const mine = (req, res, next) => {
  try {
    res.json(getProjectsByUser(req.user.id));
  } catch (err) { next(err); }
};

// GET /api/projects/:id
const getOne = (req, res, next) => {
  try {
    const project = getProjectById(Number(req.params.id));
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { next(err); }
};

// POST /api/projects
const create = (req, res, next) => {
  try {
    if (req.user.role !== 'entrepreneur') {
      return res.status(403).json({ error: 'Only entrepreneurs can create projects' });
    }
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const project = createProject(req.user.id, req.body);
    res.status(201).json(project);
  } catch (err) { next(err); }
};

// PUT /api/projects/:id
const update = (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const project = updateProject(Number(req.params.id), req.user.id, req.body);
    res.json(project);
  } catch (err) { next(err); }
};

// DELETE /api/projects/:id
const remove = (req, res, next) => {
  try {
    deleteProject(Number(req.params.id), req.user.id);
    res.json({ message: 'Project removed' });
  } catch (err) { next(err); }
};

// GET /api/projects/:id/partners
const listPartners = (req, res, next) => {
  try {
    res.json(getProjectPartners(Number(req.params.id)));
  } catch (err) { next(err); }
};

// POST /api/projects/:id/partners  { partnerUserId }
const addPartner = (req, res, next) => {
  try {
    const { partnerUserId } = req.body;
    if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
    const result = addProjectPartner(Number(req.params.id), req.user.id, Number(partnerUserId));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// DELETE /api/projects/:id/partners/:userId
const removePartner = (req, res, next) => {
  try {
    const result = removeProjectPartner(Number(req.params.id), req.user.id, Number(req.params.userId));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// PATCH /api/projects/:id/visibility  { visibility: 'public'|'private' }
const setVisibility = (req, res, next) => {
  try {
    const { visibility } = req.body;
    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be public or private' });
    }
    const result = setProjectVisibility(Number(req.params.id), req.user.id, visibility);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/projects/:id/nda-status
const ndaStatus = (req, res, next) => {
  try {
    const signed = getNdaStatus(Number(req.params.id), req.user.id);
    res.json({ signed });
  } catch (err) { next(err); }
};

// POST /api/projects/:id/sign-nda
const ndaSign = (req, res, next) => {
  try {
    signNda(Number(req.params.id), req.user.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// POST /api/projects/:id/invite-partner  { matchId, inviteeId }
const invitePartner = (req, res, next) => {
  try {
    if (req.user.role !== 'entrepreneur') {
      return res.status(403).json({ error: 'Only entrepreneurs can invite partners' });
    }
    const { matchId, inviteeId } = req.body;
    if (!matchId || !inviteeId) {
      return res.status(400).json({ error: 'matchId and inviteeId required' });
    }
    const result = createPartnerInvitation(
      Number(req.params.id), Number(matchId), req.user.id, Number(inviteeId)
    );
    if (result.error) return res.status(400).json({ error: result.error });

    // Send a typed chat message so the invitee sees it in the conversation
    const body = `You've been invited to join "${result.projectTitle}" as a partner.`;
    sendMessageModel(Number(matchId), req.user.id, body, 'partner_invite', {
      invitationId: result.invitationId,
      projectId: Number(req.params.id),
      projectTitle: result.projectTitle,
    });

    res.json({ ok: true, invitationId: result.invitationId });
  } catch (err) { next(err); }
};

// POST /api/partner-invitations/:id/respond  { accept: true|false }
const respondInvitation = (req, res, next) => {
  try {
    const { accept } = req.body;
    if (typeof accept !== 'boolean') {
      return res.status(400).json({ error: 'accept (boolean) required' });
    }
    const result = respondPartnerInvitation(
      Number(req.params.id), req.user.id, accept ? 'accepted' : 'declined'
    );
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = {
  feed, matches, swipe, mine, getOne, create, update, remove,
  uploadDeck, uploadVideo,
  listPartners, addPartner, removePartner,
  setVisibility, ndaStatus, ndaSign, invitePartner, respondInvitation,
};

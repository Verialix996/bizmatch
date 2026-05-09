const {
  createProject, getProjectsByUser, getProjectById, updateProject, deleteProject,
  getProjectFeed, swipeProject, getProjectMatches,
  getProjectPartners, addProjectPartner, removeProjectPartner,
  getJoinedProjects, getProjectsByOwner,
} = require('../models/project.model');
const { query } = require('../config/db');
const { uploadDeck: deckUpload, uploadVideo: videoUpload } = require('../middleware/upload');

// POST /api/projects/:id/upload-deck
const uploadDeck = [
  deckUpload,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const fileUrl = req.file.path;
      await query('UPDATE projects SET deck_url = ? WHERE id = ? AND user_id = ?',
        [fileUrl, Number(req.params.id), req.user.id]);
      res.json({ deck_url: fileUrl });
    } catch (err) { next(err); }
  },
];

// POST /api/projects/:id/upload-video
const uploadVideo = [
  videoUpload,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const fileUrl = req.file.path;
      await query('UPDATE projects SET video_url = ? WHERE id = ? AND user_id = ?',
        [fileUrl, Number(req.params.id), req.user.id]);
      res.json({ video_url: fileUrl });
    } catch (err) { next(err); }
  },
];

// GET /api/projects/feed  — investor only
const feed = async (req, res, next) => {
  try {
    if (req.user.role !== 'investor') {
      return res.status(403).json({ error: 'Only investors can browse the project feed' });
    }
    res.json(await getProjectFeed(req.user.id));
  } catch (err) { next(err); }
};

// GET /api/projects/matches
const matches = async (req, res, next) => {
  try {
    res.json(await getProjectMatches(req.user.id, req.user.role));
  } catch (err) { next(err); }
};

// POST /api/projects/swipe
const swipe = async (req, res, next) => {
  try {
    if (req.user.role !== 'investor') {
      return res.status(403).json({ error: 'Only investors can swipe on projects' });
    }
    const { projectId, direction } = req.body;
    if (!projectId || !['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'projectId and direction (like|pass) required' });
    }
    const result = await swipeProject(req.user.id, Number(projectId), direction);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/projects/mine — entrepreneur's own projects
const mine = async (req, res, next) => {
  try {
    res.json(await getProjectsByUser(req.user.id));
  } catch (err) { next(err); }
};

// GET /api/projects/:id
const getOne = async (req, res, next) => {
  try {
    const project = await getProjectById(Number(req.params.id));
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { next(err); }
};

// POST /api/projects
const create = async (req, res, next) => {
  try {
    if (req.user.role !== 'entrepreneur') {
      return res.status(403).json({ error: 'Only entrepreneurs can create projects' });
    }
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const project = await createProject(req.user.id, req.body);
    res.status(201).json(project);
  } catch (err) { next(err); }
};

// PUT /api/projects/:id
const update = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const project = await updateProject(Number(req.params.id), req.user.id, req.body);
    res.json(project);
  } catch (err) { next(err); }
};

// DELETE /api/projects/:id
const remove = async (req, res, next) => {
  try {
    await deleteProject(Number(req.params.id), req.user.id);
    res.json({ message: 'Project removed' });
  } catch (err) { next(err); }
};

// GET /api/projects/:id/partners
const listPartners = async (req, res, next) => {
  try {
    res.json(await getProjectPartners(Number(req.params.id)));
  } catch (err) { next(err); }
};

// POST /api/projects/:id/partners  { partnerUserId }
const addPartner = async (req, res, next) => {
  try {
    const { partnerUserId } = req.body;
    if (!partnerUserId) return res.status(400).json({ error: 'partnerUserId required' });
    const result = await addProjectPartner(Number(req.params.id), req.user.id, Number(partnerUserId));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// DELETE /api/projects/:id/partners/:userId
const removePartner = async (req, res, next) => {
  try {
    const result = await removeProjectPartner(Number(req.params.id), req.user.id, Number(req.params.userId));
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (err) { next(err); }
};

// GET /api/projects/joined — projects the current user is a partner on
const joined = async (req, res, next) => {
  try {
    res.json(await getJoinedProjects(req.user.id));
  } catch (err) { next(err); }
};

// GET /api/projects/owner/:userId — public project list for a user (for NDA/invite flows)
const byOwner = async (req, res, next) => {
  try {
    res.json(await getProjectsByOwner(Number(req.params.userId)));
  } catch (err) { next(err); }
};

module.exports = { feed, matches, swipe, mine, joined, byOwner, getOne, create, update, remove, uploadDeck, uploadVideo, listPartners, addPartner, removePartner };

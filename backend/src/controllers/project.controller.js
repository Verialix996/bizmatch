const {
  createProject, getProjectsByUser, getProjectById, updateProject, deleteProject,
} = require('../models/project.model');
const { query } = require('../config/db');
const { uploadDeck: deckUpload, uploadVideo: videoUpload } = require('../middleware/upload');
const { getModel } = require('../config/gemini');
const { moderateText } = require('../services/moderation.service');
const supabase = require('../config/supabase');

// POST /api/projects/:id/upload-deck — uploads to Cloudinary, stores URL
const uploadDeck = [
  deckUpload,
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const url = req.file.path; // Cloudinary secure URL
      await query('UPDATE projects SET deck_url = $1 WHERE id = $2 AND user_id = $3', [url, req.params.id, req.user.id]);
      res.json({ deck_url: url });
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
      await query('UPDATE projects SET video_url = $1 WHERE id = $2 AND user_id = $3', [fileUrl, req.params.id, req.user.id]);
      res.json({ video_url: fileUrl });
    } catch (err) { next(err); }
  },
];

// GET /api/projects/mine — entrepreneur's own projects
const mine = async (req, res, next) => {
  try {
    res.json(await getProjectsByUser(req.user.id));
  } catch (err) { next(err); }
};

// GET /api/projects/:id
const getOne = async (req, res, next) => {
  try {
    const project = await getProjectById(req.params.id);
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
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const titleMod = await moderateText(title);
    if (!titleMod.ok) return res.status(400).json({ error: `Title flagged by moderation: ${titleMod.reason}` });
    if (description) {
      const mod = await moderateText(description);
      if (!mod.ok) return res.status(400).json({ error: `Description flagged by moderation: ${mod.reason}` });
    }
    const project = await createProject(req.user.id, req.body);
    res.status(201).json(project);
  } catch (err) { next(err); }
};

// PUT /api/projects/:id
const update = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });
    const titleMod = await moderateText(title);
    if (!titleMod.ok) return res.status(400).json({ error: `Title flagged by moderation: ${titleMod.reason}` });
    if (description) {
      const mod = await moderateText(description);
      if (!mod.ok) return res.status(400).json({ error: `Description flagged by moderation: ${mod.reason}` });
    }
    const project = await updateProject(req.params.id, req.user.id, req.body);
    res.json(project);
  } catch (err) { next(err); }
};

// DELETE /api/projects/:id
const remove = async (req, res, next) => {
  try {
    await deleteProject(req.params.id, req.user.id);
    res.json({ message: 'Project removed' });
  } catch (err) { next(err); }
};

// POST /api/projects/:id/deck-review
const reviewDeck = async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const userId = req.user.id;

    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI review not configured' });

    const rows = await query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    if (!rows[0]) return res.status(403).json({ error: 'Project not found or not yours' });
    if (!rows[0].deck_url) return res.status(400).json({ error: 'Upload a pitch deck first' });

    // Fetch deck from Cloudinary URL
    const deckUrl = rows[0].deck_url;
    const pdfRes = await fetch(deckUrl);
    if (!pdfRes.ok) return res.status(502).json({ error: 'Failed to fetch pitch deck from storage' });
    const base64 = Buffer.from(await pdfRes.arrayBuffer()).toString('base64');

    const model = getModel();
    const result = await model.generateContent([
      { inlineData: { mimeType: 'application/pdf', data: base64 } },
      { text: `You are an experienced startup investor reviewing a pitch deck for investment readiness.

Evaluate the document ONLY as a business pitch deck against these standard investor criteria:
1. Problem statement — is a clear real-world problem defined?
2. Solution — is the product/service clearly explained?
3. Market size — is TAM/SAM/SOM or market opportunity shown?
4. Business model — how does the company make money?
5. Traction — any users, revenue, partnerships, or milestones?
6. Team — are founders/key people introduced with relevant background?
7. Financial projections — are growth forecasts or unit economics shown?
8. Funding ask — is the amount sought and its use of funds stated?

If the document is NOT a business pitch deck (e.g. it is a spreadsheet, equation, academic paper, or unrelated content), set overallScore to 1 and state clearly in weaknesses that this does not appear to be a pitch deck.

Respond ONLY with valid JSON, no markdown:
{"strengths":["..."],"weaknesses":["..."],"suggestions":["..."],"overallScore":7}` },
    ]);

    const raw = result.response.text().trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      res.json(JSON.parse(cleaned));
    } catch {
      res.status(500).json({ error: 'AI returned an unexpected format. Please try again.' });
    }
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:id/deck — proxy from Cloudinary with correct Content-Type
const serveDeck = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    const rows = await query('SELECT deck_url FROM projects WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    const deckUrl = rows[0].deck_url;
    if (!deckUrl) return res.status(404).json({ error: 'No pitch deck uploaded' });

    const response = await fetch(deckUrl);
    if (!response.ok) return res.status(502).json({ error: 'Failed to fetch deck from storage' });
    const buf = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="pitch-deck.pdf"');
    res.send(buf);
  } catch (err) { next(err); }
};

module.exports = { mine, getOne, create, update, remove, uploadDeck, uploadVideo, reviewDeck, serveDeck };

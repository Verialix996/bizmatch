const { getFeed, recordSwipe, getMatches } = require('../models/match.model');
const { query } = require('../config/db');
const { getModel } = require('../config/gemini');

const DAILY_SWIPE_LIMIT = 20;

const feed = async (req, res, next) => {
  try {
    const candidates = await getFeed(req.user.id, req.user.role);
    res.json(candidates);
  } catch (err) {
    next(err);
  }
};

const swipe = async (req, res, next) => {
  try {
    const { targetUserId, direction, superLike } = req.body;

    if (!targetUserId || !['like', 'pass'].includes(direction)) {
      return res.status(400).json({ error: 'targetUserId and direction (like|pass) are required' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ error: 'Cannot swipe on yourself' });
    }

    const isPremium = req.user.is_premium && new Date(req.user.premium_expires_at) > new Date();

    if (!isPremium) {
      const countRows = await query(
        `SELECT CASE WHEN swipe_count_date = current_date THEN swipe_count ELSE 0 END AS today_count
         FROM user_activity WHERE user_id = $1`,
        [req.user.id]
      );
      const todayCount = countRows[0]?.today_count ?? 0;
      if (todayCount >= DAILY_SWIPE_LIMIT) {
        return res.status(429).json({ error: 'Daily swipe limit reached', upgradeRequired: true });
      }
      await query(
        `INSERT INTO user_activity (user_id, swipe_count, swipe_count_date)
         VALUES ($1, 1, current_date)
         ON CONFLICT (user_id) DO UPDATE SET
           swipe_count = CASE WHEN user_activity.swipe_count_date = current_date
                              THEN user_activity.swipe_count + 1 ELSE 1 END,
           swipe_count_date = current_date`,
        [req.user.id]
      );
    }

    const isSuperLike = superLike === true && isPremium;
    const result = await recordSwipe(req.user.id, targetUserId, direction, isSuperLike);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const matches = async (req, res, next) => {
  try {
    res.json(await getMatches(req.user.id));
  } catch (err) {
    next(err);
  }
};

const compatibility = async (req, res, next) => {
  try {
    const viewerId = req.user.id;
    const targetId = req.params.targetUserId;
    if (!targetId) return res.status(400).json({ error: 'targetUserId required' });

    if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'AI unavailable' });

    const profileQuery = `
      SELECT u.name, u.role, u.bio, u.skills, ip.investment_domain, ip.preferred_stage, ip.max_investment,
             proj.stage AS venture_stage, proj.funding_needed AS funding_needs
      FROM users u
      LEFT JOIN investor_profiles ip ON ip.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT p.stage, p.funding_needed FROM projects p
        WHERE p.user_id = u.id AND p.is_active = true
        ORDER BY p.id DESC LIMIT 1
      ) proj ON true
      WHERE u.id = $1`;

    const [viewerRows, targetRows] = await Promise.all([
      query(profileQuery, [viewerId]),
      query(profileQuery, [targetId]),
    ]);

    const v = viewerRows[0];
    const t = targetRows[0];
    if (!v || !t) return res.status(404).json({ error: 'User not found' });

    const skillsList = s => (Array.isArray(s) ? s.join(', ') : '');

    const prompt = `You are a business matchmaking AI. Analyze compatibility between two users and return ONLY valid JSON — no markdown, no explanation.
{"score":<0-100>,"pros":["...","..."],"cons":["...","..."]}

${v.name} (${v.role}): bio="${v.bio || ''}", skills="${skillsList(v.skills)}", stage=${v.venture_stage || v.preferred_stage || ''}, domain=${v.investment_domain || ''}, maxInvest=${v.max_investment || ''}, needsFunding=${v.funding_needs || ''}
${t.name} (${t.role}): bio="${t.bio || ''}", skills="${skillsList(t.skills)}", stage=${t.venture_stage || t.preferred_stage || ''}, domain=${t.investment_domain || ''}, maxInvest=${t.max_investment || ''}, needsFunding=${t.funding_needs || ''}

Provide 2-4 pros and 1-3 cons. Be specific and business-focused.`;

    const model = getModel();
    const result = await model.generateContent(prompt);

    let parsed;
    try {
      const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'AI response parse error' });
    }

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const pros = Array.isArray(parsed.pros) ? parsed.pros : [];
    const cons = Array.isArray(parsed.cons) ? parsed.cons : [];

    res.json({ score, pros, cons });
  } catch (err) {
    next(err);
  }
};

module.exports = { feed, swipe, matches, compatibility };

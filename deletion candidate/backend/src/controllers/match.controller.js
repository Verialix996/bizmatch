const { getFeed, recordSwipe, getMatches } = require('../models/match.model');
const { query } = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');

const DAILY_SWIPE_LIMIT = 20;

const feed = async (req, res, next) => {
  try {
    const mode = req.query.mode === 'partners' ? 'partners' : 'investors';
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;
    const candidates = await getFeed(req.user.id, req.user.role, mode, projectId);
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

    // Premium check + daily swipe limit
    const userRows = await query(
      `SELECT is_premium, premium_expires_at,
              IF(swipe_count_date = CURDATE(), swipe_count, 0) AS today_count
       FROM user_app_state WHERE user_id = ?`,
      [req.user.id]
    );
    const u = userRows[0];
    const isPremium = u?.is_premium && new Date(u?.premium_expires_at) > new Date();

    if (!isPremium) {
      if ((u?.today_count ?? 0) >= DAILY_SWIPE_LIMIT) {
        return res.status(429).json({ error: 'Daily swipe limit reached', upgradeRequired: true });
      }
      await query(
        `UPDATE user_app_state SET
           swipe_count = IF(swipe_count_date = CURDATE(), swipe_count + 1, 1),
           swipe_count_date = CURDATE()
         WHERE user_id = ?`,
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
    const targetId = Number(req.params.targetUserId);
    if (!targetId) return res.status(400).json({ error: 'targetUserId required' });

    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI unavailable' });

    const [viewerRows, targetRows] = await Promise.all([
      query(`SELECT u.name, u.role, up.bio, up.skills, ip.investment_domain, ip.preferred_stage, ip.max_investment,
                    proj.stage AS venture_stage, proj.funding_needed AS funding_needs
             FROM users u
             LEFT JOIN user_profiles up ON up.user_id = u.id
             LEFT JOIN investor_profiles ip ON ip.user_id = u.id
             LEFT JOIN (
               SELECT pr.user_id, pr.stage, pr.funding_needed
               FROM projects pr
               INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
             ) proj ON proj.user_id = u.id
             WHERE u.id = ?`, [viewerId]),
      query(`SELECT u.name, u.role, up.bio, up.skills, ip.investment_domain, ip.preferred_stage, ip.max_investment,
                    proj.stage AS venture_stage, proj.funding_needed AS funding_needs
             FROM users u
             LEFT JOIN user_profiles up ON up.user_id = u.id
             LEFT JOIN investor_profiles ip ON ip.user_id = u.id
             LEFT JOIN (
               SELECT pr.user_id, pr.stage, pr.funding_needed
               FROM projects pr
               INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
             ) proj ON proj.user_id = u.id
             WHERE u.id = ?`, [targetId]),
    ]);

    const v = viewerRows[0];
    const t = targetRows[0];
    if (!v || !t) return res.status(404).json({ error: 'User not found' });

    const safeArr = s => { try { return JSON.parse(s || '[]').join(', '); } catch { return s || ''; } };

    const prompt = `You are a business matchmaking AI. Analyze compatibility between two users and return ONLY valid JSON — no markdown, no explanation.
{"score":<0-100>,"pros":["...","..."],"cons":["...","..."]}

${v.name} (${v.role}): bio="${v.bio || ''}", skills="${safeArr(v.skills)}", stage=${v.venture_stage || v.preferred_stage || ''}, domain=${v.investment_domain || ''}, maxInvest=${v.max_investment || ''}, needsFunding=${v.funding_needs || ''}
${t.name} (${t.role}): bio="${t.bio || ''}", skills="${safeArr(t.skills)}", stage=${t.venture_stage || t.preferred_stage || ''}, domain=${t.investment_domain || ''}, maxInvest=${t.max_investment || ''}, needsFunding=${t.funding_needs || ''}

Provide 2-4 pros and 1-3 cons. Be specific and business-focused.`;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages: [{ role: 'user', content: prompt }],
    });

    let parsed;
    try {
      const raw = response.content[0].text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
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

const getNdaStatus = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    const rows = await query(
      'SELECT id FROM project_ndas WHERE user_id = ? AND project_id = ?',
      [req.user.id, Number(projectId)]
    );
    res.json({ signed: !!rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { feed, swipe, matches, compatibility, getNdaStatus };

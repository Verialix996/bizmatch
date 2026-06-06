const { query } = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');
const { sendPushNotification } = require('../services/notification.service');
const { emitNotification } = require('../controllers/notification.controller');

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const STAGE_LADDER = ['idea', 'mvp', 'growth', 'scale'];

function stageScore(stageA, stageB) {
  const i = STAGE_LADDER.indexOf((stageA || '').toLowerCase());
  const j = STAGE_LADDER.indexOf((stageB || '').toLowerCase());
  if (i === -1 || j === -1) return 0;
  const diff = Math.abs(i - j);
  if (diff === 0) return 40;
  if (diff === 1) return 20;
  if (diff === 2) return 5;
  return 0;
}

function budgetScore(maxInvestment, fundingNeeds) {
  if (maxInvestment == null || fundingNeeds == null || fundingNeeds === 0) return 0;
  const ratio = maxInvestment / fundingNeeds;
  if (ratio >= 1)    return 30;
  if (ratio >= 0.75) return 20;
  if (ratio >= 0.5)  return 10;
  return 0;
}

function jaccardScore(textA, textB, maxPts) {
  const tokenize = t => new Set((t || '').toLowerCase().split(/[\s,;|]+/).filter(Boolean));
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return Math.round((intersection / union) * maxPts);
}

function completenessBonus(profile) {
  let bonus = 0;
  if (profile.photo_url) bonus += 3;
  if ((profile.bio || '').length > 50) bonus += 4;
  if (safeParseArray(profile.skills).length >= 2) bonus += 3;
  return bonus;
}

// When aiScore is present it dominates (60 pts); stage+budget become secondary signals.
// Without aiScore, falls back to Jaccard-based math scoring.
function scoreInvestorEntrepreneur(investorProfile, entrepreneurProfile, aiScore = null) {
  let score = 0;

  if (aiScore != null) {
    score += Math.round(aiScore / 100 * 60); // AI: 0-60 pts (primary)
    score += Math.round(stageScore(investorProfile.preferred_stage, entrepreneurProfile.venture_stage) / 40 * 20); // stage: 0-20
    score += Math.round(budgetScore(investorProfile.max_investment, entrepreneurProfile.funding_needs) / 30 * 10); // budget: 0-10
  } else {
    score += stageScore(investorProfile.preferred_stage, entrepreneurProfile.venture_stage); // 0-40
    score += budgetScore(investorProfile.max_investment, entrepreneurProfile.funding_needs); // 0-30
    const domainText = investorProfile.investment_domain || '';
    const entText = [
      ...(safeParseArray(entrepreneurProfile.skills)),
      entrepreneurProfile.bio || '',
    ].join(' ');
    score += jaccardScore(domainText, entText, 30); // 0-30
  }

  score += completenessBonus(entrepreneurProfile); // 0-10

  return score;
}

// When aiScore is present it dominates (60 pts); falls back to hobby/skill math.
function scoreEntrepreneurEntrepreneur(profileA, profileB, aiScore = null) {
  let score = 0;

  if (aiScore != null) {
    score += Math.round(aiScore / 100 * 60); // AI: 0-60 pts (primary)
  } else {
    const hobbiesA = safeParseArray(profileA.hobbies).map(h => h.toLowerCase());
    const hobbiesB = safeParseArray(profileB.hobbies).map(h => h.toLowerCase());
    const sharedHobbies = hobbiesA.filter(h => hobbiesB.includes(h));
    score += sharedHobbies.length * 20;

    const skillsA = safeParseArray(profileA.skills).map(s => s.toLowerCase());
    const skillsB = safeParseArray(profileB.skills).map(s => s.toLowerCase());
    const complementary = skillsB.filter(s => !skillsA.includes(s));
    score += complementary.length * 10;
  }

  score += completenessBonus(profileB); // 0-10

  return score;
}

function safeParseArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// AI scoring — synchronous with timeout, max N candidates
// ---------------------------------------------------------------------------

async function ensureAiScores(userId, userRole, myProfile, candidates, selectedProject = null, maxNew = 10) {
  if (!process.env.ANTHROPIC_API_KEY || !myProfile || candidates.length === 0) return;

  const candidateIds = candidates.map(c => c.user_id);
  const placeholders = candidateIds.map(() => '?').join(',');
  const cached = await query(
    `SELECT candidate_id FROM ai_match_scores WHERE user_id = ? AND candidate_id IN (${placeholders})`,
    [userId, ...candidateIds]
  );
  const cachedSet = new Set(cached.map(r => r.candidate_id));
  const uncached = candidates.filter(c => !cachedSet.has(c.user_id)).slice(0, maxNew);

  if (uncached.length === 0) return;

  const client = new Anthropic();

  const buildPrompt = (candidate) => {
    if (userRole === 'investor' && candidate.role_type === 'entrepreneur') {
      return `Rate investor-entrepreneur compatibility 0-100. Reply with ONLY a number.
Investor: domain=${myProfile.investment_domain || 'N/A'}, preferred stage=${myProfile.preferred_stage || 'N/A'}, max invest=$${myProfile.max_investment || 0}.
Entrepreneur: bio=${candidate.bio || 'N/A'}, skills=${safeParseArray(candidate.skills).join(', ') || 'N/A'}, industry=${candidate.project_industry || 'N/A'}, stage=${candidate.venture_stage || 'N/A'}, needs=$${candidate.funding_needs || 0}.`;
    }
    if (userRole === 'entrepreneur' && candidate.role_type === 'investor') {
      const stage = selectedProject?.stage || myProfile.venture_stage || 'N/A';
      const needs = selectedProject?.funding_needed || myProfile.funding_needs || 0;
      const projectDesc = selectedProject ? `, project="${selectedProject.title || ''} - ${selectedProject.description || ''}"` : '';
      return `Rate investor-entrepreneur compatibility 0-100. Reply with ONLY a number.
Investor: domain=${candidate.investment_domain || 'N/A'}, preferred stage=${candidate.preferred_stage || 'N/A'}, max invest=$${candidate.max_investment || 0}.
Entrepreneur: bio=${myProfile.bio || 'N/A'}, skills=${safeParseArray(myProfile.skills).join(', ') || 'N/A'}, stage=${stage}, needs=$${needs}${projectDesc}.`;
    }
    return `Rate collaboration potential 0-100. Reply with ONLY a number.
Person A: bio=${myProfile.bio || 'N/A'}, skills=${safeParseArray(myProfile.skills).join(', ') || 'N/A'}, hobbies=${safeParseArray(myProfile.hobbies).join(', ') || 'N/A'}.
Person B: bio=${candidate.bio || 'N/A'}, skills=${safeParseArray(candidate.skills).join(', ') || 'N/A'}, hobbies=${safeParseArray(candidate.hobbies).join(', ') || 'N/A'}.`;
  };

  await Promise.allSettled(
    uncached.map(async (candidate) => {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 5,
        messages: [{ role: 'user', content: buildPrompt(candidate) }],
      });
      const raw = response.content[0]?.text?.trim();
      const score = parseInt(raw, 10);
      if (isNaN(score)) return;
      const clamped = Math.max(0, Math.min(100, score));
      await query(
        'INSERT IGNORE INTO ai_match_scores (user_id, candidate_id, score) VALUES (?, ?, ?)',
        [userId, candidate.user_id, clamped]
      );
    })
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

async function getFeed(userId, userRole, mode = 'investors', projectId = null, limit = 20) {
  const allSwiped = await query(
    'SELECT swiped_id, direction FROM swipes WHERE swiper_id = ?',
    [userId]
  );

  const passedIds = allSwiped.filter(r => r.direction === 'pass').map(r => r.swiped_id);
  const likedIds  = allSwiped.filter(r => r.direction === 'like').map(r => r.swiped_id);
  const excludeIds = [userId, ...likedIds];
  const placeholders = excludeIds.map(() => '?').join(',');

  const roleFilter = (mode === 'partners' || userRole === 'investor') ? 'entrepreneur' : 'investor';

  const candidates = await query(
    `SELECT u.id, u.name, u.photo_url, u.is_premium, u.premium_expires_at, p.*,
            proj.stage AS venture_stage, proj.funding_needed AS funding_needs, proj.industry AS project_industry
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     LEFT JOIN (
       SELECT pr.user_id, pr.stage, pr.funding_needed, pr.industry
       FROM projects pr
       INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
     ) proj ON proj.user_id = u.id
     WHERE u.role = ?
       AND u.deleted_at IS NULL
       AND u.id NOT IN (${placeholders})`,
    [roleFilter, ...excludeIds]
  );

  const myProfileRows = await query(
    `SELECT p.*, proj.stage AS venture_stage, proj.funding_needed AS funding_needs
     FROM profiles p
     LEFT JOIN (
       SELECT pr.user_id, pr.stage, pr.funding_needed
       FROM projects pr
       INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
     ) proj ON proj.user_id = p.user_id
     WHERE p.user_id = ?`,
    [userId]
  );
  const myProfile = myProfileRows[0];

  // If a specific project was selected, load it for more accurate scoring
  let selectedProject = null;
  if (projectId && userRole === 'entrepreneur') {
    const pRows = await query(
      'SELECT stage, funding_needed, title, description, industry FROM projects WHERE id = ? AND user_id = ? AND is_active = 1',
      [projectId, userId]
    );
    selectedProject = pRows[0] || null;
  }

  // Ensure AI scores exist for up to 10 uncached candidates before scoring (5s timeout fallback)
  await Promise.race([
    ensureAiScores(userId, userRole, myProfile, candidates, selectedProject, 10),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]).catch(() => {});

  // Load cached AI scores for all candidates in one query
  const aiScoreMap = new Map();
  if (candidates.length > 0) {
    const cIds = candidates.map(c => c.user_id);
    const cPlaceholders = cIds.map(() => '?').join(',');
    const aiRows = await query(
      `SELECT candidate_id, score FROM ai_match_scores WHERE user_id = ? AND candidate_id IN (${cPlaceholders})`,
      [userId, ...cIds]
    );
    aiRows.forEach(r => aiScoreMap.set(r.candidate_id, r.score));
  }

  const toCard = (c, score) => ({
    userId: c.user_id,
    name: c.name,
    photoUrl: c.photo_url,
    isPremium: !!(c.is_premium && c.premium_expires_at && new Date(c.premium_expires_at) > new Date()),
    role: c.role_type,
    bio: c.bio,
    skills: safeParseArray(c.skills),
    hobbies: safeParseArray(c.hobbies),
    ventureStage: c.venture_stage,
    fundingNeeds: c.funding_needs,
    investmentDomain: c.investment_domain,
    preferredStage: c.preferred_stage,
    maxInvestment: c.max_investment,
    score,
    aiScore: aiScoreMap.get(c.user_id) ?? null,
  });

  const calcScore = (c) => {
    const aiScore = aiScoreMap.has(c.user_id) ? aiScoreMap.get(c.user_id) : null;
    if (userRole === 'investor' && c.role_type === 'entrepreneur') {
      return myProfile ? scoreInvestorEntrepreneur(myProfile, c, aiScore) : 0;
    } else if (userRole === 'entrepreneur' && c.role_type === 'investor') {
      if (!myProfile) return 0;
      if (selectedProject) {
        // Score investor against the selected project's specifics
        const projectProxy = {
          ...myProfile,
          venture_stage: selectedProject.stage,
          funding_needs: selectedProject.funding_needed,
        };
        return scoreInvestorEntrepreneur(c, projectProxy, aiScore);
      }
      return scoreInvestorEntrepreneur(c, myProfile, aiScore);
    } else if (userRole === 'entrepreneur' && c.role_type === 'entrepreneur') {
      return myProfile ? scoreEntrepreneurEntrepreneur(myProfile, c, aiScore) : 0;
    }
    return 0;
  };

  const fresh  = candidates.filter(c => !passedIds.includes(c.user_id));
  const passed = candidates.filter(c =>  passedIds.includes(c.user_id));

  const scoreAndSort = arr => arr.map(c => toCard(c, calcScore(c))).sort((a, b) => b.score - a.score);

  return [...scoreAndSort(fresh), ...scoreAndSort(passed)].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Swipe
// ---------------------------------------------------------------------------

async function recordSwipe(swiperId, swipedId, direction, isSuperLike = false) {
  await query(
    `INSERT INTO swipes (swiper_id, swiped_id, direction, is_super_like)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE direction = VALUES(direction), is_super_like = VALUES(is_super_like), created_at = NOW()`,
    [swiperId, swipedId, direction, isSuperLike ? 1 : 0]
  );

  if (direction !== 'like') return { matched: false };

  const theirSwipe = await query(
    `SELECT direction FROM swipes
     WHERE swiper_id = ? AND swiped_id = ? AND direction = 'like'`,
    [swipedId, swiperId]
  );

  let projectMatchRow = null;
  if (!theirSwipe[0]) {
    // No mutual profile swipe — check if the swiped investor already liked one of this entrepreneur's projects
    const projectLike = await query(
      `SELECT ps.project_id FROM project_swipes ps
       JOIN projects p ON p.id = ps.project_id
       WHERE ps.investor_id = ? AND p.user_id = ? AND p.is_active = 1 AND ps.direction = 'like'
       LIMIT 1`,
      [swipedId, swiperId]
    );
    if (!projectLike[0]) return { matched: false };
    projectMatchRow = { investorId: swipedId, projectId: projectLike[0].project_id, entrepreneurId: swiperId };
  }

  const [u1, u2] = swiperId < swipedId ? [swiperId, swipedId] : [swipedId, swiperId];

  await query(
    'INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)',
    [u1, u2]
  );

  if (projectMatchRow) {
    await query(
      'INSERT IGNORE INTO project_matches (investor_id, project_id, user_id) VALUES (?, ?, ?)',
      [projectMatchRow.investorId, projectMatchRow.projectId, projectMatchRow.entrepreneurId]
    );
  }

  const matchRows = await query(
    'SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?',
    [u1, u2]
  );
  const matchId = matchRows[0]?.id ?? null;

  let aiSummary = null;
  if (matchId) {
    // Push notifications — fire and forget
    query('SELECT name FROM users WHERE id = ?', [swiperId]).then(rows => {
      const name = rows[0]?.name || 'Someone';
      sendPushNotification(swipedId, '🎉 New Match!', `You matched with ${name}!`, { matchId });
      emitNotification(swipedId, 'match', matchId, { matchId, name });
    }).catch(() => {});
    if (isSuperLike) {
      query('SELECT name FROM users WHERE id = ?', [swiperId]).then(rows => {
        emitNotification(swipedId, 'super_like', swiperId, { fromUserId: swiperId, name: rows[0]?.name || 'Someone' });
      }).catch(() => {});
    }
    // Await AI summary with a 4-second timeout so it can be returned in the response
    try {
      aiSummary = await Promise.race([
        generateMatchSummary(matchId, swiperId, swipedId),
        new Promise(resolve => setTimeout(() => resolve(null), 4000)),
      ]);
    } catch { /* non-critical */ }
  }

  return { matched: true, matchId, aiSummary };
}

async function generateMatchSummary(matchId, userAId, userBId) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  try {
    const [rowsA, rowsB] = await Promise.all([
      query(`SELECT u.name, u.role, p.bio, p.skills, p.investment_domain, p.preferred_stage, p.max_investment,
                    proj.stage AS venture_stage, proj.funding_needed AS funding_needs
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN (
               SELECT pr.user_id, pr.stage, pr.funding_needed
               FROM projects pr
               INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
             ) proj ON proj.user_id = u.id
             WHERE u.id = ?`, [userAId]),
      query(`SELECT u.name, u.role, p.bio, p.skills, p.investment_domain, p.preferred_stage, p.max_investment,
                    proj.stage AS venture_stage, proj.funding_needed AS funding_needs
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id
             LEFT JOIN (
               SELECT pr.user_id, pr.stage, pr.funding_needed
               FROM projects pr
               INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
             ) proj ON proj.user_id = u.id
             WHERE u.id = ?`, [userBId]),
    ]);
    const a = rowsA[0]; const b = rowsB[0];
    if (!a || !b) return;

    const client = new Anthropic();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Two BizMatch users just mutually matched. Write a single encouraging sentence (max 25 words) explaining why they are a great fit. Be specific and concise.

User A: ${a.name}, ${a.role}. Bio: ${a.bio || 'N/A'}. Stage: ${a.venture_stage || a.preferred_stage || 'N/A'}. Domain: ${a.investment_domain || 'N/A'}.
User B: ${b.name}, ${b.role}. Bio: ${b.bio || 'N/A'}. Stage: ${b.venture_stage || b.preferred_stage || 'N/A'}. Domain: ${b.investment_domain || 'N/A'}.`,
      }],
    });
    const summary = response.content[0]?.text?.trim();
    if (summary) {
      await query('UPDATE matches SET ai_summary = ? WHERE id = ?', [summary, matchId]);
      return summary;
    }
  } catch {
    // non-critical — silently skip if AI call fails
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matches list
// ---------------------------------------------------------------------------

async function getMatches(userId) {
  return await query(
    `SELECT
       m.id AS matchId,
       m.created_at AS matchedAt,
       m.ai_summary AS aiSummary,
       u.id AS userId,
       u.name,
       u.photo_url AS photoUrl,
       u.role,
       p.bio,
       p.role_type AS roleType,
       p.investment_domain AS investmentDomain,
       proj.stage AS ventureStage
     FROM matches m
     JOIN users u ON u.id = CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN (
       SELECT pr.user_id, pr.stage
       FROM projects pr
       INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
     ) proj ON proj.user_id = u.id
     WHERE (m.user1_id = ? OR m.user2_id = ?)
       AND u.deleted_at IS NULL
     ORDER BY m.created_at DESC`,
    [userId, userId, userId]
  );
}

module.exports = { getFeed, recordSwipe, getMatches };

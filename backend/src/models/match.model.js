const { query } = require('../config/db');
const { getModel } = require('../config/gemini');
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

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function completenessBonus(profile) {
  let bonus = 0;
  if (profile.photo_url) bonus += 3;
  if ((profile.bio || '').length > 50) bonus += 4;
  if (asArray(profile.skills).length >= 2) bonus += 3;
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
    const entText = [...asArray(entrepreneurProfile.skills), entrepreneurProfile.bio || ''].join(' ');
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
    const hobbiesA = asArray(profileA.hobbies).map(h => h.toLowerCase());
    const hobbiesB = asArray(profileB.hobbies).map(h => h.toLowerCase());
    const sharedHobbies = hobbiesA.filter(h => hobbiesB.includes(h));
    score += sharedHobbies.length * 20;

    const skillsA = asArray(profileA.skills).map(s => s.toLowerCase());
    const skillsB = asArray(profileB.skills).map(s => s.toLowerCase());
    const complementary = skillsB.filter(s => !skillsA.includes(s));
    score += complementary.length * 10;
  }

  score += completenessBonus(profileB); // 0-10

  return score;
}

// ---------------------------------------------------------------------------
// AI scoring helpers
// ---------------------------------------------------------------------------

// candidates are always entrepreneurs (see roleFilter in getFeed) — investors
// score them as potential ventures, entrepreneurs score them as potential
// co-founders/partners.
function buildPersonPrompt(myRole, myProfile, candidate) {
  if (myRole === 'investor') {
    return `Rate investor-entrepreneur compatibility 0-100. Reply with ONLY a number.
Investor: domain=${myProfile.investment_domain || 'N/A'}, preferred stage=${myProfile.preferred_stage || 'N/A'}, max invest=$${myProfile.max_investment || 0}.
Entrepreneur: bio=${candidate.bio || 'N/A'}, skills=${asArray(candidate.skills).join(', ') || 'N/A'}, industry=${candidate.project_industry || 'N/A'}, stage=${candidate.venture_stage || 'N/A'}, needs=$${candidate.funding_needs || 0}.`;
  }
  return `Rate collaboration potential 0-100. Reply with ONLY a number.
Person A: bio=${myProfile.bio || 'N/A'}, skills=${asArray(myProfile.skills).join(', ') || 'N/A'}, hobbies=${asArray(myProfile.hobbies).join(', ') || 'N/A'}.
Person B: bio=${candidate.bio || 'N/A'}, skills=${asArray(candidate.skills).join(', ') || 'N/A'}, hobbies=${asArray(candidate.hobbies).join(', ') || 'N/A'}.`;
}

async function scoreOneCandidate(model, myRole, myProfile, candidate) {
  const result = await model.generateContent(buildPersonPrompt(myRole, myProfile, candidate));
  const raw = result.response.text().trim();
  const score = parseInt(raw, 10);
  if (isNaN(score)) return null;
  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// AI scoring — synchronous with timeout, max N candidates
// ---------------------------------------------------------------------------

async function ensureAiScores(userId, userRole, myProfile, candidates, maxNew = 10) {
  if (!process.env.GEMINI_API_KEY || !myProfile || candidates.length === 0) return;

  const candidateIds = candidates.map(c => c.user_id);
  const cached = await query(
    'SELECT candidate_id FROM ai_match_scores WHERE user_id = $1 AND candidate_id = ANY($2::uuid[])',
    [userId, candidateIds]
  );
  const cachedSet = new Set(cached.map(r => r.candidate_id));
  const uncached = candidates.filter(c => !cachedSet.has(c.user_id)).slice(0, maxNew);

  if (uncached.length === 0) return;

  const model = getModel();

  await Promise.allSettled(
    uncached.map(async (candidate) => {
      const clamped = await scoreOneCandidate(model, userRole, myProfile, candidate);
      if (clamped == null) return;
      await query(
        'INSERT INTO ai_match_scores (user_id, candidate_id, score) VALUES ($1, $2, $3) ON CONFLICT (user_id, candidate_id) DO NOTHING',
        [userId, candidate.user_id, clamped]
      );
    })
  );
}

// ---------------------------------------------------------------------------
// Eager pre-scoring — called fire-and-forget on profile create/update
// ---------------------------------------------------------------------------

async function preScoreUser(userId) {
  if (!process.env.GEMINI_API_KEY) return;

  const meRows = await query(
    `SELECT u.role, u.bio, u.skills, u.hobbies,
            investor.investment_domain, investor.preferred_stage, investor.max_investment
     FROM users u
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const me = meRows[0];
  if (!me) return;

  // Candidates are always entrepreneurs — investors evaluate them as ventures,
  // entrepreneurs evaluate them as potential co-founders/partners.
  const candidates = await query(
    `SELECT u.id AS user_id, u.bio, u.skills, u.hobbies, u.photo_url,
            proj.stage AS venture_stage, proj.funding_needed AS funding_needs, proj.industry AS project_industry
     FROM users u
     LEFT JOIN LATERAL (
       SELECT p.stage, p.funding_needed, p.industry
       FROM projects p WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) proj ON true
     WHERE u.role = 'entrepreneur' AND u.deleted_at IS NULL AND u.id != $1`,
    [userId]
  );
  if (!candidates.length) return;

  await query('DELETE FROM ai_match_scores WHERE user_id = $1', [userId]);

  const model = getModel();
  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    await Promise.allSettled(batch.map(async (candidate) => {
      const clamped = await scoreOneCandidate(model, me.role, me, candidate);
      if (clamped == null) return;
      await query(
        'INSERT INTO ai_match_scores (user_id, candidate_id, score) VALUES ($1, $2, $3) ON CONFLICT (user_id, candidate_id) DO NOTHING',
        [userId, candidate.user_id, clamped]
      );
    }));
  }
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

// Candidate pool is always entrepreneurs: investors browse ventures/founders,
// and entrepreneurs default to browsing other entrepreneurs (co-founder
// search) now that the investor-browsing toggle is gone.
async function getFeed(userId, userRole, limit = 20) {
  const allSwiped = await query('SELECT swiped_id, direction FROM swipes WHERE swiper_id = $1', [userId]);

  const passedIds = allSwiped.filter(r => r.direction === 'pass').map(r => r.swiped_id);
  const likedIds  = allSwiped.filter(r => r.direction === 'like').map(r => r.swiped_id);
  const excludeIds = [userId, ...likedIds];

  const candidates = await query(
    `SELECT u.id AS user_id, u.name, u.photo_url, u.is_premium, u.premium_expires_at,
            u.bio, u.skills, u.hobbies, u.role AS role_type,
            proj.stage AS venture_stage, proj.funding_needed AS funding_needs, proj.industry AS project_industry
     FROM users u
     LEFT JOIN LATERAL (
       SELECT p.stage, p.funding_needed, p.industry
       FROM projects p WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) proj ON true
     WHERE u.role = 'entrepreneur'
       AND u.deleted_at IS NULL
       AND u.id != ALL($1::uuid[])`,
    [excludeIds]
  );

  const myProfileRows = await query(
    `SELECT u.id, u.role, u.photo_url, u.bio, u.skills, u.hobbies,
            investor.investment_domain, investor.preferred_stage, investor.max_investment
     FROM users u
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );
  const myProfile = myProfileRows[0];

  // Ensure AI scores exist for up to 10 uncached candidates before scoring (5s timeout fallback)
  await Promise.race([
    ensureAiScores(userId, userRole, myProfile, candidates, 10),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]).catch(() => {});

  // Load cached AI scores for all candidates in one query
  const aiScoreMap = new Map();
  if (candidates.length > 0) {
    const cIds = candidates.map(c => c.user_id);
    const aiRows = await query(
      'SELECT candidate_id, score FROM ai_match_scores WHERE user_id = $1 AND candidate_id = ANY($2::uuid[])',
      [userId, cIds]
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
    skills: asArray(c.skills),
    hobbies: asArray(c.hobbies),
    ventureStage: c.venture_stage,
    fundingNeeds: c.funding_needs,
    score,
    aiScore: aiScoreMap.get(c.user_id) ?? null,
  });

  const calcScore = (c) => {
    const aiScore = aiScoreMap.has(c.user_id) ? aiScoreMap.get(c.user_id) : null;
    if (!myProfile) return 0;
    return userRole === 'investor'
      ? scoreInvestorEntrepreneur(myProfile, c, aiScore)
      : scoreEntrepreneurEntrepreneur(myProfile, c, aiScore);
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
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET
       direction = EXCLUDED.direction, is_super_like = EXCLUDED.is_super_like, created_at = now()`,
    [swiperId, swipedId, direction, isSuperLike]
  );

  if (direction !== 'like') return { matched: false };

  const theirSwipe = await query(
    `SELECT direction FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'like'`,
    [swipedId, swiperId]
  );
  if (!theirSwipe[0]) return { matched: false };

  const [u1, u2] = swiperId < swipedId ? [swiperId, swipedId] : [swipedId, swiperId];

  await query(
    'INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT (user1_id, user2_id) DO NOTHING',
    [u1, u2]
  );

  const matchRows = await query('SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2', [u1, u2]);
  const matchId = matchRows[0]?.id ?? null;

  if (matchId) {
    // Push notifications — fire and forget
    query('SELECT name FROM users WHERE id = $1', [swiperId]).then(rows => {
      const name = rows[0]?.name || 'Someone';
      sendPushNotification(swipedId, '🎉 New Match!', `You matched with ${name}!`, { matchId });
      emitNotification(swipedId, 'match', matchId, { matchId, name });
    }).catch(() => {});
    if (isSuperLike) {
      query('SELECT name FROM users WHERE id = $1', [swiperId]).then(rows => {
        emitNotification(swipedId, 'super_like', swiperId, { fromUserId: swiperId, name: rows[0]?.name || 'Someone' });
      }).catch(() => {});
    }
  }

  return { matched: true, matchId };
}

// ---------------------------------------------------------------------------
// Matches list
// ---------------------------------------------------------------------------

async function getMatches(userId) {
  return await query(
    `SELECT
       m.id AS "matchId",
       m.created_at AS "matchedAt",
       u.id AS "userId",
       u.name,
       u.photo_url AS "photoUrl",
       u.role,
       u.bio,
       u.role AS "roleType",
       investor.investment_domain AS "investmentDomain",
       proj.stage AS "ventureStage"
     FROM matches m
     JOIN users u ON u.id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT p.stage FROM projects p
       WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) proj ON true
     WHERE (m.user1_id = $1 OR m.user2_id = $1)
       AND u.deleted_at IS NULL
     ORDER BY m.created_at DESC`,
    [userId]
  );
}

module.exports = { getFeed, recordSwipe, getMatches, preScoreUser };

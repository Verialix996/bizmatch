const { query } = require('../config/db');
const Anthropic = require('@anthropic-ai/sdk');

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const STAGE_LADDER = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c'];

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

function scoreInvestorEntrepreneur(investorProfile, entrepreneurProfile) {
  let score = 0;

  score += stageScore(investorProfile.preferred_stage, entrepreneurProfile.venture_stage);
  score += budgetScore(investorProfile.max_investment, entrepreneurProfile.funding_needs);

  const domainText = investorProfile.investment_domain || '';
  const entText = [
    ...(safeParseArray(entrepreneurProfile.skills)),
    entrepreneurProfile.bio || '',
  ].join(' ');
  score += jaccardScore(domainText, entText, 30);

  score += completenessBonus(entrepreneurProfile);

  return score;
}

function scoreEntrepreneurEntrepreneur(profileA, profileB) {
  let score = 0;

  const hobbiesA = safeParseArray(profileA.hobbies).map(h => h.toLowerCase());
  const hobbiesB = safeParseArray(profileB.hobbies).map(h => h.toLowerCase());
  const sharedHobbies = hobbiesA.filter(h => hobbiesB.includes(h));
  score += sharedHobbies.length * 20;

  const skillsA = safeParseArray(profileA.skills).map(s => s.toLowerCase());
  const skillsB = safeParseArray(profileB.skills).map(s => s.toLowerCase());
  const complementary = skillsB.filter(s => !skillsA.includes(s));
  score += complementary.length * 10;

  score += completenessBonus(profileB);

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
// Feed
// ---------------------------------------------------------------------------

async function getFeed(userId, userRole, mode = 'investors', limit = 20) {
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
    `SELECT u.id, u.name, u.photo_url, p.*
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.role = ?
       AND u.deleted_at IS NULL
       AND u.id NOT IN (${placeholders})`,
    [roleFilter, ...excludeIds]
  );

  const myProfileRows = await query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
  const myProfile = myProfileRows[0];

  const toCard = (c, score) => ({
    userId: c.user_id,
    name: c.name,
    photoUrl: c.photo_url,
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
  });

  const calcScore = (c) => {
    if (userRole === 'investor' && c.role_type === 'entrepreneur') {
      return myProfile ? scoreInvestorEntrepreneur(myProfile, c) : 0;
    } else if (userRole === 'entrepreneur' && c.role_type === 'investor') {
      return myProfile ? scoreInvestorEntrepreneur(c, myProfile) : 0;
    } else if (userRole === 'entrepreneur' && c.role_type === 'entrepreneur') {
      return myProfile ? scoreEntrepreneurEntrepreneur(myProfile, c) : 0;
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

async function recordSwipe(swiperId, swipedId, direction) {
  await query(
    `INSERT INTO swipes (swiper_id, swiped_id, direction)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE direction = VALUES(direction)`,
    [swiperId, swipedId, direction]
  );

  if (direction !== 'like') return { matched: false };

  const theirSwipe = await query(
    `SELECT direction FROM swipes
     WHERE swiper_id = ? AND swiped_id = ? AND direction = 'like'`,
    [swipedId, swiperId]
  );

  if (!theirSwipe[0]) return { matched: false };

  const [u1, u2] = swiperId < swipedId ? [swiperId, swipedId] : [swipedId, swiperId];

  await query(
    'INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)',
    [u1, u2]
  );

  const matchRows = await query(
    'SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?',
    [u1, u2]
  );
  const matchId = matchRows[0]?.id ?? null;

  // Generate AI match summary in the background (non-blocking)
  if (matchId) generateMatchSummary(matchId, swiperId, swipedId).catch(() => {});

  return { matched: true, matchId };
}

async function generateMatchSummary(matchId, userAId, userBId) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  try {
    const [rowsA, rowsB] = await Promise.all([
      query(`SELECT u.name, u.role, p.bio, p.skills, p.venture_stage, p.funding_needs,
                    p.investment_domain, p.preferred_stage, p.max_investment
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, [userAId]),
      query(`SELECT u.name, u.role, p.bio, p.skills, p.venture_stage, p.funding_needs,
                    p.investment_domain, p.preferred_stage, p.max_investment
             FROM users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id = ?`, [userBId]),
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
    }
  } catch {
    // non-critical — silently skip if AI call fails
  }
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
       p.venture_stage AS ventureStage,
       p.investment_domain AS investmentDomain
     FROM matches m
     JOIN users u ON u.id = CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE (m.user1_id = ? OR m.user2_id = ?)
       AND u.deleted_at IS NULL
     ORDER BY m.created_at DESC`,
    [userId, userId, userId]
  );
}

module.exports = { getFeed, recordSwipe, getMatches };

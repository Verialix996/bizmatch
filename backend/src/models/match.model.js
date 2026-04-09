const { query } = require('../config/db');

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreInvestorEntrepreneur(investorProfile, entrepreneurProfile) {
  let score = 0;

  if (
    investorProfile.preferred_stage &&
    entrepreneurProfile.venture_stage &&
    investorProfile.preferred_stage === entrepreneurProfile.venture_stage
  ) {
    score += 40;
  }

  if (
    investorProfile.max_investment != null &&
    entrepreneurProfile.funding_needs != null &&
    investorProfile.max_investment >= entrepreneurProfile.funding_needs
  ) {
    score += 30;
  }

  if (investorProfile.investment_domain) {
    const domain = investorProfile.investment_domain.toLowerCase();
    const skills = safeParseArray(entrepreneurProfile.skills)
      .map(s => s.toLowerCase())
      .join(' ');
    const bio = (entrepreneurProfile.bio || '').toLowerCase();
    if (skills.includes(domain) || bio.includes(domain)) {
      score += 30;
    }
  }

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

  return { matched: true, matchId: matchRows[0]?.id ?? null };
}

// ---------------------------------------------------------------------------
// Matches list
// ---------------------------------------------------------------------------

async function getMatches(userId) {
  return await query(
    `SELECT
       m.id AS matchId,
       m.created_at AS matchedAt,
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

const { getDb } = require('../config/db');

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function scoreInvestorEntrepreneur(investorProfile, entrepreneurProfile) {
  let score = 0;

  // Stage alignment (+40)
  if (
    investorProfile.preferred_stage &&
    entrepreneurProfile.venture_stage &&
    investorProfile.preferred_stage === entrepreneurProfile.venture_stage
  ) {
    score += 40;
  }

  // Budget covers funding needs (+30)
  if (
    investorProfile.max_investment != null &&
    entrepreneurProfile.funding_needs != null &&
    investorProfile.max_investment >= entrepreneurProfile.funding_needs
  ) {
    score += 30;
  }

  // Domain overlaps entrepreneur skills/bio (+30)
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

  // Complementary skills: skills in B that are not in A (and vice versa)
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

/**
 * Returns candidate profiles for the current user, scored and sorted,
 * excluding users already swiped on.
 *
 * mode (only relevant for entrepreneurs):
 *   'investors' → see investors only
 *   'partners'  → see other entrepreneurs only
 */
function getFeed(userId, userRole, mode = 'investors', limit = 20) {
  const db = getDb();

  // IDs the user already swiped on
  const allSwiped = db
    .prepare('SELECT swiped_id, direction FROM swipes WHERE swiper_id = ?')
    .all(userId);

  const swipedIds = allSwiped.map(r => r.swiped_id);
  const passedIds = allSwiped.filter(r => r.direction === 'pass').map(r => r.swiped_id);

  // Exclude liked users (already decided) — passed users may recycle back
  const likedIds = allSwiped.filter(r => r.direction === 'like').map(r => r.swiped_id);
  const excludeIds = [userId, ...likedIds];
  const placeholders = excludeIds.map(() => '?').join(',');

  const targetRole = userRole === 'investor' || mode === 'partners' ? 'entrepreneur' : 'investor';
  const roleFilter = (mode === 'partners' || userRole === 'investor') ? 'entrepreneur' : 'investor';

  const candidates = db
    .prepare(
      `SELECT u.id, u.name, u.photo_url, p.*
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.role = ?
         AND u.deleted_at IS NULL
         AND u.id NOT IN (${placeholders})`
    )
    .all(roleFilter, ...excludeIds);

  // Fetch current user's profile for scoring
  const myProfile = db
    .prepare('SELECT * FROM profiles WHERE user_id = ?')
    .get(userId);

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

  // Fresh candidates (never swiped)
  const fresh = candidates.filter(c => !passedIds.includes(c.user_id));
  const passed = candidates.filter(c => passedIds.includes(c.user_id));

  const scoreAndSort = arr => arr.map(c => toCard(c, calcScore(c))).sort((a, b) => b.score - a.score);

  // Fresh profiles first, recycled passes appended at the end
  return [...scoreAndSort(fresh), ...scoreAndSort(passed)].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Swipe
// ---------------------------------------------------------------------------

/**
 * Records a swipe. If direction is 'like' and the other user already liked
 * back, creates a match and returns { matched: true }.
 */
function recordSwipe(swiperId, swipedId, direction) {
  const db = getDb();

  db.prepare(
    `INSERT INTO swipes (swiper_id, swiped_id, direction)
     VALUES (?, ?, ?)
     ON CONFLICT(swiper_id, swiped_id) DO UPDATE SET direction = excluded.direction`
  ).run(swiperId, swipedId, direction);

  if (direction !== 'like') return { matched: false };

  // Check if the other person already liked us
  const theirSwipe = db
    .prepare(
      `SELECT direction FROM swipes
       WHERE swiper_id = ? AND swiped_id = ? AND direction = 'like'`
    )
    .get(swipedId, swiperId);

  if (!theirSwipe) return { matched: false };

  // Mutual like — create match (smaller id first to satisfy UNIQUE constraint)
  const [u1, u2] = swiperId < swipedId ? [swiperId, swipedId] : [swipedId, swiperId];

  db.prepare(
    `INSERT OR IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)`
  ).run(u1, u2);

  return { matched: true };
}

// ---------------------------------------------------------------------------
// Matches list
// ---------------------------------------------------------------------------

function getMatches(userId) {
  const db = getDb();

  return db
    .prepare(
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
       ORDER BY m.created_at DESC`
    )
    .all(userId, userId, userId);
}

module.exports = { getFeed, recordSwipe, getMatches };

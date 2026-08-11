import { query, parseJsonColumn } from "../_shared/db.ts";

function canonicalPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

export interface MatchSummary {
  founderId: string;
  name: string | null;
  photoUrl: string | null;
  score: number;
  requiresAdminReview: boolean;
}

interface PairFounder {
  id: string;
  name: string | null;
  photoUrl: string | null;
  roleTitle: string | null;
}

export interface PairSummary {
  score: number;
  requiresAdminReview: boolean;
  explanation: { positives: string[]; risks: string[] };
  a: PairFounder;
  b: PairFounder;
}

export const MatchesModel = {
  // Cohort-wide ranked pair list — the actual "Suggested Matches" screen
  // (browse top pairs across everyone, not one founder's picks). Optionally
  // scoped to a single founder when reached via their profile's "View
  // Matches" so that entry point stays a filtered lens on this same list
  // rather than a separate one-sided flow.
  async topPairs(limit: number, founderId: string | null): Promise<PairSummary[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT fc.score, fc.requires_admin_review, fc.explanation,
              ua.id AS a_id, ua.name AS a_name, ua.photo_url AS a_photo_url, fpa.role_title AS a_role,
              ub.id AS b_id, ub.name AS b_name, ub.photo_url AS b_photo_url, fpb.role_title AS b_role
       FROM founder_compatibility fc
       JOIN users ua ON ua.id = fc.founder_a_id
       JOIN users ub ON ub.id = fc.founder_b_id
       LEFT JOIN founder_profiles fpa ON fpa.user_id = ua.id
       LEFT JOIN founder_profiles fpb ON fpb.user_id = ub.id
       WHERE $2::uuid IS NULL OR fc.founder_a_id = $2 OR fc.founder_b_id = $2
       ORDER BY fc.score DESC
       LIMIT $1`,
      [limit, founderId],
    );
    return rows.map((r) => ({
      score: Number(r.score),
      requiresAdminReview: !!r.requires_admin_review,
      explanation: parseJsonColumn(r.explanation, { positives: [], risks: [] } as PairSummary["explanation"]),
      a: { id: r.a_id as string, name: r.a_name as string | null, photoUrl: r.a_photo_url as string | null, roleTitle: r.a_role as string | null },
      b: { id: r.b_id as string, name: r.b_name as string | null, photoUrl: r.b_photo_url as string | null, roleTitle: r.b_role as string | null },
    }));
  },

  // MVP screen 8 — Suggested Matches list, sorted by score desc.
  async topMatches(founderId: string, limit: number): Promise<MatchSummary[]> {
    const rows = await query<Record<string, unknown>>(
      `SELECT
         CASE WHEN fc.founder_a_id = $1 THEN fc.founder_b_id ELSE fc.founder_a_id END AS other_id,
         fc.score, fc.requires_admin_review, u.name, u.photo_url
       FROM founder_compatibility fc
       JOIN users u ON u.id = (CASE WHEN fc.founder_a_id = $1 THEN fc.founder_b_id ELSE fc.founder_a_id END)
       WHERE fc.founder_a_id = $1 OR fc.founder_b_id = $1
       ORDER BY fc.score DESC
       LIMIT $2`,
      [founderId, limit],
    );
    return rows.map((r) => ({
      founderId: r.other_id as string,
      name: r.name as string | null,
      photoUrl: r.photo_url as string | null,
      score: Number(r.score),
      requiresAdminReview: !!r.requires_admin_review,
    }));
  },

  // MVP screen 8's Founder A vs Founder B detail / Compare view.
  async pairDetail(founderAId: string, founderBId: string): Promise<Record<string, unknown> | null> {
    const [aId, bId] = canonicalPair(founderAId, founderBId);
    const rows = await query<Record<string, unknown>>(
      `SELECT fc.score, fc.dimension_breakdown, fc.explanation, fc.deal_breaker_flags,
              fc.requires_admin_review, fc.computed_at,
              ua.id AS a_id, ua.name AS a_name, ua.photo_url AS a_photo_url,
              ub.id AS b_id, ub.name AS b_name, ub.photo_url AS b_photo_url
       FROM founder_compatibility fc
       JOIN users ua ON ua.id = fc.founder_a_id
       JOIN users ub ON ub.id = fc.founder_b_id
       WHERE fc.founder_a_id = $1 AND fc.founder_b_id = $2`,
      [aId, bId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      dimension_breakdown: parseJsonColumn(row.dimension_breakdown, {}),
      explanation: parseJsonColumn(row.explanation, { positives: [], risks: [] }),
      deal_breaker_flags: parseJsonColumn(row.deal_breaker_flags, []),
    };
  },
};

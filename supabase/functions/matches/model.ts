import { query } from "../_shared/db.ts";

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

export const MatchesModel = {
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
    return rows[0] ?? null;
  },
};

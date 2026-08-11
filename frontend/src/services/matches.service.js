import api from './api';

// Matching (MVP screen 8)
export const getTopMatches = (founderId, limit = 10) =>
  api.get('/matches/top', { params: { founderId, limit } });
// Cohort-wide ranked pairs — the actual Suggested Matches screen. founderId
// is optional; when passed (from a founder's profile) it scopes the ranking
// to pairs involving just that founder instead of a separate one-sided flow.
export const getTopPairs = (limit = 20, founderId) =>
  api.get('/matches/top-pairs', { params: { limit, founderId } });
export const compareFounders = (a, b) => api.get('/matches/compare', { params: { a, b } });
export const recomputeMatches = (founderId) => api.post('/matches/recompute', { founderId });

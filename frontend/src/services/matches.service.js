import api from './api';

// Matching (MVP screen 8)
export const getTopMatches = (founderId, limit = 10) =>
  api.get('/matches/top', { params: { founderId, limit } });
export const compareFounders = (a, b) => api.get('/matches/compare', { params: { a, b } });
export const recomputeMatches = (founderId) => api.post('/matches/recompute', { founderId });

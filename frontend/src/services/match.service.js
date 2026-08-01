import api from './api';

export const getFeed          = ()                           => api.get('/match/feed');
export const swipe            = (targetUserId, direction, superLike = false) => api.post('/match/swipe', { targetUserId, direction, superLike });
export const getMatches       = ()                           => api.get('/match/matches');
export const whoLikedMe       = ()                           => api.get('/users/me/who-liked-me');

export const getConversations = ()                          => api.get('/messages');
export const getMessages      = (matchId, after = null)     => api.get(`/messages/${matchId}${after != null ? `?after=${after}` : ''}`);
export const sendMessage      = (matchId, body)             => api.post(`/messages/${matchId}`, { body });
export const markRead         = (matchId)                   => api.post(`/messages/${matchId}/read`);
export const shareSubmission  = (matchId, challengeId, teamId) => api.post(`/messages/${matchId}/share-submission`, { challengeId, teamId });

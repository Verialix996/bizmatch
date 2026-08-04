import api from './api';

export const getFeed          = (mode = 'investors', projectId = null) => api.get(`/match/feed?mode=${mode}${projectId ? `&projectId=${projectId}` : ''}`);
export const swipe            = (targetUserId, direction, superLike = false) => api.post('/match/swipe', { targetUserId, direction, superLike });
export const getMatches       = ()                           => api.get('/match/matches');
export const whoLikedMe       = ()                           => api.get('/users/me/who-liked-me');

export const getConversations = ()                          => api.get('/messages');
export const getMessages      = (matchId, after = null)     => api.get(`/messages/${matchId}${after != null ? `?after=${after}` : ''}`);
export const sendMessage      = (matchId, body)             => api.post(`/messages/${matchId}`, { body });
export const markRead         = (matchId)                   => api.post(`/messages/${matchId}/read`);

export const sendPartnerInvite  = (matchId, projectId, roleData = {}) => api.post(`/messages/${matchId}/invite`, { projectId, ...roleData });
export const respondToInvite    = (matchId, invitationId, accepted) => api.post(`/messages/${matchId}/invite/${invitationId}/respond`, { accepted });
export const shareProject       = (matchId, projectId)              => api.post(`/messages/${matchId}/share-project`, { projectId });

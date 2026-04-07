import api from './api';

export const getFeed         = (mode = 'investors')         => api.get(`/match/feed?mode=${mode}`);
export const swipe           = (targetUserId, direction)    => api.post('/match/swipe', { targetUserId, direction });
export const getMatches      = ()                           => api.get('/match/matches');

export const getConversations = ()                          => api.get('/messages');
export const getMessages      = (matchId)                   => api.get(`/messages/${matchId}`);
export const sendMessage      = (matchId, body)             => api.post(`/messages/${matchId}`, { body });

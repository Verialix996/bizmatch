import api from './api';

// Peer Feedback (MVP screen 5's peer-feedback capture) — fans out into evidence
export const submitPeerFeedback = (payload) => api.post('/peer-feedback', payload);
export const listPeerFeedback = (founderId) => api.get('/peer-feedback', { params: { founderId } });

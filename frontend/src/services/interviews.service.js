import api from './api';

export const createProspectFounder = (payload) => api.post('/founders/prospect', payload);

export const listFounderInterviews = (founderId) => api.get('/founder-interviews', { params: { founderId } });
export const listAllInterviews = () => api.get('/founder-interviews');
export const getFounderInterview = (id) => api.get(`/founder-interviews/${id}`);
export const createFounderInterview = (founderId, meta) => api.post('/founder-interviews', { founderId, meta });
export const saveFounderInterview = (id, payload) => api.put(`/founder-interviews/${id}`, payload);
export const completeFounderInterview = (id) => api.post(`/founder-interviews/${id}/complete`);
export const deleteFounderInterview = (id) => api.delete(`/founder-interviews/${id}`);

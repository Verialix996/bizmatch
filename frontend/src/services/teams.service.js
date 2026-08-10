import api from './api';

// Teams (MVP screens 9-10)
export const listTeams = (programId) => api.get('/teams', { params: { programId } });
export const getTeam = (teamId) => api.get(`/teams/${teamId}`);
export const previewTeam = (founderIds) => api.get('/teams/preview', { params: { founderIds: founderIds.join(',') } });
export const createTeam = (payload) => api.post('/teams', payload);
export const setTeamMembers = (teamId, founderIds) => api.put(`/teams/${teamId}/members`, { founderIds });
export const recomputeTeam = (teamId) => api.post(`/teams/${teamId}/recompute`);
export const deleteTeam = (teamId) => api.delete(`/teams/${teamId}`);

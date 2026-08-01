import api from './api';

export const createTeam       = (data)              => api.post('/challenges/teams', data);
export const getMyTeams       = ()                  => api.get('/challenges/teams/mine');
export const getMyPendingInvites = ()               => api.get('/challenges/teams/invites/mine');
export const getTeam          = (id)                => api.get(`/challenges/teams/${id}`);
export const updateTeam       = (id, data)          => api.put(`/challenges/teams/${id}`, data);
export const inviteToTeam     = (teamId, userId)    => api.post(`/challenges/teams/${teamId}/invite`, { userId });
export const respondToInvite  = (teamId, accept)    => api.post(`/challenges/teams/${teamId}/respond`, { accept });
export const leaveTeam        = (teamId)            => api.post(`/challenges/teams/${teamId}/leave`);

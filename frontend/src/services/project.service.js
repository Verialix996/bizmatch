import api from './api';

export const getProjectFeed    = ()                     => api.get('/projects/feed');
export const swipeProject      = (projectId, direction) => api.post('/projects/swipe', { projectId, direction });
export const getProjectMatches = ()                     => api.get('/projects/matches');
export const getMyProjects     = ()                     => api.get('/projects/mine');
export const createProject     = (data)                 => api.post('/projects', data);
export const updateProject     = (id, data)             => api.put(`/projects/${id}`, data);
export const deleteProject     = (id)                   => api.delete(`/projects/${id}`);

export const uploadDeck = (projectId, fileUri, fileName) => {
  const formData = new FormData();
  formData.append('deck', { uri: fileUri, name: fileName, type: 'application/pdf' });
  return api.post(`/projects/${projectId}/upload-deck`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadVideo = (projectId, fileUri, fileName) => {
  const formData = new FormData();
  formData.append('video', { uri: fileUri, name: fileName, type: 'video/mp4' });
  return api.post(`/projects/${projectId}/upload-video`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getPartners    = (projectId)              => api.get(`/projects/${projectId}/partners`);
export const addPartner     = (projectId, partnerUserId) => api.post(`/projects/${projectId}/partners`, { partnerUserId });
export const removePartner  = (projectId, partnerUserId) => api.delete(`/projects/${projectId}/partners/${partnerUserId}`);

export const setVisibility      = (projectId, visibility)          => api.patch(`/projects/${projectId}/visibility`, { visibility });
export const getNdaStatus       = (projectId)                      => api.get(`/projects/${projectId}/nda-status`);
export const signNda            = (projectId)                      => api.post(`/projects/${projectId}/sign-nda`);
export const invitePartner      = (projectId, matchId, inviteeId)  => api.post(`/projects/${projectId}/invite-partner`, { matchId, inviteeId });
export const respondInvitation  = (invitationId, accept)           => api.post(`/projects/invitations/${invitationId}/respond`, { accept });

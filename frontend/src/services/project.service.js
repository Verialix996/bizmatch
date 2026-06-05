import api from './api';
import useAuthStore from '../store/authStore';
import { API_BASE_URL } from '../config/constants';

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

export const uploadVideo = (projectId, fileUri) =>
  new Promise((resolve, reject) => {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append('video', { uri: fileUri, type: 'video/mp4', name: 'video.mp4' });
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/projects/${projectId}/upload-video`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      try {
        const data = JSON.parse(xhr.responseText);
        xhr.status < 300 ? resolve(data) : reject(new Error(data.error || `HTTP ${xhr.status}`));
      } catch { reject(new Error(`HTTP ${xhr.status}`)); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(formData);
  });

export const getPartners         = (projectId)                     => api.get(`/projects/${projectId}/partners`);
export const addPartner          = (projectId, partnerUserId, role) => api.post(`/projects/${projectId}/partners`, { partnerUserId, role });
export const removePartner       = (projectId, partnerUserId)       => api.delete(`/projects/${projectId}/partners/${partnerUserId}`);
export const updatePartnerRole   = (projectId, partnerUserId, role) => api.put(`/projects/${projectId}/partners/${partnerUserId}/role`, { role });
export const proposeRoleChange   = (projectId, partnerUserId, newRole) => api.post(`/projects/${projectId}/partners/${partnerUserId}/role-request`, { newRole });
export const respondToRoleChange = (projectId, requestId, accepted)    => api.post(`/projects/${projectId}/role-request/${requestId}/respond`, { accepted });
export const getJoinedProjects = ()                         => api.get('/projects/joined');
export const getProjectsByOwner = (userId)                  => api.get(`/projects/owner/${userId}`);
export const reviewDeck         = (projectId)               => api.post(`/projects/${projectId}/deck-review`);

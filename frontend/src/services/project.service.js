import api from './api';
import useAuthStore from '../store/authStore';
import { API_BASE_URL } from '../config/constants';

export const getMyProjects     = ()                     => api.get('/projects/mine');
export const createProject     = (data)                 => api.post('/projects', data);
export const updateProject     = (id, data)             => api.put(`/projects/${id}`, data);
export const deleteProject     = (id)                   => api.delete(`/projects/${id}`);

export const uploadDeck = (projectId, fileUri, fileName, fileObj = null) => {
  const formData = new FormData();
  if (fileObj) {
    formData.append('deck', fileObj, fileName || 'deck.pdf');
  } else {
    formData.append('deck', { uri: fileUri, name: fileName, type: 'application/pdf' });
  }
  return api.post(`/projects/${projectId}/upload-deck`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadVideo = (projectId, fileUri, onProgress, fileObj = null) =>
  new Promise((resolve, reject) => {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    if (fileObj) {
      formData.append('video', fileObj, 'video.mp4');
    } else {
      formData.append('video', { uri: fileUri, type: 'video/mp4', name: 'video.mp4' });
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/projects/${projectId}/upload-video`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
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

export const reviewDeck = (projectId) => api.post(`/projects/${projectId}/deck-review`);

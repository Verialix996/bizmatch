import api from './api';
import useAuthStore from '../store/authStore';
import { API_BASE_URL } from '../config/constants';

export const getOpenChallenges     = ()         => api.get('/challenges/challenges/open');
export const getChallenge          = (id)       => api.get(`/challenges/challenges/${id}`);
export const getMyChallenges       = ()         => api.get('/challenges/challenges/mine');
export const createChallenge       = (data)     => api.post('/challenges/challenges', data);
export const draftChallengeDescription = (prompt) => api.post('/challenges/challenges/draft-description', { prompt });

export const signupTeam            = (challengeId, teamId) => api.post(`/challenges/challenges/${challengeId}/signup`, { teamId });
export const getSignupsMine        = ()         => api.get('/challenges/signups/mine');
export const getChallengeSignups   = (challengeId) => api.get(`/challenges/challenges/${challengeId}/signups`);
export const getSubmissionAiReview = (signupId) => api.post(`/challenges/signups/${signupId}/ai-review`);
export const submitEntry           = (signupId, description) => api.post(`/challenges/signups/${signupId}/submit`, { description });

export const selectWinner  = (challengeId, teamId) => api.post(`/challenges/challenges/${challengeId}/select-winner`, { teamId });
export const createOffer   = (challengeId, teamId, offer) => api.post(`/challenges/challenges/${challengeId}/offers`, { teamId, ...offer });
export const counterOffer  = (challengeId, teamId, offer) => api.post(`/challenges/challenges/${challengeId}/offers/counter`, { teamId, ...offer });
export const acceptOffer   = (challengeId, teamId) => api.post(`/challenges/challenges/${challengeId}/offers/accept`, { teamId });
export const declineOffer  = (challengeId, teamId) => api.post(`/challenges/challenges/${challengeId}/offers/decline`, { teamId });
export const getOfferHistory = (challengeId, teamId) => api.get(`/challenges/challenges/${challengeId}/offers?teamId=${teamId}`);

export const uploadSubmissionDeck = (signupId, fileUri, fileName, fileObj = null) => {
  const formData = new FormData();
  if (fileObj) {
    formData.append('deck', fileObj, fileName || 'deck.pdf');
  } else {
    formData.append('deck', { uri: fileUri, name: fileName, type: 'application/pdf' });
  }
  return api.post(`/challenges/signups/${signupId}/upload-deck`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const uploadSubmissionVideo = (signupId, fileUri, onProgress, fileObj = null) =>
  new Promise((resolve, reject) => {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    if (fileObj) {
      formData.append('video', fileObj, 'video.mp4');
    } else {
      formData.append('video', { uri: fileUri, type: 'video/mp4', name: 'video.mp4' });
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/challenges/signups/${signupId}/upload-video`);
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

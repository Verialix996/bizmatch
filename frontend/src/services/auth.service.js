import api from './api';

export const register = (data) => api.post('/auth/register', data);
export const login    = (data) => api.post('/auth/login', data);

export const verifyEmail = (email, code) =>
  api.post('/auth/verify-email', { email, code });

export const resendOtp = (email) =>
  api.post('/auth/resend-otp', { email });

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email });

export const resetPassword = (token, newPassword) =>
  api.post('/auth/reset-password', { token, newPassword });

export const googleSignIn = (accessToken) =>
  api.post('/auth/google/mobile', { accessToken });

export const activatePremium = () => api.post('/users/me/premium/activate');
export const cancelPremium   = () => api.delete('/users/me/premium');

export const uploadPhoto = (uri, fileName) => {
  const form = new FormData();
  form.append('photo', { uri, name: fileName, type: 'image/jpeg' });
  return api.post('/users/me/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

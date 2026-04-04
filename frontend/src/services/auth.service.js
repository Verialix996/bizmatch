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

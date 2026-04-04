import axios from 'axios';
import useAuthStore from '../store/authStore';
import Constants from 'expo-constants';

// Automatically uses the same IP your Expo dev server is running on
const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
const API_URL = `http://${host}:3000/api`;

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

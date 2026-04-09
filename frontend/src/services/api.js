import axios from 'axios';
import useAuthStore from '../store/authStore';
import Constants from 'expo-constants';

const API_URL = 'https://zooming-surprise-production.up.railway.app/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

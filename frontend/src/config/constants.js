export const GOOGLE_CLIENT_ID = '68460980842-gcnar8gb01hmuhmmten9vk03cniim557.apps.googleusercontent.com';

const _backend =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://zooming-surprise-production.up.railway.app';

export const API_BASE_URL     = `${_backend}/api`;
export const BACKEND_BASE_URL = _backend;

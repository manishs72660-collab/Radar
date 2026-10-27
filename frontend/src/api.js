import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : '');

if (!baseURL) {
  throw new Error('VITE_API_URL must be set for production builds.');
}

const api = axios.create({
  baseURL,
  withCredentials: true, // httpOnly cookie bhejne ke liye zaroori
});

function isJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3 && token.split('.').every(Boolean);
}

export function storeAccessToken(token) {
  if (!isJwt(token)) {
    sessionStorage.removeItem('accessToken');
    throw new Error('Login response did not include a valid token. Please redeploy the backend and try again.');
  }
  sessionStorage.setItem('accessToken', token);
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (isJwt(token)) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (token) {
    sessionStorage.removeItem('accessToken');
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (err) => {
    if (err.response?.status === 401) sessionStorage.removeItem('accessToken');
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

export default api;

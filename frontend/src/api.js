import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true, // httpOnly cookie bhejne ke liye zaroori
});

export function errorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

export default api;

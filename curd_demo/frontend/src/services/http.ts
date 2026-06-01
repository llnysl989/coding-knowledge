import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const http = axios.create({
  baseURL,
  timeout: 10000,
});

http.interceptors.response.use(
  (resp) => resp,
  (err) => {
    const message =
      err?.response?.data?.message || err?.message || 'request failed';
    return Promise.reject(new Error(message));
  }
);

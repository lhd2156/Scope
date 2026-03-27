import axios from 'axios';

const api = axios.create({ baseURL: '/', withCredentials: true, timeout: 10000 });
let accessToken = '';
export const setAccessToken = (token: string): void => {
  accessToken = token;
};
api.interceptors.request.use((config) => {
  config.headers.Authorization = accessToken ? `Bearer ${accessToken}` : '';
  return config;
});
export default api;

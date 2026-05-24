import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Set user ID header for every request
export function setUserId(userId) {
  api.defaults.headers.common['x-user-id'] = userId;
}

// ─── API Key ─────────────────────────────────────────────────
export const apiKeyStatus = () => api.get('/api-key/status').then(r => r.data);
export const setApiKey = (apiKey) => api.post('/api-key', { apiKey }).then(r => r.data);
export const deleteApiKey = () => api.delete('/api-key').then(r => r.data);

// ─── Jobs ─────────────────────────────────────────────────────
export const createJob = (scenario) => api.post('/jobs', { scenario }).then(r => r.data);
export const listJobs = () => api.get('/jobs').then(r => r.data);
export const getJob = (id) => api.get(`/jobs/${id}`).then(r => r.data);

// ─── Long Poll ────────────────────────────────────────────────
export const pollJob = (id, since = 0) =>
  api.get(`/jobs/${id}/poll`, { params: { since }, timeout: 30000 }).then(r => r.data);

// ─── File URLs ─────────────────────────────────────────────────
export const fileDownloadUrl = (jobId, filename) => `/api/jobs/${jobId}/files/${filename}`;
export const fileViewUrl = (jobId, filename) => `/api/jobs/${jobId}/view/${filename}`;

export default api;

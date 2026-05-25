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

// ─── File download via axios (sends auth headers) ─────────────
export async function downloadFile(jobId, filename) {
  const response = await api.get(`/jobs/${jobId}/files/${filename}`, {
    responseType: 'blob',
  });

  // Determine filename from Content-Disposition or use provided name
  const disposition = response.headers['content-disposition'];
  let dlName = filename;
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match) dlName = match[1];
  }

  // Create a temporary link and trigger download
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', dlName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ─── File view via axios (sends auth headers, opens in new tab) ──
export async function viewFile(jobId, filename) {
  const response = await api.get(`/jobs/${jobId}/view/${filename}`, {
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
  window.open(url, '_blank');
  // Revoke after a short delay to allow the tab to load
  setTimeout(() => window.URL.revokeObjectURL(url), 10000);
}

export default api;
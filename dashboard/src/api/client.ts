import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach JWT to every request automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem('n8n-auth-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const github = {
  status: () => api.get('/github/status').then(r => r.data),
  commits: () => api.get('/github/commits').then(r => r.data),
  commit: (payload: { filePath: string; content: string; message?: string; projectName?: string }) =>
    api.post('/github/commit', payload).then(r => r.data),
  openVSCode: (filePath: string) =>
    api.post('/github/open-vscode', { filePath }).then(r => r.data),
  config: (payload: { token?: string; owner?: string; repo?: string; branch?: string }) =>
    api.post('/github/config', payload).then(r => r.data),
};

export const wordpress = {
  convert: (payload: { projectName: string; pages: unknown[]; globalContext?: unknown }) =>
    api.post('/wordpress/convert', payload, { responseType: 'blob' }).then(r => r.data),
};

export const deploy = {
  ftp: (payload: { zipBase64: string; themeName: string }) =>
    api.post('/deploy/ftp', payload).then(r => r.data),
  githubActions: (payload: { workflowId?: string; inputs?: Record<string, string> }) =>
    api.post('/deploy/github-actions', payload).then(r => r.data),
};

export const webhook = {
  builds: () => api.get('/webhook/builds').then(r => r.data),
};

export const state = {
  get: () => api.get('/state').then(r => r.data),
  reset: () => api.post('/state/reset').then(r => r.data),
};

export const n8n = {
  status: () => api.get('/n8n/status').then(r => r.data),
  chat: (message: string, sessionId: string, wakeup = false) =>
    api.post('/n8n/chat', { message, sessionId, wakeup }).then(r => r.data),
};

export default api;

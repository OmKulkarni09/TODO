// In production, set VITE_API_BASE to the absolute backend URL
// (e.g. https://venom-todo-api.onrender.com). In dev, the Vite proxy in
// vite.config.js maps /api/* → http://localhost:8000.
const BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : '/api'

const TOKEN_KEY = 'venom-auth-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

// Allow other parts of the app to react to a 401 (e.g., AuthProvider logs
// the user out and shows the login screen). We use a tiny EventTarget so
// there's no Context coupling in api.js itself.
const events = new EventTarget()
export const onUnauthorized = (cb) => {
  const handler = () => cb()
  events.addEventListener('unauthorized', handler)
  return () => events.removeEventListener('unauthorized', handler)
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const t = getToken()
    if (t) headers.Authorization = `Bearer ${t}`
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401 && auth) {
    setToken(null)
    events.dispatchEvent(new Event('unauthorized'))
  }
  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json()).detail || ''
    } catch {
      try { detail = await res.text() } catch { /* ignore */ }
    }
    throw new Error(detail || `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // ---- Auth ----
  register: (email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),
  me: () => request('/auth/me'),

  // ---- Tasks ----
  listTasks: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(
        ([, v]) => v !== undefined && v !== null && v !== ''
      )
    ).toString()
    return request(`/tasks${q ? `?${q}` : ''}`)
  },
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  deleteTaskSeries: (id) =>
    request(`/tasks/${id}/series`, { method: 'DELETE' }),

  // ---- Subtasks ----
  addSubtask: (taskId, data) =>
    request(`/tasks/${taskId}/subtasks`, { method: 'POST', body: data }),
  updateSubtask: (id, data) =>
    request(`/subtasks/${id}`, { method: 'PATCH', body: data }),
  deleteSubtask: (id) => request(`/subtasks/${id}`, { method: 'DELETE' }),

  // ---- Categories ----
  listCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: data }),
  updateCategory: (id, data) =>
    request(`/categories/${id}`, { method: 'PATCH', body: data }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // ---- Stats ----
  stats: () => request('/stats'),
}

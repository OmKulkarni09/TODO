// In production, set VITE_API_BASE to the absolute backend URL
// (e.g. https://venom-todo-api.onrender.com). In dev, the Vite proxy in
// vite.config.js maps /api/* → http://localhost:8000.
const BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : '/api'

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText} ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Tasks
  listTasks: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    return request(`/tasks${q ? `?${q}` : ''}`)
  },
  getTask: (id) => request(`/tasks/${id}`),
  createTask: (data) => request('/tasks', { method: 'POST', body: data }),
  updateTask: (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  deleteTaskSeries: (id) =>
    request(`/tasks/${id}/series`, { method: 'DELETE' }),

  // Subtasks
  addSubtask: (taskId, data) =>
    request(`/tasks/${taskId}/subtasks`, { method: 'POST', body: data }),
  updateSubtask: (id, data) =>
    request(`/subtasks/${id}`, { method: 'PATCH', body: data }),
  deleteSubtask: (id) => request(`/subtasks/${id}`, { method: 'DELETE' }),

  // Categories
  listCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: data }),
  updateCategory: (id, data) =>
    request(`/categories/${id}`, { method: 'PATCH', body: data }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Stats
  stats: () => request('/stats'),
}

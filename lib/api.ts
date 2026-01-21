// API utility functions for making HTTP requests

const API_BASE_URL = '/api'

export interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}

class ApiError extends Error {
  status: number
  
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new ApiError(errorData.error || 'Request failed', response.status)
  }
  
  return response.json()
}

// Generic CRUD operations
export const api = {
  // GET request
  get: <T>(endpoint: string): Promise<T> => {
    return makeRequest<T>(endpoint, { method: 'GET' })
  },
  
  // POST request
  post: <T>(endpoint: string, data: any): Promise<T> => {
    return makeRequest<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  
  // PUT request
  put: <T>(endpoint: string, data: any): Promise<T> => {
    return makeRequest<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  
  // DELETE request
  delete: <T>(endpoint: string, id?: string): Promise<T> => {
    const url = id ? `${endpoint}?id=${encodeURIComponent(id)}` : endpoint
    return makeRequest<T>(url, {
      method: 'DELETE',
    })
  },
}

// Specific API endpoints
export const routinesApi = {
  getActions: () => api.get('/routines'),
  createAction: (action: any) => api.post('/routines', action),
  updateAction: (action: any) => api.put('/routines', action),
  deleteAction: (id: string) => api.delete('/routines', id),
  
  getLogs: () => api.get('/routines/logs'),
  logAction: (log: any) => api.post('/routines/logs', log),
}

export const nightRoutinesApi = {
  getActions: () => api.get('/night-routines'),
  createAction: (action: any) => api.post('/night-routines', action),
  updateAction: (action: any) => api.put('/night-routines', action),
  deleteAction: (id: string) => api.delete('/night-routines', id),
  
  getLogs: () => api.get('/night-routines/logs'),
  logAction: (log: any) => api.post('/night-routines/logs', log),
}

export const missionsApi = {
  getAll: () => api.get('/missions'),
  create: (mission: any) => api.post('/missions', mission),
  update: (mission: any) => api.put('/missions', mission),
  delete: (id: string) => api.delete('/missions', id),
}

export const tasksApi = {
  getAll: () => api.get('/tasks'),
  create: (task: any) => api.post('/tasks', task),
  update: (task: any) => api.put('/tasks', task),
  delete: (id: string) => api.delete('/tasks', id),
}

export const projectsApi = {
  getAll: () => api.get('/projects'),
  create: (project: any) => api.post('/projects', project),
  update: (project: any) => api.put('/projects', project),
  delete: (id: string) => api.delete('/projects', id),
}

export const sleepApi = {
  getAll: () => api.get('/sleep'),
  createOrUpdate: (sleepLog: any) => api.post('/sleep', sleepLog),
  delete: (id: string) => api.delete('/sleep', id),
}

export const workoutsApi = {
  getAll: () => api.get('/workouts'),
  create: (workout: any) => api.post('/workouts', workout),
  update: (workout: any) => api.put('/workouts', workout),
  delete: (id: string) => api.delete('/workouts', id),
}

export const workoutProgramsApi = {
  getAll: () => api.get('/workout-programs'),
  create: (program: any) => api.post('/workout-programs', program),
  update: (program: any) => api.put('/workout-programs', program),
  delete: (id: string) => api.delete('/workout-programs', id),
}

export const dashboardApi = {
  getWidgets: () => api.get('/dashboard/widgets'),
  updateWidgets: (widgets: any[]) => api.put('/dashboard/widgets', { widgets }),
}

export const calendarApi = {
  getAll: () => api.get('/calendar/events'),
  create: (event: any) => api.post('/calendar/events', event),
  update: (event: any) => api.put('/calendar/events', event),
  delete: (id: string) => api.delete('/calendar/events', id),
}

export const fitnessProfileApi = {
  get: () => api.get('/fitness-profile'),
  createOrUpdate: (profile: any) => api.post('/fitness-profile', profile),
  update: (profile: any) => api.put('/fitness-profile', profile),
  delete: () => api.delete('/fitness-profile'),
}

export const notesApi = {
  getAll: () => api.get('/notes'),
  create: (note: any) => api.post('/notes', note),
  update: (note: any) => api.put('/notes', note),
  delete: (id: string) => api.delete('/notes', id),
}
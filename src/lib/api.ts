import axios, { type AxiosError } from 'axios'
import { AUTH_TOKEN_KEY, clearStoredToken } from './authToken'

function baseURL(): string {
  const raw = import.meta.env.VITE_API_URL
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/+$/, '')
  }
  return '/api'
}

export const api = axios.create({
  baseURL: baseURL(),
  timeout: 25_000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err: AxiosError<{ message?: string; errors?: unknown }>) => {
    const status = err.response?.status
    const body = err.response?.data
    if (status === 401) {
      clearStoredToken()
    }
    const message =
      (typeof body?.message === 'string' && body.message) ||
      err.message ||
      'Request failed'
    return Promise.reject({ status, message, errors: body?.errors })
  },
)

export type ApiError = { status?: number; message: string; errors?: unknown }

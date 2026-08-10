import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { RefreshResponse } from '@/types'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/lib/tokenStorage'

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL })

// Separate, interceptor-free client used only for the refresh call itself,
// so a 401 from /auth/refresh can never recursively re-trigger the response
// interceptor below.
const refreshClient = axios.create({ baseURL })

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

function evictAndRedirect() {
  if (typeof window === 'undefined') return
  clearTokens()
  localStorage.removeItem('lendly_user')
  window.location.href = '/login'
}

let refreshPromise: Promise<string> | null = null

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const refreshToken = getRefreshToken()
    refreshPromise = refreshClient
      .post<RefreshResponse>('/auth/refresh', { refresh_token: refreshToken })
      .then((r) => {
        setTokens(r.data.access_token, r.data.refresh_token)
        return r.data.access_token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const isUnauthorized = error.response?.status === 401
    const isRefreshCall = config?.url?.includes('/auth/refresh')

    if (!isUnauthorized || typeof window === 'undefined' || !config) {
      return Promise.reject(error)
    }

    if (isRefreshCall || config._retry || !getRefreshToken()) {
      evictAndRedirect()
      return Promise.reject(error)
    }

    try {
      config._retry = true
      const newAccessToken = await refreshAccessToken()
      config.headers.Authorization = `Bearer ${newAccessToken}`
      return api(config)
    } catch (refreshError) {
      evictAndRedirect()
      return Promise.reject(refreshError)
    }
  },
)

export default api

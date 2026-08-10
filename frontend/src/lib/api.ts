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
    // /auth/login and /auth/login/complete-2fa return 401 for plain "wrong
    // credentials"/"wrong code" — an expected form error, not a dead
    // session. Letting the eviction logic below run here would nuke
    // whatever tokens exist and hard-redirect mid-submit, wiping the error
    // the form just set before the user ever sees it.
    const isPreAuthCall = config?.url?.includes('/auth/login')

    if (!isUnauthorized || typeof window === 'undefined' || !config || isPreAuthCall) {
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

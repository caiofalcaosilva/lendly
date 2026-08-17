import api from '@/lib/api'
import { GoogleConnectStatus, LoginResponse, TokenResponse, User } from '@/types'

export interface RegisterData {
  name: string
  email: string
  password: string
  phone?: string
  zip_code?: string
  street?: string
  number?: string
  complement?: string
  neighborhood?: string
  city?: string
  state?: string
  account_type?: 'individual' | 'business'
  company_name?: string
  trade_name?: string
  cnpj?: string
  business_category?: string
  accepted_terms: boolean
}

export const authService = {
  register: (data: RegisterData) =>
    api.post<TokenResponse>('/auth/register', data).then((r) => r.data),

  login: (email: string, password: string, deviceToken?: string | null) =>
    api
      .post<LoginResponse>('/auth/login', { email, password, device_token: deviceToken ?? undefined })
      .then((r) => r.data),

  completeTwoFactor: (tempToken: string, code: string, trustDevice = true) =>
    api
      .post<TokenResponse>('/auth/login/complete-2fa', {
        temp_token: tempToken,
        code,
        trust_device: trustDevice,
      })
      .then((r) => r.data),

  me: () => api.get<User>('/auth/me').then((r) => r.data),

  verifyEmail: (token: string) =>
    api.get<User>(`/auth/verify-email?token=${encodeURIComponent(token)}`).then((r) => r.data),

  resendVerification: () => api.post('/auth/resend-verification').then((r) => r.data),

  forgotPassword: (email: string) =>
    api.post<{ detail: string }>('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, newPassword: string) =>
    api
      .post<{ detail: string }>('/auth/reset-password', { token, new_password: newPassword })
      .then((r) => r.data),

  setupTotp: () =>
    api.post<{ secret: string; uri: string }>('/auth/2fa/setup').then((r) => r.data),

  enableTotp: (code: string) =>
    api.post<User>('/auth/2fa/enable', { code }).then((r) => r.data),

  disableTotp: (code: string) =>
    api.post<User>('/auth/2fa/disable', { code }).then((r) => r.data),

  logout: (refreshToken: string | null) =>
    api.post('/auth/logout', { refresh_token: refreshToken }).then((r) => r.data),

  // Plain navigation target (window.location.href), not a fetch — the
  // browser needs to actually follow the 302 to Google's consent screen.
  googleLoginUrl: () =>
    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/google/login`,

  googleCallback: (code: string, state: string, deviceToken?: string | null) =>
    api
      .post<LoginResponse>('/auth/google/callback', {
        code,
        state,
        device_token: deviceToken ?? undefined,
      })
      .then((r) => r.data),

  // Connects a Google account to the already-logged-in user (profile
  // settings), separate from the login/register flow above — same
  // authenticated GET-URL-then-redirect pattern as the Mercado Pago
  // connect flow in services/payments.ts.
  getGoogleConnectUrl: () =>
    api.get<{ authorization_url: string }>('/users/me/google/connect').then((r) => r.data),

  googleConnectCallback: (code: string, state: string) =>
    api
      .post<GoogleConnectStatus>('/users/me/google/callback', { code, state })
      .then((r) => r.data),

  getGoogleConnectStatus: () =>
    api.get<GoogleConnectStatus>('/users/me/google/status').then((r) => r.data),
}

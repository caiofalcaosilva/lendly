import api from '@/lib/api'
import { LoginResponse, TokenResponse, User } from '@/types'

interface RegisterData {
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

  setupTotp: () =>
    api.post<{ secret: string; uri: string }>('/auth/2fa/setup').then((r) => r.data),

  enableTotp: (code: string) =>
    api.post<User>('/auth/2fa/enable', { code }).then((r) => r.data),

  disableTotp: (code: string) =>
    api.post<User>('/auth/2fa/disable', { code }).then((r) => r.data),
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days — unrelated to the JWT's own exp, just cookie lifetime

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('lendly_token')
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('lendly_refresh_token')
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('lendly_token', accessToken)
  localStorage.setItem('lendly_refresh_token', refreshToken)
  document.cookie = `lendly_token=${accessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

export function clearTokens() {
  localStorage.removeItem('lendly_token')
  localStorage.removeItem('lendly_refresh_token')
  document.cookie = 'lendly_token=; path=/; max-age=0'
}

// "Ver como" (admin view-as) — swaps only the access token, deliberately
// leaving the admin's own refresh_token untouched. If the view-as token
// expires without the admin clicking "Sair", the next 401 refreshes back
// to the admin's real access token automatically — a safe default
// (reverts to the real session) rather than a silent stuck state.
const VIEW_AS_ADMIN_TOKEN_KEY = 'lendly_view_as_admin_token'
const VIEW_AS_TARGET_KEY = 'lendly_view_as_target_id'

export function startViewAs(viewAsAccessToken: string, targetUserId: string) {
  const adminToken = getAccessToken()
  if (adminToken) localStorage.setItem(VIEW_AS_ADMIN_TOKEN_KEY, adminToken)
  localStorage.setItem(VIEW_AS_TARGET_KEY, targetUserId)
  localStorage.setItem('lendly_token', viewAsAccessToken)
  document.cookie = `lendly_token=${viewAsAccessToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  // AuthContext hydrates `user` synchronously from this cache before its
  // fresh /users/me call resolves — leaving the admin's own cached object
  // here would make that first render see the wrong identity and trip
  // the self-heal check in Navbar before the real (target) user ever
  // loads, wiping the markers we just set a line above.
  localStorage.removeItem('lendly_user')
}

export function exitViewAs() {
  const adminToken = localStorage.getItem(VIEW_AS_ADMIN_TOKEN_KEY)
  if (adminToken) {
    localStorage.setItem('lendly_token', adminToken)
    document.cookie = `lendly_token=${adminToken}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
  }
  localStorage.removeItem(VIEW_AS_ADMIN_TOKEN_KEY)
  localStorage.removeItem(VIEW_AS_TARGET_KEY)
  localStorage.removeItem('lendly_user')
}

export function getViewAsTargetId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(VIEW_AS_TARGET_KEY)
}

// Clears the markers without touching the active token — used when the
// session has already moved on by itself (silent refresh reverted to the
// admin's real identity) and there's nothing left to restore.
export function clearViewAsMarkers() {
  localStorage.removeItem(VIEW_AS_ADMIN_TOKEN_KEY)
  localStorage.removeItem(VIEW_AS_TARGET_KEY)
}

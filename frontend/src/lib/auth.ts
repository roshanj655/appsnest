export type StoredUser = {
  role?: string
  name?: string
  business?: { businessName?: string; tenantId?: string }
}

const TOKEN_KEY = 'token'
const REFRESH_KEY = 'refreshToken'
const USER_KEY = 'user'
const UNIT_KEY = 'businessUnitId'

export const getAccessToken = () => localStorage.getItem(TOKEN_KEY) || ''

export const getRefreshToken = () => localStorage.getItem(REFRESH_KEY) || ''

export const getStoredUser = (): StoredUser => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || '{}') as StoredUser
  } catch {
    return {}
  }
}

export const isSuperAdmin = (user: StoredUser = getStoredUser()): boolean => {
  return user.role === 'superadmin'
}

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(UNIT_KEY)
}

const tokenPayload = (token: string): { exp?: number } | null => {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as { exp?: number }
  } catch {
    return null
  }
}

export const isAccessTokenExpired = (token = getAccessToken()) => {
  if (!token) return true
  const payload = tokenPayload(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now() + 3000
}

export const accessTokenExpiresInMs = (token = getAccessToken()) => {
  const payload = tokenPayload(token)
  if (!payload?.exp) return 0
  return Math.max(0, payload.exp * 1000 - Date.now())
}

export const redirectToLogin = (expired = true) => {
  if (window.location.pathname === '/' && !expired) return
  const target = expired ? '/?expired=1' : '/'
  if (`${window.location.pathname}${window.location.search}` === target) return
  window.location.assign(target)
}

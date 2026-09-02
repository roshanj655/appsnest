export type StoredUser = {
  role?: string
  name?: string
  business?: { businessName?: string; tenantId?: string }
}

export const getStoredUser = (): StoredUser => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}') as StoredUser
  } catch {
    return {}
  }
}

export const isSuperAdmin = (user: StoredUser = getStoredUser()): boolean => {
  return user.role === 'superadmin'
}

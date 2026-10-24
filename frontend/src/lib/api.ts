import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearAuthSession, getAccessToken, getRefreshToken, redirectToLogin } from '@/lib/auth'

export const BUSINESS_UNIT_KEY = 'businessUnitId'

export const storedBusinessUnitId = () => {
  const value = localStorage.getItem(BUSINESS_UNIT_KEY)
  return value && value !== 'all' ? value : ''
}

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean }

let refreshInFlight: Promise<string | null> | null = null

const isAuthUrl = (url = '') => url.includes('/api/auth/login') || url.includes('/api/auth/refresh')

export const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post('/api/auth/refresh', { refreshToken })
      .then((res) => {
        const accessToken = String(res.data?.accessToken || '')
        if (!accessToken) return null
        localStorage.setItem('token', accessToken)
        return accessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

axios.interceptors.request.use((config) => {
  const unitId = storedBusinessUnitId()
  if (unitId) {
    config.headers.set('X-Business-Unit-Id', unitId)
  }
  const token = getAccessToken()
  if (token && !config.headers.get('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status
    const original = error.config as RetryConfig | undefined
    if (!original || status !== 401 || isAuthUrl(original.url) || original._retry) {
      return Promise.reject(error)
    }

    original._retry = true
    const nextToken = await refreshAccessToken()
    if (nextToken) {
      original.headers.set('Authorization', `Bearer ${nextToken}`)
      return axios(original)
    }

    clearAuthSession()
    redirectToLogin(true)
    return Promise.reject(error)
  }
)

export const authHeaders = (extra?: Record<string, string>) => ({
  headers: {
    Authorization: `Bearer ${getAccessToken()}`,
    ...extra
  }
})

export const listParams = { params: { page: 1, limit: 200 } }

export const listItems = <T = any>(data: unknown): T[] => {
  if (Array.isArray(data)) {
    return data as T[]
  }
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.items)) {
      return record.items as T[]
    }
    if (Array.isArray(record.logs)) {
      return record.logs as Record<string, unknown>[] as T[]
    }
  }
  return []
}

import axios from 'axios'

export const BUSINESS_UNIT_KEY = 'businessUnitId'

export const storedBusinessUnitId = () => {
  const value = localStorage.getItem(BUSINESS_UNIT_KEY)
  return value && value !== 'all' ? value : ''
}

axios.interceptors.request.use((config) => {
  const unitId = storedBusinessUnitId()
  if (unitId) {
    config.headers.set('X-Business-Unit-Id', unitId)
  }
  return config
})

export const authHeaders = (extra?: Record<string, string>) => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
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
      return record.logs as T[]
    }
  }
  return []
}

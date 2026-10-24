import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import {
  accessTokenExpiresInMs,
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired
} from '@/lib/auth'
import { refreshAccessToken } from '@/lib/api'

const RequireAuth = () => {
  const hasSession = Boolean(getAccessToken() || getRefreshToken())
  const [status, setStatus] = useState<'checking' | 'ok' | 'out'>(hasSession ? 'checking' : 'out')

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const expire = () => {
      clearAuthSession()
      if (!cancelled) setStatus('out')
    }

    const armTimer = () => {
      const wait = accessTokenExpiresInMs()
      if (!wait) {
        expire()
        return
      }
      timer = setTimeout(async () => {
        const next = await refreshAccessToken()
        if (cancelled) return
        if (next) {
          armTimer()
          return
        }
        expire()
      }, wait)
    }

    const boot = async () => {
      if (!getAccessToken() && !getRefreshToken()) {
        expire()
        return
      }
      if (isAccessTokenExpired()) {
        const next = await refreshAccessToken()
        if (cancelled) return
        if (!next) {
          expire()
          return
        }
      }
      if (!cancelled) setStatus('ok')
      armTimer()
    }

    void boot()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (status === 'out') {
    return <Navigate to="/?expired=1" replace />
  }

  if (status === 'checking') {
    return <div className="p-8 text-sm text-muted-foreground">Checking session…</div>
  }

  return <Outlet />
}

export default RequireAuth

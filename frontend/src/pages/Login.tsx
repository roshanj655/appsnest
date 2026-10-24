import { useState, useEffect } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/FormField'
import { emailMsg, isValidEmail, requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { getAccessToken, isAccessTokenExpired, clearAuthSession } from '@/lib/auth'

const Login = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const location = useLocation()
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('expired') === '1') {
      clearAuthSession()
      setErrorMessage('Your session expired. Please log in again.')
      navigate('/', { replace: true })
      return
    }
    const msg = (location.state as { successMessage?: string } | null)?.successMessage
    if (msg) {
      setSuccessMessage(msg)
      navigate(location.pathname, { replace: true, state: {} })
    }
    if (getAccessToken() && !isAccessTokenExpired()) {
      navigate('/dashboard', { replace: true })
    }
  }, [location, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    clearFieldErrors()

    const errors: Record<string, string> = {}
    if (!email.trim()) errors.email = requiredMsg('Email')
    else if (!isValidEmail(email)) errors.email = emailMsg
    if (!password.trim()) errors.password = requiredMsg('Password')
    if (showFieldErrors(errors)) return

    try {
      const res = await axios.post('/api/auth/login', { email, password })
      localStorage.setItem('token', res.data.accessToken)
      localStorage.setItem('refreshToken', res.data.refreshToken)
      localStorage.setItem('user', JSON.stringify(res.data))
      navigate('/dashboard')
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.response?.data?.message || 'Login failed. Please check your credentials and try again.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 bg-white/95 shadow-2xl shadow-blue-100/80 backdrop-blur">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl">Welcome Back</CardTitle>
          <CardDescription>Sign in to access your admin dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          )}
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <FormField id="email" label="Email" error={fieldErrors.email} required>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                invalid={Boolean(fieldErrors.email)}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearFieldError('email')
                }}
              />
            </FormField>
            <FormField id="password" label="Password" error={fieldErrors.password} required>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                invalid={Boolean(fieldErrors.password)}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearFieldError('password')
                }}
              />
            </FormField>
            <Button type="submit" className="w-full">Login</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default Login

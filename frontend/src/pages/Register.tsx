import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField } from '@/components/FormField'
import { emailMsg, isValidEmail, requiredMsg, useFieldErrors } from '@/lib/formValidation'
import { isSuperAdmin } from '@/lib/auth'
import SearchableSelect from '@/components/SearchableSelect'

const Register = () => {
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [userPhone, setUserPhone] = useState('')
  const [databaseProvider, setDatabaseProvider] = useState('atlas')
  const [atlasProjectName, setAtlasProjectName] = useState('')
  const [clusterName, setClusterName] = useState('')
  const [databaseName, setDatabaseName] = useState('')
  const [connectionString, setConnectionString] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState('basic')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const { fieldErrors, clearFieldErrors, clearFieldError, showFieldErrors } = useFieldErrors()
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || !isSuperAdmin()) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    clearFieldErrors()

    const errors: Record<string, string> = {}
    if (!businessName.trim()) errors['reg-business-name'] = requiredMsg('Business name')
    if (!ownerName.trim()) errors['reg-owner-name'] = requiredMsg('Owner name')
    if (!businessEmail.trim()) errors['reg-business-email'] = requiredMsg('Business email')
    else if (!isValidEmail(businessEmail)) errors['reg-business-email'] = emailMsg
    if (!businessPhone.trim()) errors['reg-business-phone'] = requiredMsg('Business phone')

    if (!databaseName.trim()) errors['reg-db-name'] = requiredMsg('Database name')
    else if (!/^[a-zA-Z0-9_-]+$/.test(databaseName.trim())) {
      errors['reg-db-name'] = 'Use only letters, numbers, underscore, or hyphen.'
    }
    if (databaseProvider !== 'atlas' && !connectionString.trim()) {
      errors['reg-connection'] = requiredMsg('Connection string')
    }

    if (!userName.trim()) errors['reg-admin-name'] = requiredMsg('Name')
    if (!userEmail.trim()) errors['reg-admin-email'] = requiredMsg('Email')
    else if (!isValidEmail(userEmail)) errors['reg-admin-email'] = emailMsg
    if (!userPassword.trim()) errors['reg-admin-password'] = requiredMsg('Password')
    else if (userPassword.length < 6) errors['reg-admin-password'] = 'Password must be at least 6 characters long.'
    if (!userPhone.trim()) errors['reg-admin-phone'] = requiredMsg('Phone')

    if (showFieldErrors(errors)) return

    try {
      const token = localStorage.getItem('token')
      await axios.post(
        '/api/auth/register',
        {
          businessName,
          ownerName,
          businessEmail,
          businessPhone,
          userName,
          userEmail,
          userPassword,
          userPhone,
          databaseProvider,
          atlasProjectName,
          clusterName,
          databaseName: databaseName.trim(),
          connectionString: connectionString.trim(),
          subscriptionPlan
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setSuccessMessage('Business registered. The tenant admin can log in with the email you created.')
      navigate('/businesses')
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.response?.data?.message || 'Registration failed. Please try again.')
    }
  }

  return (
    <div className="bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.18),_transparent_25%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-10">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <Card className="w-full border-slate-200 bg-white/95 shadow-2xl shadow-blue-100/80 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Register Business</CardTitle>
            <CardDescription>Super admin only. Create a tenant workspace and its first admin user.</CardDescription>
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
            <form noValidate onSubmit={handleSubmit} className="space-y-8">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Business Details</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField id="reg-business-name" label="Business Name" error={fieldErrors['reg-business-name']} required>
                    <Input
                      id="reg-business-name"
                      type="text"
                      value={businessName}
                      invalid={Boolean(fieldErrors['reg-business-name'])}
                      onChange={(e) => {
                        setBusinessName(e.target.value)
                        clearFieldError('reg-business-name')
                      }}
                      placeholder="Enter business name"
                    />
                  </FormField>
                  <FormField id="reg-owner-name" label="Owner Name" error={fieldErrors['reg-owner-name']} required>
                    <Input
                      id="reg-owner-name"
                      type="text"
                      value={ownerName}
                      invalid={Boolean(fieldErrors['reg-owner-name'])}
                      onChange={(e) => {
                        setOwnerName(e.target.value)
                        clearFieldError('reg-owner-name')
                      }}
                      placeholder="Enter owner name"
                    />
                  </FormField>
                  <FormField id="reg-business-email" label="Business Email" error={fieldErrors['reg-business-email']} required>
                    <Input
                      id="reg-business-email"
                      type="email"
                      value={businessEmail}
                      invalid={Boolean(fieldErrors['reg-business-email'])}
                      onChange={(e) => {
                        setBusinessEmail(e.target.value)
                        clearFieldError('reg-business-email')
                      }}
                      placeholder="business@example.com"
                    />
                  </FormField>
                  <FormField id="reg-business-phone" label="Business Phone" error={fieldErrors['reg-business-phone']} required>
                    <Input
                      id="reg-business-phone"
                      type="text"
                      value={businessPhone}
                      invalid={Boolean(fieldErrors['reg-business-phone'])}
                      onChange={(e) => {
                        setBusinessPhone(e.target.value)
                        clearFieldError('reg-business-phone')
                      }}
                      placeholder="Enter business phone"
                    />
                  </FormField>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Database Configuration</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField id="reg-db-provider" label="Database Provider" error={fieldErrors['reg-db-provider']}>
                    <SearchableSelect
                      id="reg-db-provider"
                      value={databaseProvider}
                      invalid={Boolean(fieldErrors['reg-db-provider'])}
                      onChange={(value) => {
                        setDatabaseProvider(value)
                        clearFieldError('reg-db-provider')
                        clearFieldError('reg-connection')
                      }}
                      options={[
                        { value: 'atlas', label: 'MongoDB Atlas' },
                        { value: 'self-hosted', label: 'Self-Hosted' }
                      ]}
                    />
                  </FormField>
                  <FormField id="reg-plan" label="Subscription Plan" error={fieldErrors['reg-plan']}>
                    <SearchableSelect
                      id="reg-plan"
                      value={subscriptionPlan}
                      invalid={Boolean(fieldErrors['reg-plan'])}
                      onChange={(value) => {
                        setSubscriptionPlan(value)
                        clearFieldError('reg-plan')
                      }}
                      options={[
                        { value: 'basic', label: 'Basic' },
                        { value: 'pro', label: 'Pro' },
                        { value: 'enterprise', label: 'Enterprise' }
                      ]}
                    />
                  </FormField>
                  <FormField id="reg-atlas-project" label="Atlas Project Name" error={fieldErrors['reg-atlas-project']}>
                    <Input
                      id="reg-atlas-project"
                      type="text"
                      value={atlasProjectName}
                      invalid={Boolean(fieldErrors['reg-atlas-project'])}
                      onChange={(e) => {
                        setAtlasProjectName(e.target.value)
                        clearFieldError('reg-atlas-project')
                      }}
                      placeholder="Optional"
                    />
                  </FormField>
                  <FormField id="reg-cluster" label="Cluster Name" error={fieldErrors['reg-cluster']}>
                    <Input
                      id="reg-cluster"
                      type="text"
                      value={clusterName}
                      invalid={Boolean(fieldErrors['reg-cluster'])}
                      onChange={(e) => {
                        setClusterName(e.target.value)
                        clearFieldError('reg-cluster')
                      }}
                      placeholder="Optional"
                    />
                  </FormField>
                  <FormField
                    id="reg-db-name"
                    label="Database Name"
                    error={fieldErrors['reg-db-name']}
                    required
                    hint="This becomes the MongoDB database name (not test)."
                  >
                    <Input
                      id="reg-db-name"
                      type="text"
                      value={databaseName}
                      invalid={Boolean(fieldErrors['reg-db-name'])}
                      onChange={(e) => {
                        setDatabaseName(e.target.value)
                        clearFieldError('reg-db-name')
                      }}
                      placeholder="e.g. moksh_store"
                    />
                  </FormField>
                  <FormField
                    id="reg-connection"
                    label="Connection String"
                    error={fieldErrors['reg-connection']}
                    required={databaseProvider !== 'atlas'}
                  >
                    <Input
                      id="reg-connection"
                      type="text"
                      value={connectionString}
                      invalid={Boolean(fieldErrors['reg-connection'])}
                      onChange={(e) => {
                        setConnectionString(e.target.value)
                        clearFieldError('reg-connection')
                      }}
                      placeholder={databaseProvider === 'atlas' ? 'Auto-generated (optional)' : 'Enter connection string'}
                    />
                  </FormField>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Admin User</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField id="reg-admin-name" label="Name" error={fieldErrors['reg-admin-name']} required>
                    <Input
                      id="reg-admin-name"
                      type="text"
                      value={userName}
                      invalid={Boolean(fieldErrors['reg-admin-name'])}
                      onChange={(e) => {
                        setUserName(e.target.value)
                        clearFieldError('reg-admin-name')
                      }}
                      placeholder="Admin name"
                    />
                  </FormField>
                  <FormField id="reg-admin-email" label="Email" error={fieldErrors['reg-admin-email']} required>
                    <Input
                      id="reg-admin-email"
                      type="email"
                      value={userEmail}
                      invalid={Boolean(fieldErrors['reg-admin-email'])}
                      onChange={(e) => {
                        setUserEmail(e.target.value)
                        clearFieldError('reg-admin-email')
                      }}
                      placeholder="admin@example.com"
                    />
                  </FormField>
                  <FormField id="reg-admin-password" label="Password" error={fieldErrors['reg-admin-password']} required>
                    <Input
                      id="reg-admin-password"
                      type="password"
                      value={userPassword}
                      invalid={Boolean(fieldErrors['reg-admin-password'])}
                      onChange={(e) => {
                        setUserPassword(e.target.value)
                        clearFieldError('reg-admin-password')
                      }}
                      placeholder="Minimum 6 characters"
                    />
                  </FormField>
                  <FormField id="reg-admin-phone" label="Phone" error={fieldErrors['reg-admin-phone']} required>
                    <Input
                      id="reg-admin-phone"
                      type="text"
                      value={userPhone}
                      invalid={Boolean(fieldErrors['reg-admin-phone'])}
                      onChange={(e) => {
                        setUserPhone(e.target.value)
                        clearFieldError('reg-admin-phone')
                      }}
                      placeholder="Enter phone number"
                    />
                  </FormField>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Register Business
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Register

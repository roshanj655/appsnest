import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

    if (!businessName.trim() || !ownerName.trim() || !businessEmail.trim() || !businessPhone.trim()) {
      setErrorMessage('Please complete all business details.')
      return
    }

    if (!userName.trim() || !userEmail.trim() || !userPassword.trim() || !userPhone.trim()) {
      setErrorMessage('Please complete all admin user details.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      setErrorMessage('Please enter valid email addresses.')
      return
    }

    if (userPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.')
      return
    }

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
          databaseName,
          connectionString,
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
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <h3 className="mb-3 text-lg font-semibold">Business Details</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reg-business-name" className="mb-2 block">Business Name</Label>
              <Input
                id="reg-business-name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter business name"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-owner-name" className="mb-2 block">Owner Name</Label>
              <Input
                id="reg-owner-name"
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Enter owner name"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-business-email" className="mb-2 block">Business Email</Label>
              <Input
                id="reg-business-email"
                type="email"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                placeholder="business@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-business-phone" className="mb-2 block">Business Phone</Label>
              <Input
                id="reg-business-phone"
                type="text"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="Enter business phone"
                required
              />
            </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Database Configuration</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reg-db-provider" className="mb-2 block">Database Provider</Label>
              <SearchableSelect
                id="reg-db-provider"
                value={databaseProvider}
                onChange={setDatabaseProvider}
                options={[
                  { value: 'atlas', label: 'MongoDB Atlas' },
                  { value: 'self-hosted', label: 'Self-Hosted' }
                ]}
              />
            </div>
            <div>
              <Label htmlFor="reg-plan" className="mb-2 block">Subscription Plan</Label>
              <SearchableSelect
                id="reg-plan"
                value={subscriptionPlan}
                onChange={setSubscriptionPlan}
                options={[
                  { value: 'basic', label: 'Basic' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'enterprise', label: 'Enterprise' }
                ]}
              />
            </div>
            <div>
              <Label htmlFor="reg-atlas-project" className="mb-2 block">Atlas Project Name</Label>
              <Input
                id="reg-atlas-project"
                type="text"
                value={atlasProjectName}
                onChange={(e) => setAtlasProjectName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="reg-cluster" className="mb-2 block">Cluster Name</Label>
              <Input
                id="reg-cluster"
                type="text"
                value={clusterName}
                onChange={(e) => setClusterName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="reg-db-name" className="mb-2 block">Database Name</Label>
              <Input
                id="reg-db-name"
                type="text"
                value={databaseName}
                onChange={(e) => setDatabaseName(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label htmlFor="reg-connection" className="mb-2 block">Connection String</Label>
              <Input
                id="reg-connection"
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                required={databaseProvider !== 'atlas'}
                placeholder={databaseProvider === 'atlas' ? 'Auto-generated (optional)' : 'Enter connection string'}
              />
            </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-lg font-semibold">Admin User</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="reg-admin-name" className="mb-2 block">Name</Label>
              <Input
                id="reg-admin-name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Admin name"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-admin-email" className="mb-2 block">Email</Label>
              <Input
                id="reg-admin-email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-admin-password" className="mb-2 block">Password</Label>
              <Input
                id="reg-admin-password"
                type="password"
                value={userPassword}
                onChange={(e) => setUserPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div>
              <Label htmlFor="reg-admin-phone" className="mb-2 block">Phone</Label>
              <Input
                id="reg-admin-phone"
                type="text"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                placeholder="Enter phone number"
                required
              />
            </div>
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

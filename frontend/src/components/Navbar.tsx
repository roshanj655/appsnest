import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
  FileClock,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoonStar,
  Package,
  ScanBarcode,
  Search,
  Receipt,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  SunMedium,
  Tags,
  Truck,
  UserPlus,
  Users,
  Wallet,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isSuperAdmin } from '@/lib/auth'
import { authHeaders, BUSINESS_UNIT_KEY, listItems, listParams, storedBusinessUnitId } from '@/lib/api'
import axios from 'axios'

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') {
      return 'dark'
    }

    const savedTheme = window.localStorage.getItem('theme')
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  const location = useLocation()
  const navigate = useNavigate()
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      return {}
    }
  }, [location.pathname])
  const superAdmin = isSuperAdmin(user)

  type NavItem = { to: string; label: string; icon: typeof LayoutDashboard }
  type NavSection = { title: string; items: NavItem[] }

  const navigationSections: NavSection[] = superAdmin
    ? [
        {
          title: 'Overview',
          items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
          title: 'Tenants',
          items: [
            { to: '/businesses', label: 'Businesses', icon: Building2 },
            { to: '/register', label: 'Register Business', icon: UserPlus }
          ]
        }
      ]
    : [
        {
          title: 'Overview',
          items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
        },
        {
          title: 'Inventory',
          items: [
            { to: '/products', label: 'Products', icon: Package },
            { to: '/categories', label: 'Categories', icon: Tags },
            { to: '/stock-adjustments', label: 'Stock Adjustments', icon: SlidersHorizontal },
            { to: '/stock-history', label: 'Stock History', icon: History },
            { to: '/inventory', label: 'Stock Value', icon: BarChart3 },
            { to: '/inventory/low-stock', label: 'Low Stock', icon: Boxes }
          ]
        },
        {
          title: 'Parties',
          items: [
            { to: '/customers', label: 'Customers', icon: Users },
            { to: '/suppliers', label: 'Suppliers', icon: Truck }
          ]
        },
        {
          title: 'Operations',
          items: [
            { to: '/pos', label: 'POS', icon: ScanBarcode },
            { to: '/sales', label: 'Sales', icon: ShoppingCart },
            { to: '/purchases', label: 'Purchases', icon: Receipt }
          ]
        },
        {
          title: 'Finance',
          items: [{ to: '/expenses', label: 'Misc Expenses', icon: Wallet }]
        },
        {
          title: 'Insights',
          items: [
            { to: '/reports', label: 'Reports', icon: BarChart3 },
            { to: '/audit-logs', label: 'Audit Logs', icon: FileClock }
          ]
        },
        {
          title: 'System',
          items: [
            { to: '/business-units', label: 'Business Units', icon: Store },
            { to: '/settings', label: 'Settings', icon: Settings }
          ]
        }
      ]

  const navigationItems = navigationSections.flatMap((section) => section.items)
  const currentItem = [...navigationItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
  const currentLabel = currentItem?.label || 'ERP Dashboard'
  const activeSectionTitle =
    navigationSections.find((section) => section.items.some((item) => item.to === currentItem?.to))?.title ||
    navigationSections[0]?.title

  const [openSection, setOpenSection] = useState<string | null>(activeSectionTitle)
  const [units, setUnits] = useState<Array<{ _id: string; name: string; code: string }>>([])
  const [selectedUnit, setSelectedUnit] = useState(storedBusinessUnitId() || 'all')

  const changeUnit = (value: string) => {
    setSelectedUnit(value)
    if (!value || value === 'all') {
      localStorage.removeItem(BUSINESS_UNIT_KEY)
    } else {
      localStorage.setItem(BUSINESS_UNIT_KEY, value)
    }
    window.location.reload()
  }

  useEffect(() => {
    if (superAdmin) return
    axios
      .get('/api/business-units', { ...authHeaders(), ...listParams })
      .then((res) => setUnits(listItems(res.data)))
      .catch(() => setUnits([]))
  }, [superAdmin])

  useEffect(() => {
    if (activeSectionTitle) {
      setOpenSection(activeSectionTitle)
    }
  }, [activeSectionTitle])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem(BUSINESS_UNIT_KEY)
    navigate('/')
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('theme', theme)
  }, [theme])

  const isLightTheme = theme === 'light'

  return (
    <>
      <header
        className={[
          'sticky top-0 z-40 backdrop-blur-xl lg:pl-64',
          isLightTheme
            ? 'border-b border-slate-200/80 bg-white/85'
            : 'border-b border-white/10 bg-[#0b1119]/90'
        ].join(' ')}
      >
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className={[
                'lg:hidden',
                isLightTheme
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  : 'border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white'
              ].join(' ')}
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div
              className={[
                'hidden h-9 w-9 items-center justify-center rounded-xl sm:flex',
                isLightTheme
                  ? 'border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm'
                  : 'border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.12)]'
              ].join(' ')}
            >
              <MoonStar className="h-4 w-4" />
            </div>
            <div>
              <p
                className={[
                  'text-[10px] font-semibold uppercase tracking-[0.28em]',
                  isLightTheme ? 'text-cyan-700/80' : 'text-cyan-300/70'
                ].join(' ')}
              >
                Hud Console
              </p>
              <h1 className={['text-base font-semibold', isLightTheme ? 'text-slate-900' : 'text-white'].join(' ')}>
                {currentLabel}
              </h1>
            </div>
            {!superAdmin && (
              <select
                aria-label="Business unit"
                className={[
                  'h-9 max-w-[9.5rem] rounded-xl border px-2 text-xs font-semibold lg:hidden',
                  isLightTheme
                    ? 'border-slate-200 bg-white text-slate-700'
                    : 'border-white/10 bg-white/5 text-slate-100'
                ].join(' ')}
                value={selectedUnit}
                onChange={(e) => changeUnit(e.target.value)}
              >
                <option value="all">All units</option>
                {units.map((unit) => (
                  <option key={unit._id} value={unit._id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {!superAdmin && (
              <select
                aria-label="Business unit"
                className={[
                  'h-9 rounded-xl border px-3 text-xs font-semibold',
                  isLightTheme
                    ? 'border-slate-200 bg-white text-slate-700'
                    : 'border-white/10 bg-white/5 text-slate-100'
                ].join(' ')}
                value={selectedUnit}
                onChange={(e) => changeUnit(e.target.value)}
              >
                <option value="all">All units</option>
                {units.map((unit) => (
                  <option key={unit._id} value={unit._id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setTheme(isLightTheme ? 'dark' : 'light')}
              aria-label={`Switch to ${isLightTheme ? 'dark' : 'light'} theme`}
            >
              {isLightTheme ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
              {isLightTheme ? 'Dark' : 'Light'}
            </Button>
            <div
              className={[
                'flex items-center gap-3 rounded-2xl px-4 py-2 text-xs',
                isLightTheme
                  ? 'border border-slate-200 bg-white text-slate-600'
                  : 'border border-white/10 bg-white/[0.03] text-slate-300'
              ].join(' ')}
            >
              <Search className={['h-4 w-4', isLightTheme ? 'text-cyan-700' : 'text-cyan-300'].join(' ')} />
              <span className={isLightTheme ? 'text-slate-500' : 'text-slate-400'}>
                Search inventory, customers, reports
              </span>
            </div>
            <div
              className={[
                'flex items-center gap-3 rounded-2xl px-4 py-2',
                isLightTheme ? 'border border-slate-200 bg-white' : 'border border-white/10 bg-white/[0.04]'
              ].join(' ')}
            >
              <div
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-xl text-xs font-semibold',
                  isLightTheme
                    ? 'border border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm'
                    : 'border border-cyan-400/20 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.12)]'
                ].join(' ')}
              >
                {(user?.name || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div className="text-right">
                <p className={['text-xs font-semibold', isLightTheme ? 'text-slate-900' : 'text-white'].join(' ')}>
                  {user?.name || 'Admin User'}
                </p>
                <p className={['text-[11px]', isLightTheme ? 'text-slate-500' : 'text-slate-400'].join(' ')}>
                  {user?.business?.businessName || 'ERP SaaS'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-200 lg:translate-x-0',
          isLightTheme
            ? 'border-r border-slate-200 bg-white text-slate-800 shadow-[20px_0_60px_rgba(15,23,42,0.08)]'
            : 'border-r border-white/10 bg-[#090e15] text-slate-100 shadow-[30px_0_80px_rgba(0,0,0,0.35)]',
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        ].join(' ')}
      >
        <div className="flex h-full flex-col">
          <div className={['flex items-center justify-between px-4 py-4', isLightTheme ? 'border-b border-slate-200' : 'border-b border-white/10'].join(' ')}>
            <div className="flex items-center gap-3">
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  isLightTheme
                    ? 'border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm'
                    : 'border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 via-blue-500/20 to-cyan-400/10 text-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.18)]'
                ].join(' ')}
              >
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <p className={['text-sm font-semibold', isLightTheme ? 'text-slate-900' : 'text-white'].join(' ')}>
                  ERP Admin
                </p>
                <p
                  className={[
                    'text-[10px] uppercase tracking-[0.18em]',
                    isLightTheme ? 'text-cyan-700/70' : 'text-cyan-300/65'
                  ].join(' ')}
                >
                  Business operations
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className={['lg:hidden', isLightTheme ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'].join(' ')}
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
            {navigationSections.map((section) => {
              const isOpen = openSection === section.title
              return (
                <div key={section.title}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? null : section.title)}
                    className={[
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                      isOpen
                        ? isLightTheme
                          ? 'bg-slate-50 text-slate-700'
                          : 'bg-white/[0.04] text-slate-200'
                        : isLightTheme
                          ? 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'
                          : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-200'
                    ].join(' ')}
                    aria-expanded={isOpen}
                  >
                    <span>{section.title}</span>
                    <ChevronDown className={['h-3.5 w-3.5 transition-transform duration-200', isOpen ? 'rotate-180' : ''].join(' ')} />
                  </button>
                  <div
                    className={[
                      'grid transition-[grid-template-rows] duration-200 ease-out',
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    ].join(' ')}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-0.5 pb-1 pt-0.5">
                        {section.items.map((item) => {
                          const Icon = item.icon
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setMenuOpen(false)}
                              className={({ isActive }) =>
                                [
                                  'group flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[13px] font-medium transition-all duration-200',
                                  isActive
                                    ? isLightTheme
                                      ? 'border-cyan-200 bg-cyan-50 text-cyan-900 shadow-sm'
                                      : 'border-cyan-400/30 bg-cyan-400/10 text-white shadow-[0_0_30px_rgba(34,211,238,0.12)]'
                                    : isLightTheme
                                      ? 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                                      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'
                                ].join(' ')
                              }
                            >
                              <span
                                className={[
                                  'flex h-6 w-6 items-center justify-center rounded-md transition-colors',
                                  isLightTheme
                                    ? 'border border-slate-200 bg-white text-slate-500 group-hover:border-cyan-200 group-hover:bg-cyan-50 group-hover:text-cyan-700'
                                    : 'border border-white/10 bg-white/5 text-slate-200 group-hover:border-cyan-400/20 group-hover:bg-cyan-400/10 group-hover:text-cyan-200'
                                ].join(' ')}
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                              <span>{item.label}</span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>

          <div className={['p-4', isLightTheme ? 'border-t border-slate-200' : 'border-t border-white/10'].join(' ')}>
            <Button
              variant="secondary"
              className={[
                'w-full justify-start',
                isLightTheme
                  ? 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]'
              ].join(' ')}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Navbar

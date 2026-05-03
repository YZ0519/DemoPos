import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Shield, ShieldCheck, Settings,
  LogOut, ChevronDown, ChevronLeft, ChevronRight, Menu, X,
  Tag, Award, Ruler, Package,
  Users2, Truck, ShoppingCart, ShoppingBag, Terminal,
  CreditCard, FileText, BarChart2, ClipboardList, Archive,
  DollarSign, Layers, GitBranch, Sun, Moon, Box,
  UtensilsCrossed, LayoutGrid, Ticket,
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import authApi from '../api/auth'
import toast from 'react-hot-toast'

/**
 * Accordion-style navigation groups.
 *
 * Each group has:
 *   - key:   unique string used as the openGroups state key
 *   - label: displayed group heading
 *   - items: nav links; permission is optional — omit to show to all authenticated users
 *
 * Business rule: Dashboard has no permission guard (all authenticated users can see it).
 * Purchases is in Management because it is a back-office operation, not a front-counter sale.
 */
const navGroups = [
  {
    key: 'Management',
    label: 'Management',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    key: 'Sales',
    label: 'Sales',
    items: [
      { to: '/pos',       icon: Terminal,     label: 'POS Terminal', permission: 'sale_create'   },
      { to: '/sales',     icon: ShoppingCart, label: 'Sales',        permission: 'sale_view'     },
      { to: '/purchases', icon: ShoppingBag,  label: 'Purchases',    permission: 'purchase_view' },
    ],
  },
  {
    key: 'People',
    label: 'People',
    items: [
      { to: '/customers', icon: Users2, label: 'Customers', permission: 'customer_view' },
      { to: '/suppliers', icon: Truck,  label: 'Suppliers', permission: 'supplier_view' },
    ],
  },
  {
    key: 'Inventory',
    label: 'Inventory',
    items: [
      { to: '/products',   icon: Package, label: 'Products',   permission: 'product_view'  },
      { to: '/categories', icon: Tag,     label: 'Categories', permission: 'category_view' },
      { to: '/brands',     icon: Award,   label: 'Brands',     permission: 'brand_view'    },
      { to: '/units',      icon: Ruler,   label: 'Units',      permission: 'unit_view'     },
    ],
  },
  {
    key: 'Assembly',
    label: 'Assembly',
    items: [
      { to: '/assembly-templates', icon: GitBranch, label: 'Assembly Templates', permission: 'assembly_view' },
      { to: '/stock-assemblies',   icon: Layers,    label: 'Stock Assemblies',   permission: 'assembly_view' },
    ],
  },
  {
    key: 'Reports',
    label: 'Reports',
    items: [
      { to: '/reports/sales',      icon: FileText,      label: 'Sales Report',      permission: 'reports_sales'      },
      { to: '/reports/summary',    icon: BarChart2,     label: 'Sales Summary',     permission: 'reports_summary'    },
      { to: '/reports/inventory',  icon: ClipboardList, label: 'Inventory Report',  permission: 'reports_inventory'  },
      { to: '/reports/purchases',  icon: Archive,       label: 'Purchase Report',   permission: 'reports_purchases'  },
    ],
  },
  {
    key: 'Restaurant',
    label: 'Restaurant',
    items: [
      { to: '/tables',   icon: LayoutGrid, label: 'Tables',   permission: 'table_view'   },
      { to: '/vouchers', icon: Ticket,     label: 'Vouchers', permission: 'voucher_view' },
    ],
  },
  {
    key: 'Configuration',
    label: 'Configuration',
    items: [
      { to: '/currencies',       icon: DollarSign,  label: 'Currency',         permission: 'currency_view'        },
      { to: '/payment-methods', icon: CreditCard,  label: 'Payment Methods',  permission: 'payment_method_view'  },
      { to: '/product-bundles', icon: Box,         label: 'Product Bundles',  permission: 'product_bundle_view'  },
      { to: '/users',           icon: Users,       label: 'Users',            permission: 'user_view'            },
      { to: '/roles',           icon: Shield,      label: 'Roles',           permission: 'role_view'           },
      { to: '/permissions',     icon: ShieldCheck, label: 'Permissions',     permission: 'permission_view'     },
      { to: '/settings',        icon: Settings,    label: 'Settings' },
    ],
  },
]

/**
 * Sidebar component extracted for readability.
 * Receives all data and callbacks as props so AppLayout stays clean.
 */
function Sidebar({ user, userPerms, sidebarOpen, setSidebarOpen, handleLogout, navigate, collapsed, setCollapsed }) {
  const location = useLocation()

  // Sales is open by default; all other groups start closed.
  const [openGroups, setOpenGroups] = useState({ Sales: true })

  /**
   * On mount (and whenever the pathname changes), auto-expand the group that
   * contains the currently active route so the active link is always visible.
   */
  useEffect(() => {
    navGroups.forEach((group) => {
      const isActiveGroup = group.items.some((item) =>
        location.pathname === item.to || location.pathname.startsWith(item.to + '/')
      )
      if (isActiveGroup) {
        setOpenGroups((prev) => ({ ...prev, [group.key]: true }))
      }
    })
  }, [location.pathname])

  function toggleGroup(key) {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-30 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-all duration-300 print:hidden ${
        collapsed ? 'lg:w-[80px]' : 'w-60'
      } ${
        sidebarOpen ? 'translate-x-0 w-60' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100 dark:border-slate-700">
        <button
          onClick={() => { navigate('/dashboard'); setSidebarOpen(false) }}
          className="flex items-center gap-3 cursor-pointer shrink-0"
          aria-label="Go to Dashboard"
          title="Go to Dashboard"
        >
          <div className="w-9 h-9 bg-blue-600 dark:bg-blue-500 rounded-xl flex items-center justify-center shadow dark:shadow-blue-900/60 dark:ring-1 dark:ring-blue-400/30">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          {!collapsed && (
            <span className="text-xl font-bold text-gray-900 dark:text-slate-100">DemoPos</span>
          )}
        </button>
        <button
          className="ml-auto lg:hidden text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 cursor-pointer"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      {/* Accordion Nav */}
      <nav className={`flex-1 overflow-y-auto space-y-1 ${collapsed ? 'px-1.5 py-4' : 'px-3 py-4'}`} aria-label="Main navigation">
        {navGroups.map((group) => {
          // Filter to items the current user has permission to see
          const visibleItems = group.items.filter(
            ({ permission }) => !permission || userPerms.includes(permission)
          )

          // Hide the entire group when no items are visible
          if (visibleItems.length === 0) return null

          const isOpen = !!openGroups[group.key]

          return (
            <div key={group.key}>
              {/* Group header — acts as accordion toggle (hidden when collapsed) */}
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:text-gray-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                  aria-expanded={isOpen}
                  aria-controls={`group-${group.key}`}
                >
                  <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                    {group.label}
                  </span>
                  <ChevronRight
                    size={14}
                    className={`text-gray-400 dark:text-slate-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-90' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              )}

              {/* Collapsible items container — always visible when collapsed (icon-only) */}
              <div
                id={`group-${group.key}`}
                className={collapsed ? '' : `overflow-hidden transition-all duration-200 ${
                  isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className={`space-y-1 ${collapsed ? 'py-0.5' : 'pt-1 pb-2'}`}>
                  {visibleItems.map(({ to, icon, label }) => {
                    const Icon = icon
                    return (
                      <NavLink
                        key={to}
                        to={to}
                        title={collapsed ? label : undefined}
                        className={({ isActive }) =>
                          `flex items-center rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                            collapsed
                              ? `justify-center px-0 py-2.5 ${
                                  isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
                                }`
                              : `gap-3 px-3 py-2.5 ${
                                  isActive
                                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
                                }`
                          }`
                        }
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon size={18} aria-hidden="true" />
                        {!collapsed && label}
                      </NavLink>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="hidden lg:flex px-3 py-2 border-t border-gray-100 dark:border-slate-700 justify-center">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer p-2.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={26} /> : <ChevronLeft size={26} />}
        </button>
      </div>

      {/* User section */}
      <div className={`py-4 border-t border-gray-100 dark:border-slate-700 ${collapsed ? 'px-1.5' : 'px-3'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'}`}>
          <button
            onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
            className="shrink-0 cursor-pointer"
            title="Go to Profile"
            aria-label="Go to Profile"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400 font-semibold text-sm hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-600 transition-shadow">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
          </button>
          {!collapsed && (
            <>
              <button
                onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
                className="flex-1 min-w-0 text-left cursor-pointer"
                title="Go to Profile"
                aria-label="Go to Profile"
              >
                <p className="text-sm font-medium text-gray-900 dark:text-slate-200 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{user?.role}</p>
              </button>
              <button
                onClick={handleLogout}
                className="text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const userPerms = user?.permissions ?? []
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('demopos_sidebar_collapsed') === 'true' } catch { return false }
  })
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef(null)

  // Persist sidebar collapsed preference
  useEffect(() => {
    try { localStorage.setItem('demopos_sidebar_collapsed', String(sidebarCollapsed)) } catch { /* ignore */ }
  }, [sidebarCollapsed])

  // Close user dropdown when clicking outside of it
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  const handleLogout = async () => {
    try {
      await authApi.logout()
    } catch { /* ignore logout API error — session is cleared locally regardless */ }
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden print:overflow-visible print:h-auto">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 z-20 lg:hidden cursor-pointer"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        userPerms={userPerms}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        handleLogout={handleLogout}
        navigate={navigate}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-4 sticky top-0 z-10 print:hidden">
          <button
            className="lg:hidden text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>

          <div className="flex-1" />

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* User dropdown */}
          <div className="relative flex items-center gap-2" ref={userMenuRef}>
            {/* Avatar — direct link to profile */}
            <button
              onClick={() => navigate('/profile')}
              className="cursor-pointer shrink-0"
              title="Go to Profile"
              aria-label="Go to Profile"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400 font-semibold text-sm hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-600 transition-shadow">
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
            </button>
            {/* Name + chevron — dropdown toggle */}
            <button
              className="flex items-center gap-1 text-sm text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 cursor-pointer"
              onClick={() => setUserMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              aria-label="User menu"
            >
              <span className="hidden sm:block font-medium">{user?.name}</span>
              <ChevronDown size={16} />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50">
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                  onClick={() => { navigate('/profile'); setUserMenuOpen(false) }}
                >
                  Profile
                </button>
                <hr className="my-1 border-gray-100 dark:border-slate-700" />
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:h-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

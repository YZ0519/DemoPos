import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import rolesApi from '../../api/roles'
import permissionsApi from '../../api/permissions'
import { useAuth } from '../../context/AuthContext'

const ADMIN_ROLE_ID = '1'

/** Groups that define how permissions are laid out on the page. */
const PERMISSION_GROUPS = [
  { label: 'Dashboard',   permissions: ['dashboard_view'] },
  { label: 'Customers',   permissions: ['customer_view', 'customer_create', 'customer_update', 'customer_delete', 'customer_sales'] },
  { label: 'Suppliers',   permissions: ['supplier_view', 'supplier_create', 'supplier_update', 'supplier_delete'] },
  { label: 'Products',    permissions: ['product_view', 'product_create', 'product_update', 'product_delete', 'product_import'] },
  { label: 'Brands',      permissions: ['brand_view', 'brand_create', 'brand_update', 'brand_delete'] },
  { label: 'Categories',  permissions: ['category_view', 'category_create', 'category_update', 'category_delete'] },
  { label: 'Units',       permissions: ['unit_view', 'unit_create', 'unit_update', 'unit_delete'] },
  { label: 'Sales',       permissions: ['sale_view', 'sale_create', 'sale_update', 'sale_delete'] },
  { label: 'Purchases',   permissions: ['purchase_view', 'purchase_create', 'purchase_update', 'purchase_delete'] },
  { label: 'Reports',     permissions: ['reports_summary', 'reports_sales', 'reports_inventory', 'reports_purchases'] },
  { label: 'Currency',    permissions: ['currency_view', 'currency_create', 'currency_update', 'currency_delete', 'currency_set_default'] },
  { label: 'Roles',       permissions: ['role_view', 'role_create', 'role_update', 'role_delete'] },
  { label: 'Permissions', permissions: ['permission_view'] },
  { label: 'Users',       permissions: ['user_view', 'user_create', 'user_update', 'user_delete', 'user_suspend'] },
  { label: 'Payment Methods', permissions: ['payment_method_view', 'payment_method_create', 'payment_method_update', 'payment_method_delete'] },
  { label: 'Settings',        permissions: ['website_settings', 'contact_settings', 'invoice_settings'] },
  { label: 'Product Bundles', permissions: ['product_bundle_view', 'product_bundle_create', 'product_bundle_update', 'product_bundle_delete'] },
  { label: 'Assembly',        permissions: ['assembly_view', 'assembly_create', 'assembly_update', 'assembly_delete'] },
  { label: 'Tables',          permissions: ['table_view', 'table_create', 'table_update', 'table_delete'] },
  { label: 'Modifiers',       permissions: ['modifier_view'] },
  { label: 'Vouchers',        permissions: ['voucher_view', 'voucher_create', 'voucher_update', 'voucher_delete'] },
]

/** Converts a snake_case slug into a Title Case display name. */
function toDisplayName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function RolePermissions() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [roleName, setRoleName] = useState('')
  const [allPermissions, setAllPermissions] = useState([])
  const [selectedPermissions, setSelectedPermissions] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const perms     = user?.permissions ?? []
  const canView   = perms.includes('role_view')
  const canUpdate = perms.includes('role_update')
  const isAdmin   = id === ADMIN_ROLE_ID

  useEffect(() => {
    if (!canView) return
    setLoading(true)
    Promise.all([
      permissionsApi.getAll(),
      rolesApi.getPermissions(id),
      rolesApi.getAll(),
    ])
      .then(([permRes, rolePermRes, rolesRes]) => {
        setAllPermissions(permRes.data?.data ?? [])
        setSelectedPermissions(new Set(rolePermRes.data?.data ?? []))
        // Resolve role name from the roles list
        const rolesList = rolesRes.data?.data ?? []
        const found = rolesList.find((r) => String(r.id) === String(id))
        setRoleName(found?.name ?? `Role #${id}`)
      })
      .catch(() => {
        toast.error('Failed to load permissions data')
      })
      .finally(() => setLoading(false))
  }, [id, canView])

  function togglePermission(permName) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(permName)) {
        next.delete(permName)
      } else {
        next.add(permName)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await rolesApi.syncPermissions(id, [...selectedPermissions])
      toast.success('Permissions updated successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  // Build a Set of all known permission slugs for fast lookup
  const allPermissionNames = new Set(allPermissions.map((p) => p.name))

  // ── Access guard ───────────────────────────────────────────────────────────

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/roles')}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            aria-label="Back to Roles"
          >
            <ArrowLeft size={16} />
            Back to Roles
          </button>
          <span className="text-gray-300 select-none">/</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {loading ? 'Loading...' : `${roleName} — Permissions`}
          </h1>
        </div>

        {/* Save button — hidden for Admin role; requires role_update */}
        {!isAdmin && canUpdate && (
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Save size={15} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24" role="status" aria-label="Loading permissions">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          {/* Admin notice */}
          {isAdmin && (
            <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
              The Admin role always has all permissions and cannot be restricted.
            </div>
          )}

          {/* Permission groups */}
          <div className="space-y-6">
            {PERMISSION_GROUPS.map((group) => {
              // Only render permissions that exist in the backend response
              const groupPerms = group.permissions.filter((p) => allPermissionNames.has(p))
              if (groupPerms.length === 0) return null

              return (
                <div key={group.label}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100 dark:border-slate-700">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {groupPerms.map((permName) => {
                      const checked = isAdmin || selectedPermissions.has(permName)
                      return (
                        <label
                          key={permName}
                          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg cursor-pointer select-none transition-colors ${
                            isAdmin
                              ? 'opacity-60 cursor-not-allowed'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isAdmin}
                            onChange={() => !isAdmin && togglePermission(permName)}
                            className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer disabled:cursor-not-allowed"
                            aria-label={toDisplayName(permName)}
                          />
                          <span className="text-gray-700">{toDisplayName(permName)}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom save button (convenience for long pages) */}
          {!isAdmin && canUpdate && (
            <div className="mt-8 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Save size={15} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

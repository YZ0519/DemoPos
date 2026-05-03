import { useState, useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import permissionsApi from '../../api/permissions'
import { useAuth } from '../../context/AuthContext'

/** Converts a snake_case slug into a Title Case display name. */
function toDisplayName(name) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function Permissions() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const hasAccess = (user?.permissions ?? []).includes('permission_view')

  useEffect(() => {
    if (!hasAccess) return
    setLoading(true)
    permissionsApi.getAll()
      .then((res) => setPermissions(res.data?.data ?? []))
      .catch(() => setPermissions([]))
      .finally(() => setLoading(false))
  }, [hasAccess])

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return permissions
    return permissions.filter((p) => p.name.toLowerCase().includes(q))
  }, [permissions, filter])

  if (!hasAccess) {
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Permissions</h1>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {/* Filter row */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter permissions..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              aria-label="Filter permissions"
            />
          </div>
          {!loading && (
            <span className="text-sm text-gray-500 dark:text-slate-400">
              Showing {filtered.length} permission{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label="Loading permissions">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
          {/* ── Desktop table (sm and above) ──────────────────────────────────── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" aria-label="Permissions table">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Permission Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Display Name</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No permissions found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((perm, index) => (
                    <tr key={perm.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-mono text-xs">{perm.name}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{toDisplayName(perm.name)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards (sm and below) ─────────────────────────────────────── */}
          {/* Replicate this pattern on other list pages. */}
          <div className="sm:hidden">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No permissions found.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((perm) => (
                  <div
                    key={perm.id}
                    className="border border-gray-100 dark:border-slate-700 rounded-xl px-4 py-3 bg-gray-50/50 dark:bg-slate-700/30 flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-gray-700 dark:text-slate-300">{toDisplayName(perm.name)}</span>
                    <span className="text-xs font-mono text-gray-400 dark:text-slate-500 shrink-0">{perm.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  )
}

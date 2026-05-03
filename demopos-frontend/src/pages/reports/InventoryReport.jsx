import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { getInventoryReport } from '../../api/reports'

export default function InventoryReport() {
  const { user } = useAuth()
  const perms   = user?.permissions ?? []
  const canView = perms.includes('reports_inventory')

  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    if (!canView) return

    let cancelled = false
    setLoading(true)

    getInventoryReport()
      .then((res) => {
        if (cancelled) return
        setItems(res.data?.data ?? [])
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load inventory report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canView])

  // Client-side filter — searches by product name or SKU (case-insensitive)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (item) =>
        item.name?.toLowerCase().includes(q) ||
        item.sku?.toLowerCase().includes(q)
    )
  }, [items, search])

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Inventory Report</h1>

      {/* Search bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-60">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
              {filtered.length} product{filtered.length !== 1 ? 's' : ''} found
              {search ? ` matching "${search}"` : ''}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">SKU</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Price</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                        {search ? 'No products match your search.' : 'No inventory data available.'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, idx) => (
                      <tr key={item.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{idx + 1}</td>
                        <td className="py-3 px-4 text-gray-900 dark:text-slate-100 font-medium">{item.name}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 font-mono text-xs">{item.sku || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          {item.hasDiscount ? (
                            <span className="flex flex-col items-end">
                              <span className="text-gray-900 dark:text-slate-100 font-semibold">
                                {Number(item.discountedPrice ?? 0).toFixed(2)}
                              </span>
                              <span className="text-gray-400 dark:text-slate-500 text-xs line-through">
                                {Number(item.price ?? 0).toFixed(2)}
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-700 dark:text-slate-300">
                              {Number(item.price ?? 0).toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-medium ${
                              item.quantity <= 0
                                ? 'text-red-500'
                                : item.quantity <= 5
                                ? 'text-yellow-600'
                                : 'text-gray-700 dark:text-slate-300'
                            }`}
                          >
                            {item.quantity}
                          </span>
                          {item.unitShortName && (
                            <span className="text-gray-400 dark:text-slate-500 text-xs ml-1">{item.unitShortName}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

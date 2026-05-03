import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Eye, Trash2, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPurchases, deletePurchase } from '../../api/purchases'
import { getAllSuppliers } from '../../api/suppliers'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/utils/currency'
import { formatDate } from '../../lib/utils/dates'
import usePageTitle from '../../hooks/usePageTitle'

const PAGE_SIZE = 15

const emptyFilters = { search: '', supplierId: '', dateFrom: '', dateTo: '' }

export default function Purchases() {
  usePageTitle('Purchases')
  const { user } = useAuth()
  const { symbol, precision } = useCurrency()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('purchase_view')
  const canCreate = perms.includes('purchase_create')
  const canUpdate = perms.includes('purchase_update')
  const canDelete = perms.includes('purchase_delete')

  const navigate = useNavigate()

  const [purchases, setPurchases]               = useState([])
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [loading, setLoading]                   = useState(true)
  const [filters, setFilters]                   = useState(emptyFilters)
  const [debouncedSearch, setDebouncedSearch]   = useState('')
  const [page, setPage]                         = useState(1)
  const [totalPages, setTotalPages]             = useState(1)
  const [suppliers, setSuppliers]               = useState([])

  // Debounce search input 400ms
  const debounceRef = useRef(null)

  function handleSearchChange(val) {
    setFilters((f) => ({ ...f, search: val }))
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 400)
  }

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  // Load suppliers once on mount for the dropdown
  useEffect(() => {
    getAllSuppliers()
      .then((res) => {
        const d = res.data?.data
        setSuppliers(Array.isArray(d) ? d : (d?.items ?? []))
      })
      .catch(() => {
        // Non-critical — dropdown just won't populate
      })
  }, [])

  // Fetch purchases whenever filters or page change
  useEffect(() => {
    if (!canView) return

    let cancelled = false
    setLoading(true)

    getPurchases({
      search:     debouncedSearch,
      supplierId: filters.supplierId,
      dateFrom:   filters.dateFrom,
      dateTo:     filters.dateTo,
      page,
      pageSize:   PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data
        if (Array.isArray(d)) {
          setPurchases(d)
          setTotalPages(1)
        } else {
          setPurchases(d?.items ?? [])
          setTotalPages(Math.ceil((d?.totalCount ?? 0) / PAGE_SIZE) || 1)
        }
      })
      .catch(() => {
        if (cancelled) return
        setPurchases([])
        toast.error('Failed to load purchases')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canView, debouncedSearch, filters.supplierId, filters.dateFrom, filters.dateTo, page])

  function handleFilterChange(key, val) {
    setFilters((f) => ({ ...f, [key]: val }))
    setPage(1)
  }

  function handleReset() {
    setFilters(emptyFilters)
    setDebouncedSearch('')
    setPage(1)
  }

  async function handleDelete(id) {
    try {
      await deletePurchase(id)
      setPurchases((prev) => prev.filter((p) => p.id !== id))
      toast.success('Purchase deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete purchase')
    } finally {
      setConfirmingDeleteId(null)
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Purchases</h1>
        {canCreate && (
          <button
            onClick={() => navigate('/purchases/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            + New Purchase
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Purchase ID or supplier name..."
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          {/* Supplier */}
          <div className="w-48">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Supplier</label>
            <select
              value={filters.supplierId}
              onChange={(e) => handleFilterChange('supplierId', e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          {/* Date To */}
          <div className="w-40">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Reset
          </button>
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
            {/* ── Desktop table (sm and above) ──────────────────────────────────── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Purchase ID</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Supplier</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Grand Total</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Payment</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                        No purchases found.
                      </td>
                    </tr>
                  ) : (
                    purchases.map((purchase, index) => (
                      <tr key={purchase.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                          #{purchase.id}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {purchase.supplierName ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300">
                          {formatCurrency(purchase.grandTotal ?? 0, symbol, precision)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {purchase.paymentMethodName ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">
                          {formatDate(purchase.date || purchase.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {canView && (
                              <button
                                onClick={() => navigate(`/purchases/${purchase.id}/products`)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                aria-label={`View products for purchase #${purchase.id}`}
                              >
                                <Eye size={13} />
                                View
                              </button>
                            )}
                            {canUpdate && (
                              <button
                                onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                aria-label={`Edit purchase #${purchase.id}`}
                              >
                                <Pencil size={13} />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              confirmingDeleteId === purchase.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button onClick={() => handleDelete(purchase.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                  <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(purchase.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  aria-label={`Delete purchase #${purchase.id}`}
                                >
                                  <Trash2 size={13} />
                                  Delete
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards (sm and below) ─────────────────────────────────────── */}
            {/* Replicate this pattern on other list pages. */}
            <div className="sm:hidden">
              {purchases.length === 0 ? (
                <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No purchases found.</p>
              ) : (
                <div className="space-y-3">
                  {purchases.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: purchase ID + supplier + View button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                            #{purchase.id}
                          </span>
                          <span className="ml-2 text-sm text-gray-500 dark:text-slate-400">
                            {purchase.supplierName ?? '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canView && (
                            <button
                              onClick={() => navigate(`/purchases/${purchase.id}/products`)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`View products for purchase #${purchase.id}`}
                            >
                              <Eye size={12} />
                              View
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Detail rows */}
                      <div className="mt-2.5 space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Grand Total</span>
                          <span className="text-gray-700 dark:text-slate-300 font-medium">{formatCurrency(purchase.grandTotal ?? 0, symbol, precision)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Payment</span>
                          <span className="text-gray-600 dark:text-slate-400">{purchase.paymentMethodName ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                          <Calendar size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                          <span>{formatDate(purchase.date || purchase.createdAt)}</span>
                        </div>
                      </div>

                      {/* Bottom row: Edit + Delete actions */}
                      {(canUpdate || canDelete) && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex items-center justify-end gap-1.5">
                          {canUpdate && (
                            <button
                              onClick={() => navigate(`/purchases/${purchase.id}/edit`)}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Edit purchase #${purchase.id}`}
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === purchase.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(purchase.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(purchase.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                aria-label={`Delete purchase #${purchase.id}`}
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

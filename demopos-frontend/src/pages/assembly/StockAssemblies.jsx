import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAssemblies, deleteAssembly } from '../../api/assembly'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils/dates'

const PAGE_SIZE = 15

function TypeBadge({ type }) {
  if (type === 'split') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
        Split
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
      Production
    </span>
  )
}

function TriggerBadge({ triggeredBy }) {
  if (triggeredBy === 'purchase') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
        Purchase
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
      Manual
    </span>
  )
}

const emptyFilters = { dateFrom: '', dateTo: '', type: '' }

export default function StockAssemblies() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('assembly_view')
  const canCreate = perms.includes('assembly_create')
  const canDelete = perms.includes('assembly_delete')

  const [assemblies, setAssemblies]                 = useState([])
  const [loading, setLoading]                       = useState(true)
  const [filters, setFilters]                       = useState(emptyFilters)
  const [page, setPage]                             = useState(1)
  const [totalPages, setTotalPages]                 = useState(1)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [refreshKey, setRefreshKey]                 = useState(0)

  useEffect(() => {
    if (!canView) return

    let cancelled = false
    setLoading(true)

    getAssemblies({
      dateFrom: filters.dateFrom,
      dateTo:   filters.dateTo,
      type:     filters.type,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data
        if (Array.isArray(d)) {
          setAssemblies(d)
          setTotalPages(1)
        } else {
          setAssemblies(d?.items ?? [])
          setTotalPages(Math.ceil((d?.totalCount ?? 0) / PAGE_SIZE) || 1)
        }
      })
      .catch(() => {
        if (cancelled) return
        setAssemblies([])
        toast.error('Failed to load stock assemblies')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canView, filters.dateFrom, filters.dateTo, filters.type, page, refreshKey])

  function handleFilterChange(key, val) {
    setFilters((f) => ({ ...f, [key]: val }))
    setPage(1)
  }

  function handleReset() {
    setFilters(emptyFilters)
    setPage(1)
  }

  async function handleDelete(id) {
    try {
      await deleteAssembly(id)
      toast.success('Assembly reversed and deleted')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete assembly')
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Stock Assemblies</h1>
        {canCreate && (
          <button
            onClick={() => navigate('/stock-assemblies/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={15} />
            New Assembly
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {/* Type filter */}
          <div className="w-full sm:w-44">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Type</label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">All Types</option>
              <option value="split">Split</option>
              <option value="production">Production</option>
            </select>
          </div>

          {/* Date From */}
          <div className="w-[calc(50%-0.375rem)] sm:w-40">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          {/* Date To */}
          <div className="w-[calc(50%-0.375rem)] sm:w-40">
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

      {/* Table */}
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
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Template</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Output Product</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Output Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Cost/Unit</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Triggered By</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">User</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assemblies.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                        No assembly records found.
                      </td>
                    </tr>
                  ) : (
                    assemblies.map((asm, index) => (
                      <tr key={asm.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">
                          {(page - 1) * PAGE_SIZE + index + 1}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {formatDate(asm.assembledAt)}
                        </td>
                        <td className="py-3 px-4">
                          <TypeBadge type={asm.assemblyType} />
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 text-xs">
                          {asm.templateName ?? <span className="text-gray-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                          {asm.outputProductName}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {Number(asm.outputQuantity ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {Number(asm.outputCostPerUnit ?? 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <TriggerBadge triggeredBy={asm.triggeredBy} />
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 text-xs">
                          {asm.userName ?? '—'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/stock-assemblies/${asm.id}`)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`View assembly #${asm.id}`}
                            >
                              <Eye size={13} />
                              View
                            </button>
                            {canDelete && (
                              confirmingDeleteId === asm.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400 text-xs">Reverse?</span>
                                  <button
                                    onClick={() => handleDelete(asm.id)}
                                    className="text-red-600 font-medium hover:underline cursor-pointer text-xs"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer text-xs"
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(asm.id)}
                                  className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  aria-label={`Delete assembly #${asm.id}`}
                                >
                                  <Trash2 size={13} />
                                  Reverse
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
            <div className="sm:hidden">
              {assemblies.length === 0 ? (
                <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No assembly records found.</p>
              ) : (
                <div className="space-y-3">
                  {assemblies.map((asm) => (
                    <div
                      key={asm.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: output product + badges + View button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{asm.outputProductName}</span>
                            <TypeBadge type={asm.assemblyType} />
                            <TriggerBadge triggeredBy={asm.triggeredBy} />
                          </div>
                          {asm.templateName && (
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Template: {asm.templateName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => navigate(`/stock-assemblies/${asm.id}`)}
                            className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            aria-label={`View assembly #${asm.id}`}
                          >
                            <Eye size={12} />
                            View
                          </button>
                        </div>
                      </div>

                      {/* Detail rows */}
                      <div className="mt-2.5 space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Date</span>
                          <span className="text-gray-600 dark:text-slate-400">{formatDate(asm.assembledAt)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Output Qty</span>
                          <span className="text-gray-700 dark:text-slate-300 font-medium">{Number(asm.outputQuantity ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Cost/Unit</span>
                          <span className="text-gray-600 dark:text-slate-400">{Number(asm.outputCostPerUnit ?? 0).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">User</span>
                          <span className="text-gray-500 dark:text-slate-400 text-xs">{asm.userName ?? '—'}</span>
                        </div>
                      </div>

                      {/* Bottom row: Reverse action */}
                      {canDelete && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                          {confirmingDeleteId === asm.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 dark:text-slate-400 text-xs">Reverse?</span>
                              <button onClick={() => handleDelete(asm.id)} className="text-red-600 font-medium hover:underline cursor-pointer text-xs">Yes</button>
                              <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer text-xs">No</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(asm.id)}
                              className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Reverse assembly #${asm.id}`}
                            >
                              <Trash2 size={12} />
                              Reverse
                            </button>
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
                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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

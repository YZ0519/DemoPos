import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAssemblyById, deleteAssembly } from '../../api/assembly'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils/dates'

// ─── Badge helpers ───────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  if (type === 'split') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
        Split
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
      Production
    </span>
  )
}

function TriggerBadge({ triggeredBy }) {
  if (triggeredBy === 'purchase') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
        Auto (Purchase)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
      Manual
    </span>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StockAssemblyDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('assembly_view')
  const canDelete = perms.includes('assembly_delete')

  const [assembly, setAssembly]             = useState(null)
  const [loading, setLoading]               = useState(true)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [deleting, setDeleting]             = useState(false)

  useEffect(() => {
    if (!canView || !id) return

    let cancelled = false
    setLoading(true)

    getAssemblyById(id)
      .then((res) => {
        if (!cancelled) setAssembly(res.data?.data ?? null)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load assembly details')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canView, id])

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteAssembly(id)
      toast.success('Assembly reversed and deleted')
      navigate('/stock-assemblies')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to reverse assembly')
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  // ─── Access denied ────────────────────────────────────────────────────────

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

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Not found ────────────────────────────────────────────────────────────

  if (!assembly) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Assembly Not Found</p>
          <button
            onClick={() => navigate('/stock-assemblies')}
            className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            Back to list
          </button>
        </div>
      </div>
    )
  }

  // ─── Compute totals ───────────────────────────────────────────────────────

  const ingredientItems = assembly.items ?? []
  const totalInputCost = ingredientItems.reduce((sum, item) => sum + (item.lineCost ?? 0), 0)
  const totalOutputValue = Number(assembly.outputQuantity ?? 0) * Number(assembly.outputCostPerUnit ?? 0)

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/stock-assemblies')}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back to stock assemblies"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Assembly #{assembly.id}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw size={15} />
              <span className="hidden sm:inline">Reverse Assembly</span>
              <span className="sm:hidden">Reverse</span>
            </button>
          )}
        </div>
      </div>

      {/* Reverse confirmation banner */}
      {confirmDelete && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 mb-1">Reverse this assembly?</p>
              <p className="text-sm text-red-700">
                Deleting this assembly will fully reverse all stock changes: ingredient stock will be restored and output product stock will be reduced by {Number(assembly.outputQuantity).toFixed(2)} units. This cannot be undone.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  {deleting ? 'Reversing...' : 'Yes, Reverse Assembly'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-4 py-2 rounded-xl border border-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two-card grid: Assembly Information (left) + Output Summary (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Assembly Information card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Assembly Information</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Assembly ID</dt>
              <dd className="text-gray-800 font-medium mt-0.5">#{assembly.id}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Type</dt>
              <dd className="mt-0.5"><TypeBadge type={assembly.assemblyType} /></dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Triggered By</dt>
              <dd className="mt-0.5"><TriggerBadge triggeredBy={assembly.triggeredBy} /></dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Template</dt>
              <dd className="text-gray-800 font-medium mt-0.5">
                {assembly.templateName ?? <span className="text-gray-400 font-normal">Ad-hoc (no template)</span>}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Created By</dt>
              <dd className="text-gray-800 font-medium mt-0.5">{assembly.userName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Assembled Date</dt>
              <dd className="text-gray-800 mt-0.5">
                {formatDate(assembly.assembledAt)}{' '}
                {new Date(assembly.assembledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </dd>
            </div>
            {assembly.note && (
              <div className="col-span-2">
                <dt className="text-gray-400 text-xs uppercase tracking-wide">Notes</dt>
                <dd className="text-gray-800 font-medium mt-0.5">{assembly.note}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Output Summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Output Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Output Product</span>
              <span className="font-medium text-gray-800 text-right max-w-[55%] truncate">{assembly.outputProductName}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Output Qty</span>
              <span>{Number(assembly.outputQuantity).toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-100 dark:border-slate-700">
              <span>Cost / Unit</span>
              <span className="text-blue-600 font-bold">{Number(assembly.outputCostPerUnit).toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total Value</span>
              <span>{totalOutputValue.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Ingredients Used</h2>
        {/* ── Desktop table (sm and above) ──────────────────────────────────── */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Qty Used</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Waste</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Total Deducted</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Unit Cost (at time)</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Line Cost</th>
              </tr>
            </thead>
            <tbody>
              {ingredientItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No ingredient data.</td>
                </tr>
              ) : (
                ingredientItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{item.productName}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{Number(item.quantityUsed).toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-slate-400">
                      {Number(item.wasteQuantity) > 0 ? (
                        <span className="text-yellow-700">{Number(item.wasteQuantity).toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300">
                      {Number(item.totalDeducted ?? (item.quantityUsed + item.wasteQuantity)).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{Number(item.unitCostAtTime).toFixed(4)}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{Number(item.lineCost).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile cards (sm and below) ─────────────────────────────────────── */}
        <div className="sm:hidden">
          {ingredientItems.length === 0 ? (
            <p className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No ingredient data.</p>
          ) : (
            <div className="space-y-3">
              {ingredientItems.map((item, index) => (
                <div
                  key={item.id}
                  className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                >
                  {/* Product name header */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{item.productName}</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">#{index + 1}</span>
                  </div>

                  {/* Detail rows */}
                  <div className="mt-2 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Qty Used</span>
                      <span className="text-gray-600 dark:text-slate-400">{Number(item.quantityUsed).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Waste</span>
                      <span>
                        {Number(item.wasteQuantity) > 0 ? (
                          <span className="text-yellow-700 dark:text-yellow-400">{Number(item.wasteQuantity).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-300 dark:text-slate-600">—</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Total Deducted</span>
                      <span className="text-gray-700 dark:text-slate-300">{Number(item.totalDeducted ?? (item.quantityUsed + item.wasteQuantity)).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-slate-400">Unit Cost</span>
                      <span className="text-gray-500 dark:text-slate-400">{Number(item.unitCostAtTime).toFixed(4)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-600">
                      <span className="text-gray-700 dark:text-slate-300 font-medium">Line Cost</span>
                      <span className="text-gray-700 dark:text-slate-300 font-medium">{Number(item.lineCost).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost summary */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 space-y-1.5 text-sm sm:max-w-sm sm:ml-auto">
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Total Input Cost</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200">{totalInputCost.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Output Quantity</span>
            <span className="font-semibold text-gray-800 dark:text-slate-200">{Number(assembly.outputQuantity).toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
            <span className="text-gray-700 font-medium">Computed Cost/Unit</span>
            <span className="text-blue-700 font-bold text-base">{Number(assembly.outputCostPerUnit).toFixed(4)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

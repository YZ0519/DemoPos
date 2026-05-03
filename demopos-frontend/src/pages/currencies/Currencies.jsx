import { useState, useEffect } from 'react'
import { Plus, Edit2, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import * as currenciesApi from '../../api/currencies'
import { useAuth } from '../../context/AuthContext'

const emptyForm = { name: '', code: '', symbol: '' }

export default function Currencies() {
  const { user } = useAuth()
  const perms = user?.permissions ?? []

  const canView      = perms.includes('currency_view')
  const canCreate    = perms.includes('currency_create')
  const canUpdate    = perms.includes('currency_update')
  const canDelete    = perms.includes('currency_delete')
  const canSetDefault = perms.includes('currency_set_default')

  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!canView) return
    fetchCurrencies()
  }, [canView])

  function fetchCurrencies() {
    setLoading(true)
    currenciesApi.getAll()
      .then((res) => setCurrencies(res.data?.data ?? []))
      .catch(() => setCurrencies([]))
      .finally(() => setLoading(false))
  }

  function openCreateModal() {
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(item) {
    setEditingItem(item)
    setFormData({ name: item.name, code: item.code, symbol: item.symbol })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!formData.code.trim()) {
      setFormError('Code is required.')
      return
    }
    if (!formData.symbol.trim()) {
      setFormError('Symbol is required.')
      return
    }

    setSubmitting(true)
    setFormError('')

    const payload = {
      name:   formData.name.trim(),
      code:   formData.code.trim().toUpperCase(),
      symbol: formData.symbol.trim(),
    }

    try {
      if (editingItem) {
        const res = await currenciesApi.update(editingItem.id, payload)
        const updated = res.data?.data
        setCurrencies((prev) => prev.map((c) => (c.id === editingItem.id ? updated : c)))
        toast.success('Currency updated successfully')
      } else {
        const res = await currenciesApi.create(payload)
        const created = res.data?.data
        setCurrencies((prev) => [created, ...prev])
        toast.success('Currency created successfully')
      }
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await currenciesApi.remove(id)
      setCurrencies((prev) => prev.filter((c) => c.id !== id))
      toast.success('Currency deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete currency')
    } finally {
      setConfirmingDeleteId(null)
    }
  }

  async function handleSetDefault(id) {
    try {
      await currenciesApi.setDefault(id)
      // Mark the new default and clear the old one locally
      setCurrencies((prev) =>
        prev.map((c) => ({ ...c, active: c.id === id }))
      )
      toast.success('Default currency updated')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to set default currency')
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Currency Management</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Currency
          </button>
        )}
      </div>

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
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Code</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Symbol</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Default</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currencies.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No currencies found.
                    </td>
                  </tr>
                ) : (
                  currencies.map((currency, index) => (
                    <tr key={currency.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{currency.name}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-mono">{currency.code}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{currency.symbol}</td>
                      <td className="py-3 px-4">
                        {currency.active ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Default
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(currency)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={13} />
                              Edit
                            </button>
                          )}
                          {canSetDefault && !currency.active && (
                            <button
                              onClick={() => handleSetDefault(currency.id)}
                              className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Star size={13} />
                              Set Default
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === currency.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(currency.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(currency.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
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
            {currencies.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No currencies found.</p>
            ) : (
              <div className="space-y-3">
                {currencies.map((currency) => (
                  <div
                    key={currency.id}
                    className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                  >
                    {/* Top row: name + symbol + Edit button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{currency.name}</span>
                        {currency.active && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(currency)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detail rows */}
                    <div className="mt-2.5 space-y-1 text-sm text-gray-500 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Code</span>
                        <span className="text-gray-700 dark:text-slate-300 font-mono">{currency.code}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Symbol</span>
                        <span className="text-gray-700 dark:text-slate-300">{currency.symbol}</span>
                      </div>
                    </div>

                    {/* Bottom row: Set Default + Delete actions */}
                    {(canSetDefault || canDelete) && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex items-center justify-end gap-1.5">
                        {canSetDefault && !currency.active && (
                          <button
                            onClick={() => handleSetDefault(currency.id)}
                            className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Star size={12} />
                            Set Default
                          </button>
                        )}
                        {canDelete && (
                          confirmingDeleteId === currency.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                              <button onClick={() => handleDelete(currency.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                              <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(currency.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
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
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0 z-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingItem ? 'Edit Currency' : 'Add Currency'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. US Dollar"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="USD"
                  maxLength={10}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Symbol</label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) => setFormData((f) => ({ ...f, symbol: e.target.value }))}
                  placeholder="$"
                  maxLength={10}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

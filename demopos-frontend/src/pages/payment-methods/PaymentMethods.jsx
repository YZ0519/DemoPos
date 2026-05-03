import { useState, useEffect } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import paymentMethodsApi from '../../api/payment-methods'
import { useAuth } from '../../context/AuthContext'

const emptyForm = { name: '', sortOrder: 0, isDefault: false, isActive: true, autoFillAmount: false, zeroTotal: false }

export default function PaymentMethods() {
  const { user } = useAuth()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('payment_method_view')
  const canCreate = perms.includes('payment_method_create')
  const canUpdate = perms.includes('payment_method_update')
  const canDelete = perms.includes('payment_method_delete')

  const [methods, setMethods]                   = useState([])
  const [loading, setLoading]                   = useState(true)
  const [submitting, setSubmitting]             = useState(false)
  const [modalOpen, setModalOpen]               = useState(false)
  const [editingItem, setEditingItem]           = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData]                 = useState(emptyForm)
  const [formError, setFormError]               = useState('')

  useEffect(() => {
    if (!canView) return
    fetchPaymentMethods()
  }, [canView])

  function fetchPaymentMethods() {
    setLoading(true)
    paymentMethodsApi.getAll()
      .then((res) => setMethods(res.data?.data ?? []))
      .catch(() => setMethods([]))
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
    setFormData({
      name:           item.name,
      sortOrder:      item.sortOrder ?? 0,
      isDefault:      item.isDefault ?? false,
      isActive:       item.isActive ?? true,
      autoFillAmount: item.autoFillAmount ?? false,
      zeroTotal:      item.zeroTotal ?? false,
    })
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
      setFormError('Payment method name is required.')
      return
    }
    setSubmitting(true)
    setFormError('')

    const payload = {
      name:           formData.name.trim(),
      sortOrder:      Number(formData.sortOrder) || 0,
      isDefault:      formData.isDefault,
      isActive:       formData.isActive,
      autoFillAmount: formData.autoFillAmount ?? false,
      zeroTotal:      formData.zeroTotal ?? false,
    }

    try {
      if (editingItem) {
        const res = await paymentMethodsApi.update(editingItem.id, payload)
        const updated = res.data?.data
        setMethods((prev) => prev.map((m) => (m.id === editingItem.id ? updated : m)))
        toast.success('Payment method updated successfully')
      } else {
        const res = await paymentMethodsApi.create(payload)
        const created = res.data?.data
        setMethods((prev) => [created, ...prev])
        toast.success('Payment method created successfully')
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
      await paymentMethodsApi.remove(id)
      setMethods((prev) => prev.filter((m) => m.id !== id))
      toast.success('Payment method deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete payment method')
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Payment Methods</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Payment Method
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Default</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sort Order</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {methods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No payment methods found.</td>
                  </tr>
                ) : (
                  methods.map((method, index) => (
                    <tr key={method.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                        {method.name}
                        {method.zeroTotal && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ml-2">
                            Zero Total
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {method.isActive
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactive</span>
                        }
                      </td>
                      <td className="py-3 px-4">
                        {method.isDefault && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                            Default
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{method.sortOrder ?? 0}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(method)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={13} />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === method.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(method.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(method.id)}
                                className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
            {methods.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No payment methods found.</p>
            ) : (
              <div className="space-y-3">
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                  >
                    {/* Top row: name + badges + Edit button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{method.name}</span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {method.isActive
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactive</span>
                          }
                          {method.isDefault && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                              Default
                            </span>
                          )}
                          {method.zeroTotal && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                              Zero Total
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(method)}
                            className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bottom row: delete action */}
                    {canDelete && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                        {confirmingDeleteId === method.id ? (
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                            <button onClick={() => handleDelete(method.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                            <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(method.id)}
                            className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
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
              {editingItem ? 'Edit Payment Method' : 'Add Payment Method'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Payment method name"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sort Order</label>
                <input
                  type="number"
                  min="0"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData((f) => ({ ...f, sortOrder: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="pm-isDefault"
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={submitting}
                />
                <label htmlFor="pm-isDefault" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Is Default
                  <span className="ml-1 text-xs text-gray-400 dark:text-slate-500 font-normal">
                    (Selecting this will unset the current default.)
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="pm-isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={submitting}
                />
                <label htmlFor="pm-isActive" className="text-sm font-medium text-gray-700 dark:text-slate-300">Is Active</label>
              </div>

              <div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="autoFillAmount"
                    checked={formData.autoFillAmount ?? false}
                    onChange={e => setFormData(f => ({ ...f, autoFillAmount: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    disabled={submitting}
                  />
                  <label htmlFor="autoFillAmount" className="text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                    Auto-fill paid amount
                  </label>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 ml-6">
                  When enabled, selecting this method auto-fills the paid amount with the current due balance.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="zeroTotal"
                    checked={formData.zeroTotal ?? false}
                    onChange={e => setFormData(f => ({ ...f, zeroTotal: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    disabled={submitting}
                  />
                  <label htmlFor="zeroTotal" className="text-sm text-gray-700 dark:text-slate-300 cursor-pointer">
                    Zero total (Member)
                  </label>
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500 ml-6">
                  When enabled, selecting this method at POS zeroes out the entire bill.
                </p>
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={closeModal} disabled={submitting}
                  className="text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 px-4 py-2 rounded-xl transition-colors cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors cursor-pointer">
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

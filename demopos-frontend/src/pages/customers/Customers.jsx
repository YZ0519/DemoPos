import { useState, useEffect, useRef } from 'react'
import { Plus, Edit2, ShoppingBag, Search, Phone, MapPin, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../../api/customers'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils/dates'

const WALK_IN_CUSTOMER_ID = 1
const PAGE_SIZE = 15
const emptyForm = { name: '', phone: '', address: '' }

export default function Customers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('customer_view')
  const canCreate = perms.includes('customer_create')
  const canEdit   = perms.includes('customer_update')
  const canDelete = perms.includes('customer_delete')
  const canSales  = perms.includes('customer_sales')

  const [customers, setCustomers]         = useState([])
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [modalOpen, setModalOpen]         = useState(false)
  const [editingItem, setEditingItem]     = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData]           = useState(emptyForm)
  const [formError, setFormError]         = useState('')
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [search, setSearch]               = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [refreshKey, setRefreshKey]       = useState(0)
  const debounceRef = useRef(null)

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  function handleSearchChange(val) {
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 400)
  }

  useEffect(() => {
    if (!canView) return
    let cancelled = false
    setLoading(true)
    getCustomers(page, PAGE_SIZE, debouncedSearch)
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data
        if (Array.isArray(d)) {
          setCustomers(d)
          setTotalPages(1)
        } else {
          setCustomers(d?.items ?? [])
          setTotalPages(Math.ceil((d?.totalCount ?? 0) / PAGE_SIZE) || 1)
        }
      })
      .catch(() => {
        if (cancelled) return
        setCustomers([])
        toast.error('Failed to load customers')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [canView, page, debouncedSearch, refreshKey])

  function openCreateModal() {
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(item) {
    setEditingItem(item)
    setFormData({ name: item.name, phone: item.phone ?? '', address: item.address ?? '' })
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
      setFormError('Customer name is required.')
      return
    }
    setSubmitting(true)
    setFormError('')

    const payload = {
      name:    formData.name.trim(),
      phone:   formData.phone.trim(),
      address: formData.address.trim(),
    }

    try {
      if (editingItem) {
        const res = await updateCustomer(editingItem.id, payload)
        const updated = res.data?.data
        // Optimistic: update the row in current page without a full reload
        setCustomers((prev) => prev.map((c) => (c.id === editingItem.id ? updated : c)))
        toast.success('Customer updated successfully')
      } else {
        await createCustomer(payload)
        setPage(1)
        setDebouncedSearch('')
        setSearch('')
        setRefreshKey((k) => k + 1)
        toast.success('Customer created successfully')
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
      await deleteCustomer(id)
      // Remove from local list; re-fetch will correct pagination on next page change
      setCustomers((prev) => prev.filter((c) => c.id !== id))
      toast.success('Customer deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete customer')
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Customers</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Customer
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Phone</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Address</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Created At</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No customers found.</td>
                  </tr>
                ) : (
                  customers.map((customer, index) => {
                    const isProtected = customer.id === WALK_IN_CUSTOMER_ID
                    return (
                      <tr key={customer.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{(page - 1) * PAGE_SIZE + index + 1}</td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                          {customer.name}
                          {isProtected && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                              System
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{customer.phone || '—'}</td>
                        <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{customer.address || '—'}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">
                          {formatDate(customer.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {canSales && (
                              <button
                                onClick={() => navigate(`/customers/${customer.id}/sales`)}
                                className="bg-green-50 hover:bg-green-100 text-green-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <ShoppingBag size={13} />
                                Sales
                              </button>
                            )}
                            {canEdit && !isProtected && (
                              <button
                                onClick={() => openEditModal(customer)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 size={13} />
                                Edit
                              </button>
                            )}
                            {canDelete && !isProtected && (
                              confirmingDeleteId === customer.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button onClick={() => handleDelete(customer.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                  <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(customer.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile cards (below sm / < 640px) ─────────────────────────────── */}
          {/* Replaces the table with stacked cards. Replicate this pattern on     */}
          {/* other list pages. Each card shows key fields + action buttons.       */}
          <div className="sm:hidden">
            {customers.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No customers found.</p>
            ) : (
              <div className="space-y-3">
                {customers.map((customer) => {
                  const isProtected = customer.id === WALK_IN_CUSTOMER_ID
                  return (
                    <div
                      key={customer.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: name + action buttons */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                            {customer.name}
                          </span>
                          {isProtected && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-600 text-gray-500 dark:text-slate-400">
                              System
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canSales && (
                            <button
                              onClick={() => navigate(`/customers/${customer.id}/sales`)}
                              className="bg-green-50 hover:bg-green-100 text-green-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <ShoppingBag size={12} />
                              Sales
                            </button>
                          )}
                          {canEdit && !isProtected && (
                            <button
                              onClick={() => openEditModal(customer)}
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
                        <div className="flex items-center gap-2">
                          <Phone size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                          <span>{customer.phone || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                          <span className="truncate">{customer.address || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                          <span>{formatDate(customer.createdAt)}</span>
                        </div>
                      </div>

                      {/* Bottom row: delete action */}
                      {canDelete && !isProtected && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                          {confirmingDeleteId === customer.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                              <button onClick={() => handleDelete(customer.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                              <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(customer.id)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
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
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
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
              {editingItem ? 'Edit Customer' : 'Add Customer'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Customer name"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number (optional)"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address (optional)"
                  rows={2}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

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

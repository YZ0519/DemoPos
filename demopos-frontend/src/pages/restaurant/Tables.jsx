import { useState, useEffect } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTables, createTable, updateTable, deleteTable } from '../../api/tables'
import { useAuth } from '../../context/AuthContext'
import usePageTitle from '../../hooks/usePageTitle'

const emptyForm = {
  tableNumber: '',
  label:       '',
  capacity:    4,
  sortOrder:   0,
  isActive:    true,
}

/** Status badge for table occupancy status */
function StatusBadge({ status }) {
  if (status === 'Occupied') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Occupied
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
      Available
    </span>
  )
}

/** Active / Inactive badge */
function ActiveBadge({ isActive }) {
  return isActive ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400">
      Inactive
    </span>
  )
}

export default function Tables() {
  usePageTitle('Tables')

  const { user }  = useAuth()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('table_view')
  const canCreate = perms.includes('table_create')
  const canUpdate = perms.includes('table_update')
  const canDelete = perms.includes('table_delete')

  const [tables, setTables]                     = useState([])
  const [loading, setLoading]                   = useState(true)
  const [submitting, setSubmitting]             = useState(false)
  const [modalOpen, setModalOpen]               = useState(false)
  const [editingItem, setEditingItem]           = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData]                 = useState(emptyForm)
  const [formError, setFormError]               = useState('')

  useEffect(() => {
    if (!canView) return
    fetchTables()
  }, [canView]) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchTables() {
    setLoading(true)
    getTables()
      .then((res) => setTables(res.data?.data ?? []))
      .catch(() => setTables([]))
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
      tableNumber: item.number ?? '',
      label:       item.label       ?? '',
      capacity:    item.capacity    ?? 4,
      sortOrder:   item.sortOrder   ?? 0,
      isActive:    item.isActive    ?? true,
    })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormError('')
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!formData.tableNumber) {
      setFormError('Table Number is required.')
      return
    }

    const payload = {
      number:    Number(formData.tableNumber),
      label:     formData.label.trim() || null,
      capacity:  Number(formData.capacity) || 1,
      sortOrder: Number(formData.sortOrder) || 0,
      isActive:  formData.isActive,
    }

    setSubmitting(true)
    try {
      if (editingItem) {
        await updateTable(editingItem.id, payload)
        toast.success('Table updated successfully')
      } else {
        await createTable(payload)
        toast.success('Table created successfully')
      }
      closeModal()
      fetchTables()
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Something went wrong'
      setFormError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTable(id)
      toast.success('Table deleted')
      setConfirmingDeleteId(null)
      fetchTables()
    } catch (err) {
      const status = err.response?.status
      if (status === 409) {
        toast.error('This table is occupied or has sales records. Deactivate it instead.')
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to delete table')
      }
      setConfirmingDeleteId(null)
    }
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to view tables.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Tables</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Table
          </button>
        )}
      </div>

      {/* Table list */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              {tables.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 dark:text-slate-500 text-sm">
                  No tables found. Add your first table.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Number</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Label</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Capacity</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sort</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Active</th>
                      <th className="py-3 px-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map((table, index) => (
                      <tr key={table.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-semibold">
                          T{table.number}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {table.label || <span className="text-gray-300 dark:text-slate-600">{'\u2014'}</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {table.capacity} seats
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={table.status} />
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{table.sortOrder ?? 0}</td>
                        <td className="py-3 px-4">
                          <ActiveBadge isActive={table.isActive} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 justify-end">
                            {canUpdate && (
                              <button
                                onClick={() => openEditModal(table)}
                                className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                                aria-label={`Edit table T${table.number}`}
                              >
                                <Edit2 size={13} />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              confirmingDeleteId === table.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button
                                    onClick={() => handleDelete(table.id)}
                                    className="text-red-600 font-medium hover:underline cursor-pointer"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    onClick={() => setConfirmingDeleteId(null)}
                                    className="text-gray-500 hover:underline cursor-pointer"
                                  >
                                    No
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(table.id)}
                                  className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  aria-label={`Delete table T${table.number}`}
                                >
                                  Delete
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden p-4">
              {tables.length === 0 ? (
                <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No tables found. Add your first table.</p>
              ) : (
                <div className="space-y-3">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: table number + label + badges + Edit */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">T{table.number}</span>
                            {table.label && (
                              <span className="text-sm text-gray-500 dark:text-slate-400">{table.label}</span>
                            )}
                            <StatusBadge status={table.status} />
                            <ActiveBadge isActive={table.isActive} />
                          </div>
                        </div>
                        <div className="shrink-0">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(table)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Edit table T${table.number}`}
                            >
                              <Edit2 size={12} />
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Detail rows */}
                      <div className="mt-2.5 space-y-1 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Capacity</span>
                          <span className="text-gray-700 dark:text-slate-300">{table.capacity} seats</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Sort Order</span>
                          <span className="text-gray-700 dark:text-slate-300">{table.sortOrder ?? 0}</span>
                        </div>
                      </div>

                      {/* Bottom: Delete */}
                      {canDelete && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                          {confirmingDeleteId === table.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                              <button
                                onClick={() => handleDelete(table.id)}
                                className="text-red-600 font-medium hover:underline cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmingDeleteId(null)}
                                className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer"
                              >
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => setConfirmingDeleteId(table.id)}
                              className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              aria-label={`Delete table T${table.number}`}
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2
              id="table-modal-title"
              className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4"
            >
              {editingItem ? `Edit Table T${editingItem.number}` : 'Add Table'}
            </h2>

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">

                {/* Table Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Table Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="tableNumber"
                    value={formData.tableNumber}
                    onChange={handleChange}
                    min="1"
                    required
                    placeholder="e.g. 1"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    aria-label="Table number"
                  />
                </div>

                {/* Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Label <span className="text-gray-400 dark:text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    name="label"
                    value={formData.label}
                    onChange={handleChange}
                    placeholder="e.g. Window Seat, VIP"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    aria-label="Table label"
                  />
                </div>

                {/* Capacity & Sort Order — two columns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      name="capacity"
                      value={formData.capacity}
                      onChange={handleChange}
                      min="1"
                      placeholder="4"
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                      aria-label="Seating capacity"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Sort Order
                    </label>
                    <input
                      type="number"
                      name="sortOrder"
                      value={formData.sortOrder}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                      aria-label="Sort order"
                    />
                  </div>
                </div>

                {/* Is Active */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleChange}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label="Table is active"
                  />
                  <span className="text-sm text-gray-700 dark:text-slate-300">Active</span>
                </label>

                {/* Inline error */}
                {formError && (
                  <p className="text-sm text-red-600 dark:text-red-400" role="alert">{formError}</p>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
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

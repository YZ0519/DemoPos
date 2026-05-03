import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Shield, Edit2, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import rolesApi from '../../api/roles'
import { useAuth } from '../../context/AuthContext'

const ADMIN_ROLE_ID = 1

export default function Roles() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData] = useState({ name: '' })
  const [formError, setFormError] = useState('')

  const perms     = user?.permissions ?? []
  const canView   = perms.includes('role_view')
  const canCreate = perms.includes('role_create')
  const canUpdate = perms.includes('role_update')
  const canDelete = perms.includes('role_delete')

  useEffect(() => {
    if (!canView) return
    fetchRoles()
  }, [canView])

  function fetchRoles() {
    setLoading(true)
    rolesApi.getAll()
      .then((res) => setRoles(res.data?.data ?? []))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false))
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingRole(null)
    setFormData({ name: '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(role) {
    setEditingRole(role)
    setFormData({ name: role.name })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingRole(null)
    setFormData({ name: '' })
    setFormError('')
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    const name = formData.name.trim()
    if (!name) {
      setFormError('Role name is required.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      if (editingRole) {
        const res = await rolesApi.update(editingRole.id, { name })
        const updated = res.data?.data ?? { ...editingRole, name }
        setRoles((prev) => prev.map((r) => (r.id === editingRole.id ? updated : r)))
        toast.success('Role updated successfully')
      } else {
        const res = await rolesApi.create({ name })
        const created = res.data?.data ?? { id: Date.now(), name, permissions: [] }
        setRoles((prev) => [created, ...prev])
        toast.success('Role created successfully')
      }
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    try {
      await rolesApi.delete(id)
      setRoles((prev) => prev.filter((r) => r.id !== id))
      toast.success('Role deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete role')
    } finally {
      setConfirmingDeleteId(null)
    }
  }

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Roles</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Role
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label="Loading roles">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
          {/* ── Desktop table (sm and above) ──────────────────────────────────── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" aria-label="Roles table">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No roles found.
                    </td>
                  </tr>
                ) : (
                  roles.map((role, index) => {
                    const isAdmin = role.id === ADMIN_ROLE_ID
                    return (
                      <tr key={role.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300">
                          <span className="flex items-center gap-2">
                            <Shield size={14} className="text-blue-400 shrink-0" />
                            {role.name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => navigate(`/roles/${role.id}/permissions`)}
                              className="bg-purple-50 hover:bg-purple-100 text-purple-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Manage permissions for ${role.name}`}
                            >
                              <KeyRound size={13} />
                              Permissions
                            </button>
                            {!isAdmin && canUpdate && (
                              <button
                                onClick={() => openEditModal(role)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                aria-label={`Edit ${role.name}`}
                              >
                                <Edit2 size={13} />
                                Edit
                              </button>
                            )}
                            {!isAdmin && canDelete && (
                              confirmingDeleteId === role.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button onClick={() => handleDelete(role.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                  <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 hover:underline cursor-pointer">No</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(role.id)}
                                  className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                  aria-label={`Delete ${role.name}`}
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

          {/* ── Mobile cards (sm and below) ─────────────────────────────────────── */}
          {/* Replicate this pattern on other list pages. */}
          <div className="sm:hidden">
            {roles.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No roles found.</p>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => {
                  const isAdmin = role.id === ADMIN_ROLE_ID
                  return (
                    <div
                      key={role.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: role name + Permissions button */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
                          <Shield size={14} className="text-blue-400 shrink-0" />
                          {role.name}
                        </span>
                        <button
                          onClick={() => navigate(`/roles/${role.id}/permissions`)}
                          className="bg-purple-50 hover:bg-purple-100 text-purple-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                          aria-label={`Manage permissions for ${role.name}`}
                        >
                          <KeyRound size={12} />
                          Permissions
                        </button>
                      </div>

                      {/* Bottom row: Edit + Delete actions */}
                      {!isAdmin && (canUpdate || canDelete) && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex items-center justify-end gap-1.5">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(role)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Edit ${role.name}`}
                            >
                              <Edit2 size={12} />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === role.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(role.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(role.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                aria-label={`Delete ${role.name}`}
                              >
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="role-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 id="role-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingRole ? 'Edit Role' : 'Add Role'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="role-name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  id="role-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="e.g. Manager"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
                {formError && (
                  <p className="text-xs text-red-600 mt-1">{formError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 mt-6">
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
                  {submitting ? 'Saving...' : editingRole ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

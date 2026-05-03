import { useState, useEffect } from 'react'
import { Plus, Edit2, UserX, UserCheck, Mail, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import usersApi from '../../api/users'
import rolesApi from '../../api/roles'
import { useAuth } from '../../context/AuthContext'

const DEMO_EMAIL = 'demo@qtecsolution.net'

export default function Users() {
  const { user } = useAuth()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData] = useState({ name: '', email: '', password: '', roleId: '' })
  const [formError, setFormError] = useState('')

  const perms    = user?.permissions ?? []
  const canView   = perms.includes('user_view')
  const canCreate = perms.includes('user_create')
  const canUpdate = perms.includes('user_update')
  const canDelete = perms.includes('user_delete')
  const canSuspend = perms.includes('user_suspend')

  useEffect(() => {
    if (!canView) return
    fetchUsers()
    fetchRoles()
  }, [canView])

  // Close modal when Escape key is pressed
  useEffect(() => {
    if (!modalOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  function fetchUsers() {
    setLoading(true)
    usersApi.getAll()
      .then((res) => setUsers(res.data?.data ?? []))
      .catch(() => {
        setUsers([])
        toast.error('Failed to load users')
      })
      .finally(() => setLoading(false))
  }

  function fetchRoles() {
    rolesApi.getAll()
      .then((res) => setRoles(res.data?.data ?? []))
      .catch(() => setRoles([]))
  }

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', roleId: '' })
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(u) {
    setEditingUser(u)
    setFormData({ name: u.name, email: u.email, password: '', roleId: u.roleId ?? '' })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', roleId: '' })
    setFormError('')
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    const name  = formData.name.trim()
    const email = formData.email.trim()
    if (!name || !email) {
      setFormError('Name and email are required.')
      return
    }
    if (!formData.roleId) {
      setFormError('Please select a role.')
      return
    }
    if (!editingUser && !formData.password) {
      setFormError('Password is required for new users.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      if (editingUser) {
        const payload = { name, email, roleId: Number(formData.roleId) }
        if (formData.password) payload.password = formData.password
        const res = await usersApi.update(editingUser.id, payload)
        const updated = res.data?.data ?? { ...editingUser, name, email }
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)))
        toast.success('User updated successfully')
      } else {
        const res = await usersApi.create({ name, email, password: formData.password, roleId: Number(formData.roleId) })
        const created = res.data?.data ?? { id: Date.now(), name, email, isSuspended: false }
        setUsers((prev) => [created, ...prev])
        toast.success('User created successfully')
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
      await usersApi.delete(id)
      setUsers((prev) => prev.filter((u) => u.id !== id))
      toast.success('User deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete user')
    } finally {
      setConfirmingDeleteId(null)
    }
  }

  // ── Suspend / Unsuspend ────────────────────────────────────────────────────

  async function handleToggleSuspend(u) {
    try {
      await usersApi.suspend(u.id, !u.isSuspended)
      setUsers((prev) =>
        prev.map((item) =>
          item.id === u.id ? { ...item, isSuspended: !u.isSuspended } : item
        )
      )
      toast.success(u.isSuspended ? 'User unsuspended' : 'User suspended')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update user status')
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Users</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add User
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16" role="status" aria-label="Loading users">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
          {/* ── Desktop table (sm and above) ──────────────────────────────────── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm" aria-label="Users table">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((u, index) => {
                    const isDemo = u.email === DEMO_EMAIL
                    return (
                      <tr key={u.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{u.name}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{u.email}</td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{u.role ?? '—'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              u.isSuspended
                                ? 'bg-red-50 text-red-600'
                                : 'bg-green-50 text-green-600'
                            }`}
                          >
                            {u.isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {isDemo ? (
                            <span className="text-xs text-gray-400 italic">Protected</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {canUpdate && (
                                <button
                                  onClick={() => openEditModal(u)}
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  aria-label={`Edit ${u.name}`}
                                >
                                  <Edit2 size={13} />
                                  Edit
                                </button>
                              )}
                              {canSuspend && (
                                <button
                                  onClick={() => handleToggleSuspend(u)}
                                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                                    u.isSuspended
                                      ? 'bg-green-50 hover:bg-green-100 text-green-600'
                                      : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600'
                                  }`}
                                  aria-label={u.isSuspended ? `Unsuspend ${u.name}` : `Suspend ${u.name}`}
                                >
                                  {u.isSuspended ? <UserCheck size={13} /> : <UserX size={13} />}
                                  {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                                </button>
                              )}
                              {canDelete && (
                                confirmingDeleteId === u.id ? (
                                  <span className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                    <button onClick={() => handleDelete(u.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                    <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 hover:underline cursor-pointer">No</button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setConfirmingDeleteId(u.id)}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                                    aria-label={`Delete ${u.name}`}
                                  >
                                    Delete
                                  </button>
                                )
                              )}
                            </div>
                          )}
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
            {users.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No users found.</p>
            ) : (
              <div className="space-y-3">
                {users.map((u) => {
                  const isDemo = u.email === DEMO_EMAIL
                  return (
                    <div
                      key={u.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: name + status badge + Edit button */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{u.name}</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.isSuspended ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {u.isSuspended ? 'Suspended' : 'Active'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isDemo && canUpdate && (
                            <button
                              onClick={() => openEditModal(u)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Edit ${u.name}`}
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
                          <Mail size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                          <span className="truncate">{u.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield size={13} className="shrink-0 text-gray-400 dark:text-slate-500" />
                          <span>{u.role ?? '—'}</span>
                        </div>
                      </div>

                      {/* Bottom row: Suspend + Delete actions */}
                      {isDemo ? (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                          <span className="text-xs text-gray-400 italic">Protected</span>
                        </div>
                      ) : (canSuspend || canDelete) ? (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex items-center justify-end gap-1.5">
                          {canSuspend && (
                            <button
                              onClick={() => handleToggleSuspend(u)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                                u.isSuspended
                                  ? 'bg-green-50 hover:bg-green-100 text-green-600'
                                  : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-600'
                              }`}
                              aria-label={u.isSuspended ? `Unsuspend ${u.name}` : `Suspend ${u.name}`}
                            >
                              {u.isSuspended ? <UserCheck size={12} /> : <UserX size={12} />}
                              {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === u.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(u.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(u.id)}
                                className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                aria-label={`Delete ${u.name}`}
                              >
                                Delete
                              </button>
                            )
                          )}
                        </div>
                      ) : null}
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
          aria-labelledby="user-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <h2 id="user-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingUser ? 'Edit User' : 'Add User'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="user-name" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="user-email" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  id="user-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="user-role" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Role
                </label>
                <select
                  id="user-role"
                  value={formData.roleId}
                  onChange={(e) => setFormData((f) => ({ ...f, roleId: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                  disabled={submitting}
                >
                  <option value="">Select a role...</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="user-password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Password {editingUser && <span className="text-gray-400 font-normal">(leave blank to keep unchanged)</span>}
                </label>
                <input
                  id="user-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
                  placeholder={editingUser ? 'New password (optional)' : 'Password'}
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
                  {submitting ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

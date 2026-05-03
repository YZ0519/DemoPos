import { useState, useEffect } from 'react'
import { Plus, Edit2, Image } from 'lucide-react'
import toast from 'react-hot-toast'
import categoriesApi from '../../api/categories'
import { useAuth } from '../../context/AuthContext'
import { MEDIA_HOST } from '../../api/axios'

const emptyForm = { name: '', description: '', status: true, image: null }

export default function Categories() {
  const { user } = useAuth()
  const perms    = user?.permissions ?? []
  const canView   = perms.includes('category_view')
  const canCreate = perms.includes('category_create')
  const canUpdate = perms.includes('category_update')
  const canDelete = perms.includes('category_delete')

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [imagePreview, setImagePreview] = useState(null)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!canView) return
    fetchCategories()
  }, [canView])

  function fetchCategories() {
    setLoading(true)
    categoriesApi.getAll()
      .then((res) => setCategories(res.data?.data ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }

  function openCreateModal() {
    setEditingItem(null)
    setFormData(emptyForm)
    setImagePreview(null)
    setFormError('')
    setModalOpen(true)
  }

  function openEditModal(item) {
    setEditingItem(item)
    setFormData({ name: item.name, description: item.description ?? '', status: item.status, image: null })
    setImagePreview(item.image ? `${MEDIA_HOST}/${item.image}` : null)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormData(emptyForm)
    setImagePreview(null)
    setFormError('')
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFormData((f) => ({ ...f, image: file }))
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError('Category name is required.')
      return
    }
    setSubmitting(true)
    setFormError('')

    const fd = new FormData()
    fd.append('name', formData.name.trim())
    fd.append('description', formData.description.trim())
    fd.append('status', formData.status)
    if (formData.image) fd.append('image', formData.image)

    try {
      if (editingItem) {
        const res = await categoriesApi.update(editingItem.id, fd)
        const updated = res.data?.data
        setCategories((prev) => prev.map((c) => (c.id === editingItem.id ? updated : c)))
        toast.success('Category updated successfully')
      } else {
        const res = await categoriesApi.create(fd)
        const created = res.data?.data
        setCategories((prev) => [created, ...prev])
        toast.success('Category created successfully')
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
      await categoriesApi.remove(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success('Category deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete category')
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Categories</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Category
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-16">Image</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No categories found.</td>
                  </tr>
                ) : (
                  categories.map((cat, index) => (
                    <tr key={cat.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4">
                        {cat.image ? (
                          <img
                            src={`${MEDIA_HOST}/${cat.image}`}
                            alt={cat.name}
                            className="w-10 h-10 rounded-lg object-cover"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                            <Image size={16} className="text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{cat.name}</td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{cat.description || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cat.status ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {cat.status ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(cat)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={13} />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === cat.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button onClick={() => handleDelete(cat.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                              </span>
                            ) : (
                              <button
                                onClick={() => setConfirmingDeleteId(cat.id)}
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
            {categories.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No categories found.</p>
            ) : (
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                  >
                    {/* Top row: image + name + Edit button */}
                    <div className="flex items-start gap-3">
                      {cat.image ? (
                        <img
                          src={`${MEDIA_HOST}/${cat.image}`}
                          alt={cat.name}
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          <Image size={16} className="text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{cat.name}</span>
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          cat.status ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {cat.status ? 'Active' : 'Inactive'}
                        </span>
                        {cat.description && (
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{cat.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(cat)}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                        {confirmingDeleteId === cat.id ? (
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                            <button onClick={() => handleDelete(cat.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                            <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(cat.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-600 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
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
              {editingItem ? 'Edit Category' : 'Add Category'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Category name"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Image</label>
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover mb-2" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-600 file:text-sm file:cursor-pointer"
                  disabled={submitting}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="cat-status"
                  type="checkbox"
                  checked={formData.status}
                  onChange={(e) => setFormData((f) => ({ ...f, status: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={submitting}
                />
                <label htmlFor="cat-status" className="text-sm font-medium text-gray-700 dark:text-slate-300">Active</label>
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

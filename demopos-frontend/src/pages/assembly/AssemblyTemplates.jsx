import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getAssemblyProducts,
} from '../../api/assembly'
import { useAuth } from '../../context/AuthContext'
import SearchableSelect from '../../components/SearchableSelect'
import PriceInput from '../../components/PriceInput'

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function StatusBadge({ isActive }) {
  return isActive ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
      Inactive
    </span>
  )
}

// ─── Empty form state ────────────────────────────────────────────────────────

const emptyForm = {
  name: '',
  assemblyType: 'split',
  outputProductId: '',
  defaultYield: '',
  description: '',
  isActive: true,
  items: [{ productId: '', defaultQuantity: '', sortOrder: 0 }],
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AssemblyTemplates() {
  const { user } = useAuth()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('assembly_view')
  const canCreate = perms.includes('assembly_create')
  const canUpdate = perms.includes('assembly_update')
  const canDelete = perms.includes('assembly_delete')

  const [templates, setTemplates]                   = useState([])
  const [products, setProducts]                     = useState([])
  const [loading, setLoading]                       = useState(true)
  const [submitting, setSubmitting]                 = useState(false)
  const [modalOpen, setModalOpen]                   = useState(false)
  const [editingItem, setEditingItem]               = useState(null)
  const [formData, setFormData]                     = useState(emptyForm)
  const [formError, setFormError]                   = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  // ─── Data loading ──────────────────────────────────────────────────────────

  const fetchTemplates = useCallback(() => {
    let cancelled = false
    setLoading(true)
    getTemplates(1, 200)
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data
        setTemplates(Array.isArray(d) ? d : (d?.items ?? []))
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load assembly templates')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!canView) return
    const cancel = fetchTemplates()
    // Load all products for the ingredient and output-product SearchableSelects.
    // Uses assembly-lookup endpoint (gated on assembly_view/create, not product_view).
    getAssemblyProducts()
      .then((res) => setProducts(res.data?.data ?? []))
      .catch(() => toast.error('Failed to load products for ingredient selection'))
    return cancel
  }, [canView, fetchTemplates])

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  async function openEditModal(item) {
    setFormError('')
    setModalOpen(true)
    setEditingItem(item)
    setFormData({
      name:            item.name,
      assemblyType:    item.assemblyType,
      outputProductId: item.outputProductId ?? '',
      defaultYield:    item.defaultYield?.toString() ?? '',
      description:     item.description ?? '',
      isActive:        item.isActive,
      items:           [{ productId: '', defaultQuantity: '', sortOrder: 0 }],
    })
    try {
      const res = await getTemplateById(item.id)
      const detail = res.data?.data
      if (detail?.items?.length > 0) {
        setFormData((f) => ({
          ...f,
          items: detail.items.map((i) => ({
            productId:       i.productId ?? '',
            defaultQuantity: i.defaultQuantity?.toString() ?? '',
            sortOrder:       i.sortOrder ?? 0,
          })),
        }))
      }
    } catch {
      toast.error('Failed to load template details')
    }
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
  }

  // ─── Ingredient row helpers ────────────────────────────────────────────────

  function addIngredientRow() {
    setFormData((f) => ({
      ...f,
      items: [...f.items, { productId: '', defaultQuantity: '', sortOrder: f.items.length }],
    }))
  }

  function removeIngredientRow(index) {
    setFormData((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }))
  }

  function updateIngredientRow(index, field, value) {
    setFormData((f) => {
      const updated = f.items.map((row, i) =>
        i === index ? { ...row, [field]: value } : row
      )
      return { ...f, items: updated }
    })
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!formData.name.trim()) { setFormError('Template name is required.'); return }
    if (!formData.outputProductId) { setFormError('Output product is required.'); return }
    if (!formData.defaultYield || parseFloat(formData.defaultYield) <= 0) {
      setFormError('Default yield must be greater than zero.')
      return
    }
    const validItems = formData.items.filter((i) => i.productId && i.defaultQuantity)
    if (validItems.length === 0) {
      setFormError('At least one ingredient with product and quantity is required.')
      return
    }
    // Guard against circular assembly (output product used as its own ingredient)
    const circular = validItems.some((i) => String(i.productId) === String(formData.outputProductId))
    if (circular) {
      setFormError('A product cannot be both an input and the output of the same assembly.')
      return
    }

    const payload = {
      name:            formData.name.trim(),
      assemblyType:    formData.assemblyType,
      outputProductId: Number(formData.outputProductId),
      defaultYield:    parseFloat(formData.defaultYield),
      description:     formData.description.trim() || null,
      isActive:        formData.isActive,
      items: validItems.map((row, idx) => ({
        productId:       Number(row.productId),
        defaultQuantity: parseFloat(row.defaultQuantity),
        sortOrder:       idx,
      })),
    }

    setSubmitting(true)
    try {
      if (editingItem) {
        const res = await updateTemplate(editingItem.id, payload)
        const updated = res.data?.data
        setTemplates((prev) => prev.map((t) => (t.id === editingItem.id ? updated : t)))
        toast.success('Template updated successfully')
      } else {
        const res = await createTemplate(payload)
        const created = res.data?.data
        setTemplates((prev) => [created, ...prev])
        toast.success('Template created successfully')
      }
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    try {
      await deleteTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success('Template deleted')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete template')
    } finally {
      setConfirmingDeleteId(null)
    }
  }

  // ─── Access denied ─────────────────────────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Assembly Templates</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            New Template
          </button>
        )}
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
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Output Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Default Yield</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Ingredients</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No assembly templates found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  templates.map((tpl, index) => (
                    <tr key={tpl.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4">
                        <p className="text-gray-700 dark:text-slate-300 font-medium">{tpl.name}</p>
                        {tpl.description && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 truncate max-w-48">{tpl.description}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <TypeBadge type={tpl.assemblyType} />
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{tpl.outputProductName ?? '—'}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{tpl.defaultYield}</td>
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400 text-xs">
                        {tpl.itemCount ?? tpl.items?.length ?? 0} item{(tpl.itemCount ?? tpl.items?.length ?? 0) !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge isActive={tpl.isActive} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(tpl)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Edit template ${tpl.name}`}
                            >
                              <Edit2 size={13} />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === tpl.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button
                                  onClick={() => handleDelete(tpl.id)}
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
                                onClick={() => setConfirmingDeleteId(tpl.id)}
                                className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                aria-label={`Delete template ${tpl.name}`}
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
          <div className="sm:hidden">
            {templates.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No assembly templates found. Create one to get started.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                  >
                    {/* Top row: name + badges + Edit button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{tpl.name}</span>
                          <TypeBadge type={tpl.assemblyType} />
                          <StatusBadge isActive={tpl.isActive} />
                        </div>
                        {tpl.description && (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">{tpl.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {canUpdate && (
                          <button
                            onClick={() => openEditModal(tpl)}
                            className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            aria-label={`Edit template ${tpl.name}`}
                          >
                            <Edit2 size={12} />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detail rows */}
                    <div className="mt-2.5 space-y-1.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Output Product</span>
                        <span className="text-gray-700 dark:text-slate-300 font-medium text-right max-w-[55%] truncate">{tpl.outputProductName ?? '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Default Yield</span>
                        <span className="text-gray-600 dark:text-slate-400">{tpl.defaultYield}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-slate-400">Ingredients</span>
                        <span className="text-gray-600 dark:text-slate-400">
                          {tpl.itemCount ?? tpl.items?.length ?? 0} item{(tpl.itemCount ?? tpl.items?.length ?? 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Bottom row: delete action */}
                    {canDelete && (
                      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                        {confirmingDeleteId === tpl.id ? (
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                            <button onClick={() => handleDelete(tpl.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                            <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteId(tpl.id)}
                            className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            aria-label={`Delete template ${tpl.name}`}
                          >
                            <Trash2 size={12} />
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
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-8"
          role="dialog"
          aria-modal="true"
          aria-label={editingItem ? 'Edit Assembly Template' : 'Create Assembly Template'}
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center gap-3 mb-5">
              <Layers size={20} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                {editingItem ? 'Edit Assembly Template' : 'New Assembly Template'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Cola Box Split"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              {/* Assembly Type + Active toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Assembly Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.assemblyType}
                    onChange={(e) => setFormData((f) => ({ ...f, assemblyType: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}
                  >
                    <option value="split">Split (Box → Units)</option>
                    <option value="production">Production (Recipe → Dish)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input
                    id="tpl-active"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <label htmlFor="tpl-active" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Active
                  </label>
                </div>
              </div>

              {/* Output Product + Default Yield */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Output Product <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={products.map((p) => ({ id: p.id, name: p.name }))}
                    value={formData.outputProductId}
                    onChange={(id) => setFormData((f) => ({ ...f, outputProductId: id }))}
                    placeholder="Select output product..."
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Default Yield <span className="text-red-500">*</span>
                  </label>
                  <PriceInput
                    value={formData.defaultYield}
                    onChange={(v) => setFormData((f) => ({ ...f, defaultYield: v }))}
                    placeholder="e.g. 24"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Output units produced per run</p>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Ingredients <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    Waste is set per assembly run, not in the template
                  </p>
                </div>

                <div className="border border-gray-100 dark:border-slate-700 rounded-xl">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_140px_40px] gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700 text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    <span>Input Product</span>
                    <span>Default Qty</span>
                    <span />
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-gray-50 dark:divide-slate-700">
                    {formData.items.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_140px_40px] gap-2 px-3 py-2 items-center">
                        <SearchableSelect
                          options={products.map((p) => ({ id: p.id, name: p.name }))}
                          value={row.productId}
                          onChange={(id) => updateIngredientRow(idx, 'productId', id)}
                          placeholder="Select product..."
                          disabled={submitting}
                        />
                        <PriceInput
                          value={row.defaultQuantity}
                          onChange={(v) => updateIngredientRow(idx, 'defaultQuantity', v)}
                          placeholder="0.00"
                          className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                          disabled={submitting}
                        />
                        <button
                          type="button"
                          onClick={() => removeIngredientRow(idx)}
                          disabled={formData.items.length === 1 || submitting}
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label="Remove ingredient"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addIngredientRow}
                  disabled={submitting}
                  className="mt-2 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add Ingredient
                </button>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional notes about this template"
                  rows={2}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting}
                />
              </div>

              {/* Form error */}
              {formError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
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
                  {submitting ? 'Saving...' : editingItem ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

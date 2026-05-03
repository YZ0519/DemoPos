import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Edit2, Package, Trash2, ChevronUp, ChevronDown, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getBundles, createBundle, updateBundle, deleteBundle } from '../../api/bundles'
import productsApi from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/utils/currency'
import PriceInput from '../../components/PriceInput'
import usePageTitle from '../../hooks/usePageTitle'

/* ── constants ───────────────────────────────────────────────── */
const SELECTION_MODE = { FLAT: 'flat', MULTISTEP: 'multistep' }

/* ── helpers ─────────────────────────────────────────────────── */

/** Default empty step for adding new steps. */
function newStep(sortOrder) {
  return {
    label: '',
    sortOrder,
    minQuantity: 1,
    maxQuantity: 1,
    isOptional: false,
    productIds: [],
  }
}

const emptyForm = {
  name:     '',
  price:    0,
  minItems: 1,
  maxItems: 1,
  isActive: true,
}

const MAX_STEPS = 10

/* ── main component ──────────────────────────────────────────── */

export default function ProductBundles() {
  usePageTitle('Product Bundles')

  const { user } = useAuth()
  const { symbol, precision } = useCurrency()

  const perms     = user?.permissions ?? []
  const canView   = perms.includes('product_bundle_view')
  const canCreate = perms.includes('product_bundle_create')
  const canUpdate = perms.includes('product_bundle_update')
  const canDelete = perms.includes('product_bundle_delete')

  const [bundles, setBundles]                     = useState([])
  const [loading, setLoading]                     = useState(true)
  const [submitting, setSubmitting]               = useState(false)
  const [modalOpen, setModalOpen]                 = useState(false)
  const [editingItem, setEditingItem]             = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData]                   = useState(emptyForm)
  const [formError, setFormError]                 = useState('')

  /* Multi-step state */
  const [selectionMode, setSelectionMode]         = useState(SELECTION_MODE.FLAT) // 'flat' | 'multistep'
  const [steps, setSteps]                         = useState([])
  const [allProducts, setAllProducts]             = useState([])
  const [productsLoading, setProductsLoading]     = useState(false)
  const [confirmSwitchToFlat, setConfirmSwitchToFlat] = useState(false)

  /* Escape-key handler for modal */
  useEffect(() => {
    if (!modalOpen) return
    function handleKey(e) { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [modalOpen])

  /* ── data fetching ───────────────────────────────────────── */

  useEffect(() => {
    if (!canView) return
    fetchBundles()
  }, [canView])

  function fetchBundles() {
    setLoading(true)
    getBundles()
      .then((res) => setBundles(res.data?.data ?? []))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false))
  }

  /** Load all products once when modal opens (for product pickers). */
  function loadProducts() {
    if (allProducts.length > 0) return // already loaded
    setProductsLoading(true)
    productsApi.getAll(1, 9999, '')
      .then((res) => {
        const d = res.data?.data
        const items = Array.isArray(d) ? d : (d?.items ?? [])
        setAllProducts(items.map(p => ({ id: p.id, name: p.name })))
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setProductsLoading(false))
  }

  /* ── modal open/close ────────────────────────────────────── */

  function openCreateModal() {
    setEditingItem(null)
    setFormData(emptyForm)
    setSelectionMode(SELECTION_MODE.FLAT)
    setSteps([])
    setFormError('')
    setConfirmSwitchToFlat(false)
    setModalOpen(true)
    loadProducts()
  }

  function openEditModal(bundle) {
    setEditingItem(bundle)
    setFormData({
      name:     bundle.name,
      price:    bundle.price ?? 0,
      minItems: bundle.minItems ?? 1,
      maxItems: bundle.maxItems ?? 1,
      isActive: bundle.isActive ?? true,
    })
    setFormError('')
    setConfirmSwitchToFlat(false)
    setModalOpen(true)
    loadProducts()

    /* Use already-loaded bundle data (list response includes full steps) */
    const serverSteps = bundle.steps ?? []
    if (serverSteps.length > 0) {
      setSelectionMode(SELECTION_MODE.MULTISTEP)
      setSteps(
        [...serverSteps]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((s) => ({
            label:       s.label ?? '',
            sortOrder:   s.sortOrder ?? 0,
            minQuantity: s.minQuantity ?? 1,
            maxQuantity: s.maxQuantity ?? 1,
            isOptional:  s.isOptional ?? false,
            productIds:  (s.products ?? []).map(p => p.productId),
          }))
      )
    } else {
      setSelectionMode(SELECTION_MODE.FLAT)
      setSteps([])
    }
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormData(emptyForm)
    setSelectionMode(SELECTION_MODE.FLAT)
    setSteps([])
    setFormError('')
    setConfirmSwitchToFlat(false)
  }

  /* ── mode switching ──────────────────────────────────────── */

  function handleSelectionModeChange(mode) {
    if (mode === selectionMode) return

    if (mode === SELECTION_MODE.FLAT && steps.length > 0) {
      /* Switching from Multi-Step to Flat with existing steps — confirm first */
      setConfirmSwitchToFlat(true)
      return
    }

    applyModeSwitch(mode)
  }

  function applyModeSwitch(mode) {
    if (mode === SELECTION_MODE.FLAT) {
      /* Preserve computed min/max as flat defaults */
      setFormData(f => ({
        ...f,
        minItems: computedMin || f.minItems,
        maxItems: computedMax || f.maxItems,
      }))
      setSteps([])
    }
    setSelectionMode(mode)
    setConfirmSwitchToFlat(false)
  }

  /* ── step management ─────────────────────────────────────── */

  function addStep() {
    if (steps.length >= MAX_STEPS) {
      toast.error(`Maximum of ${MAX_STEPS} steps allowed.`)
      return
    }
    setSteps(prev => [...prev, newStep(prev.length)])
  }

  function removeStep(index) {
    setSteps(prev => {
      const updated = prev.filter((_, i) => i !== index)
      return updated.map((s, i) => ({ ...s, sortOrder: i }))
    })
  }

  function updateStep(index, field, value) {
    setSteps(prev => prev.map((s, i) => {
      if (i !== index) return s
      const updated = { ...s, [field]: value }

      /* When optional is checked, force minQuantity to 0 */
      if (field === 'isOptional' && value === true) {
        updated.minQuantity = 0
      }
      /* When optional is unchecked, bump minQuantity to at least 1 if it was 0 */
      if (field === 'isOptional' && value === false && updated.minQuantity === 0) {
        updated.minQuantity = 1
      }
      /* Keep maxQuantity >= minQuantity */
      if (field === 'minQuantity' && updated.maxQuantity < value) {
        updated.maxQuantity = value
      }

      return updated
    }))
  }

  function moveStep(index, direction) {
    const target = index + direction
    if (target < 0 || target >= steps.length) return
    setSteps(prev => {
      const copy = [...prev]
      const temp = copy[index]
      copy[index] = copy[target]
      copy[target] = temp
      return copy.map((s, i) => ({ ...s, sortOrder: i }))
    })
  }

  function toggleStepProduct(stepIndex, productId) {
    setSteps(prev => prev.map((s, i) => {
      if (i !== stepIndex) return s
      const ids = s.productIds.includes(productId)
        ? s.productIds.filter(id => id !== productId)
        : [...s.productIds, productId]
      return { ...s, productIds: ids }
    }))
  }

  /* ── computed values ─────────────────────────────────────── */

  const { computedMin, computedMax } = useMemo(() => {
    if (steps.length === 0) return { computedMin: 0, computedMax: 0 }
    let min = 0, max = 0
    for (const s of steps) {
      min += Number(s.minQuantity) || 0
      max += Number(s.maxQuantity) || 0
    }
    return { computedMin: min, computedMax: max }
  }, [steps])

  /** Shared product name lookup — computed once, reused by all StepCards. */
  const productNameMap = useMemo(
    () => new Map(allProducts.map(p => [p.id, p.name])),
    [allProducts]
  )

  /* ── validation ──────────────────────────────────────────── */

  function validateForm() {
    if (!formData.name.trim()) return 'Bundle name is required.'
    if (!formData.price || Number(formData.price) <= 0) return 'Price must be greater than 0.'

    if (selectionMode === SELECTION_MODE.FLAT) {
      const min = Number(formData.minItems)
      const max = Number(formData.maxItems)
      if (min < 1) return 'Min items must be at least 1.'
      if (max < min) return 'Max items must be greater than or equal to Min items.'
    }

    if (selectionMode === SELECTION_MODE.MULTISTEP) {
      if (steps.length === 0) return 'At least one step is required in Multi-Step mode.'
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]
        if (!s.label.trim()) return `Step ${i + 1}: Label is required.`
        if (Number(s.maxQuantity) < Number(s.minQuantity)) {
          return `Step ${i + 1}: Max quantity must be >= Min quantity.`
        }
        if (!s.isOptional && Number(s.minQuantity) < 1) {
          return `Step ${i + 1}: Min quantity must be at least 1 for required steps.`
        }
        if (Number(s.maxQuantity) < 1) {
          return `Step ${i + 1}: Max quantity must be at least 1.`
        }
        if (s.productIds.length === 0) {
          return `Step ${i + 1}: At least one product must be selected.`
        }
      }
    }

    return null
  }

  /* ── submit ──────────────────────────────────────────────── */

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSubmitting(true)
    setFormError('')

    const payload = {
      name:     formData.name.trim(),
      price:    Number(formData.price),
      isActive: formData.isActive,
    }

    if (selectionMode === SELECTION_MODE.MULTISTEP) {
      payload.minItems = computedMin
      payload.maxItems = computedMax
      payload.steps = steps.map((s, i) => ({
        label:       s.label.trim(),
        sortOrder:   i,
        minQuantity: Number(s.minQuantity),
        maxQuantity: Number(s.maxQuantity),
        isOptional:  s.isOptional,
        productIds:  s.productIds,
      }))
    } else {
      payload.minItems = Number(formData.minItems)
      payload.maxItems = Number(formData.maxItems)
      payload.steps = null
    }

    try {
      if (editingItem) {
        const res = await updateBundle(editingItem.id, payload)
        const updated = res.data?.data
        setBundles((prev) => prev.map((b) => (b.id === editingItem.id ? updated : b)))
        toast.success('Bundle updated successfully')
      } else {
        const res = await createBundle(payload)
        const created = res.data?.data
        setBundles((prev) => [created, ...prev])
        toast.success('Bundle created successfully')
      }
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── delete ──────────────────────────────────────────────── */

  async function handleDelete(id) {
    try {
      await deleteBundle(id)
      setBundles((prev) => prev.filter((b) => b.id !== id))
      toast.success('Bundle deleted successfully')
    } catch (err) {
      const status = err.response?.status
      if (status === 409) {
        toast.error('This bundle has been used in sales. Deactivate it instead.')
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to delete bundle')
      }
    } finally {
      setConfirmingDeleteId(null)
    }
  }

  /* ── render helpers ──────────────────────────────────────── */

  /** Determine display text for bundle type column. */
  function bundleTypeLabel(bundle) {
    const stepCount = bundle.steps?.length ?? 0
    if (stepCount > 0) return `${stepCount} step${stepCount !== 1 ? 's' : ''}`
    return 'Flat'
  }

  /* ── access denied ───────────────────────────────────────── */

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

  /* ── main render ─────────────────────────────────────────── */

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
            <Package size={18} className="text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Product Bundles</h1>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Bundle
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Item Range</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bundles.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No product bundles found. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  bundles.map((bundle, index) => (
                    <tr key={bundle.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{bundle.name}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300">
                        {formatCurrency(bundle.price, symbol, precision)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          (bundle.steps?.length ?? 0) > 0
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                        }`}>
                          {bundleTypeLabel(bundle)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                        {bundle.minItems === bundle.maxItems
                          ? `${bundle.minItems} item${bundle.minItems !== 1 ? 's' : ''}`
                          : `${bundle.minItems} \u2013 ${bundle.maxItems} items`
                        }
                      </td>
                      <td className="py-3 px-4">
                        {bundle.isActive
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                          : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactive</span>
                        }
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(bundle)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 size={13} />
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            confirmingDeleteId === bundle.id ? (
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                <button
                                  onClick={() => handleDelete(bundle.id)}
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
                                onClick={() => setConfirmingDeleteId(bundle.id)}
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
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bundle-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 my-4">
            <h2 id="bundle-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingItem ? 'Edit Bundle' : 'Add Bundle'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Family Combo"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    autoFocus
                    disabled={submitting}
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Bundle Price <span className="text-red-500">*</span>
                  </label>
                  <PriceInput
                    value={formData.price}
                    onChange={(val) => setFormData((f) => ({ ...f, price: parseFloat(val) || 0 }))}
                    placeholder="0.00"
                    disabled={submitting}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>

                {/* ── Selection Mode ─────────────────────── */}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 border-b border-gray-100 dark:border-slate-700 pb-1">
                    Selection Mode
                  </p>

                  <div className="space-y-3">
                    {/* Flat radio */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="selectionMode"
                        value={SELECTION_MODE.FLAT}
                        checked={selectionMode === SELECTION_MODE.FLAT}
                        onChange={() => handleSelectionModeChange('flat')}
                        disabled={submitting}
                        className="mt-1 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                          Flat (pick any products)
                        </span>
                        {selectionMode === SELECTION_MODE.FLAT && (
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                                Min Items <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={formData.minItems}
                                onChange={(e) => {
                                  const min = Number(e.target.value) || 1
                                  setFormData((f) => ({
                                    ...f,
                                    minItems: min,
                                    maxItems: Math.max(f.maxItems, min),
                                  }))
                                }}
                                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                                disabled={submitting}
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                                Max Items <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="number"
                                min={formData.minItems}
                                value={formData.maxItems}
                                onChange={(e) => setFormData((f) => ({ ...f, maxItems: Number(e.target.value) || f.minItems }))}
                                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                                disabled={submitting}
                              />
                              {Number(formData.maxItems) < Number(formData.minItems) && (
                                <p className="text-xs text-red-500 mt-1">Must be {'>='} Min Items</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </label>

                    {/* Multi-Step radio */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="selectionMode"
                        value={SELECTION_MODE.MULTISTEP}
                        checked={selectionMode === SELECTION_MODE.MULTISTEP}
                        onChange={() => handleSelectionModeChange('multistep')}
                        disabled={submitting}
                        className="mt-1 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                        Multi-Step
                      </span>
                    </label>
                  </div>

                  {/* Confirm switch to flat dialog */}
                  {confirmSwitchToFlat && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                            Switch to Flat mode?
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            All configured steps will be removed. The computed min/max will be preserved as flat defaults.
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => applyModeSwitch('flat')}
                              className="text-xs font-medium text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-3 py-1 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                            >
                              Yes, switch to Flat
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmSwitchToFlat(false)}
                              className="text-xs font-medium text-gray-600 dark:text-slate-400 px-3 py-1 rounded-lg hover:text-gray-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Steps Configuration ────────────────── */}
                {selectionMode === SELECTION_MODE.MULTISTEP && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2 border-b border-gray-100 dark:border-slate-700 pb-1">
                      Steps
                    </p>

                    <div className="space-y-3">
                      {steps.map((step, stepIdx) => (
                        <StepCard
                          key={stepIdx}
                          step={step}
                          stepIndex={stepIdx}
                          totalSteps={steps.length}
                          allProducts={allProducts}
                          productNameMap={productNameMap}
                          productsLoading={productsLoading}
                          submitting={submitting}
                          onUpdate={updateStep}
                          onRemove={removeStep}
                          onMove={moveStep}
                          onToggleProduct={toggleStepProduct}
                        />
                      ))}
                    </div>

                    {/* Add Step button */}
                    <button
                      type="button"
                      onClick={addStep}
                      disabled={submitting || steps.length >= MAX_STEPS}
                      className="mt-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                      Add Step
                    </button>

                    {steps.length >= MAX_STEPS && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Maximum of {MAX_STEPS} steps reached.
                      </p>
                    )}

                    {/* Computed totals */}
                    {steps.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                        <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
                          Computed: Min {computedMin} item{computedMin !== 1 ? 's' : ''}, Max {computedMax} item{computedMax !== 1 ? 's' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Is Active */}
                <div className="flex items-center gap-2">
                  <input
                    id="bundle-isActive"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <label htmlFor="bundle-isActive" className="text-sm font-medium text-gray-700 dark:text-slate-300 cursor-pointer">
                    Active
                  </label>
                </div>

                {formError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>
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


/* ── StepCard sub-component ──────────────────────────────────── */

/**
 * Renders a single step configuration card inside the multi-step bundle modal.
 * Kept inside the same file to avoid prop-threading complexity while the
 * component is only used here.
 */
function StepCard({
  step,
  stepIndex,
  totalSteps,
  allProducts,
  productNameMap,
  productsLoading,
  submitting,
  onUpdate,
  onRemove,
  onMove,
  onToggleProduct,
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [productSearch, setProductSearch]         = useState('')
  const [pickerOpen, setPickerOpen]               = useState(false)
  const pickerRef                                 = useRef(null)

  /* Close product picker on outside click */
  useEffect(() => {
    if (!pickerOpen) return
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false)
        setProductSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [pickerOpen])

  /** Products filtered by search. */
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return allProducts
    return allProducts.filter(p => p.name.toLowerCase().includes(q))
  }, [allProducts, productSearch])

  /** Look up product name by ID. */
  function productName(id) {
    return productNameMap.get(id) ?? `Product #${id}`
  }

  function handleRemoveClick() {
    if (step.productIds.length > 0) {
      setConfirmingRemove(true)
    } else {
      onRemove(stepIndex)
    }
  }

  return (
    <div className="border border-gray-200 dark:border-slate-600 rounded-xl p-4 bg-gray-50 dark:bg-slate-700/50">
      {/* Step header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300">
          Step {stepIndex + 1}
        </span>
        <div className="flex items-center gap-1">
          {/* Move up */}
          <button
            type="button"
            onClick={() => onMove(stepIndex, -1)}
            disabled={stepIndex === 0 || submitting}
            className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            aria-label="Move step up"
          >
            <ChevronUp size={16} />
          </button>
          {/* Move down */}
          <button
            type="button"
            onClick={() => onMove(stepIndex, 1)}
            disabled={stepIndex === totalSteps - 1 || submitting}
            className="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
            aria-label="Move step down"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Label */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          Label <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={step.label}
          onChange={(e) => onUpdate(stepIndex, 'label', e.target.value)}
          placeholder="e.g. Main Course"
          className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          disabled={submitting}
        />
      </div>

      {/* Min / Max / Optional — inline */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="w-20">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Min</label>
          <input
            type="number"
            min={step.isOptional ? 0 : 1}
            value={step.minQuantity}
            onChange={(e) => onUpdate(stepIndex, 'minQuantity', Number(e.target.value) || 0)}
            className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            disabled={submitting || step.isOptional}
          />
        </div>
        <div className="w-20">
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Max</label>
          <input
            type="number"
            min={step.minQuantity || 1}
            value={step.maxQuantity}
            onChange={(e) => onUpdate(stepIndex, 'maxQuantity', Math.max(Number(e.target.value) || 1, step.minQuantity))}
            className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            disabled={submitting}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={step.isOptional}
            onChange={(e) => onUpdate(stepIndex, 'isOptional', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            disabled={submitting}
          />
          <span className="text-sm text-gray-600 dark:text-slate-400">Optional</span>
        </label>
      </div>

      {/* Product picker */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
          Products <span className="text-red-500">*</span>
        </label>

        <div className="relative" ref={pickerRef}>
          <input
            type="text"
            value={pickerOpen ? productSearch : ''}
            onChange={(e) => { setProductSearch(e.target.value); setPickerOpen(true) }}
            onFocus={() => { setPickerOpen(true); setProductSearch('') }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setPickerOpen(false); setProductSearch('') } }}
            placeholder={productsLoading ? 'Loading products...' : 'Search and select products...'}
            disabled={submitting || productsLoading}
            className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            autoComplete="off"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          />

          {pickerOpen && (
            <div className="absolute z-30 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg mt-1 max-h-44 overflow-y-auto" role="listbox">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(product => {
                  const isSelected = step.productIds.includes(product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => onToggleProduct(stepIndex, product.id)}
                      className={`w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{product.name}</span>
                      {isSelected && (
                        <span className="text-xs text-blue-500 dark:text-blue-400">Selected</span>
                      )}
                    </button>
                  )
                })
              ) : (
                <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">No products found.</p>
              )}
            </div>
          )}
        </div>

        {/* Selected product chips */}
        {step.productIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {step.productIds.map(pid => (
              <span
                key={pid}
                className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-lg"
              >
                {productName(pid)}
                <button
                  type="button"
                  onClick={() => onToggleProduct(stepIndex, pid)}
                  disabled={submitting}
                  className="text-blue-500 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 cursor-pointer"
                  aria-label={`Remove ${productName(pid)}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Remove step */}
      {confirmingRemove ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-slate-400">Remove step with {step.productIds.length} product{step.productIds.length !== 1 ? 's' : ''}?</span>
          <button
            type="button"
            onClick={() => { onRemove(stepIndex); setConfirmingRemove(false) }}
            className="text-red-600 font-medium hover:underline cursor-pointer"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirmingRemove(false)}
            className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer"
          >
            No
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleRemoveClick}
          disabled={submitting}
          className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
          Remove Step
        </button>
      )}
    </div>
  )
}

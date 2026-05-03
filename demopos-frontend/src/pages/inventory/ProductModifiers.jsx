import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, ChevronDown, ChevronRight, Settings2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getModifierGroups,
  createModifierGroup,
  updateModifierGroup,
  deleteModifierGroup,
  createModifierOption,
  updateModifierOption,
  deleteModifierOption,
} from '../../api/modifiers'
import productsApi from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import PriceInput from '../../components/PriceInput'
import usePageTitle from '../../hooks/usePageTitle'

// ── Helpers ───────────────────────────────────────────────────────────────────

const emptyGroupForm = {
  name: '',
  isRequired: false,
  minSelections: 0,
  maxSelections: 1,
  sortOrder: 0,
  isActive: true,
}

const emptyOptionForm = {
  name: '',
  priceAdjustment: '0',
  sortOrder: 0,
  isActive: true,
}

function formatPriceAdj(adj, symbol) {
  const n = Number(adj ?? 0)
  if (n === 0) return 'Free'
  return `+${symbol} ${n.toFixed(2)}`
}

// ── GroupModal ────────────────────────────────────────────────────────────────
function GroupModal({ initial, onSave, onClose, submitting }) {
  const [form, setForm] = useState(initial ?? emptyGroupForm)

  function set(field) {
    return (eOrVal) => {
      const value = eOrVal && typeof eOrVal === 'object' && 'target' in eOrVal
        ? (eOrVal.target.type === 'checkbox' ? eOrVal.target.checked : eOrVal.target.value)
        : eOrVal
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Group name is required'); return }
    onSave({
      name: form.name.trim(),
      isRequired: Boolean(form.isRequired),
      minSelections: Number(form.minSelections) || 0,
      maxSelections: Number(form.maxSelections) || 1,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: Boolean(form.isActive),
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start sm:items-center justify-center z-50 overflow-y-auto py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">
          {initial ? 'Edit Modifier Group' : 'Add Modifier Group'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Size, Extras, Spice Level"
              autoFocus
              disabled={submitting}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Min Selections
              </label>
              <input
                type="number"
                min="0"
                value={form.minSelections}
                onChange={set('minSelections')}
                disabled={submitting}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Max Selections
              </label>
              <input
                type="number"
                min="1"
                value={form.maxSelections}
                onChange={set('maxSelections')}
                disabled={submitting}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={set('sortOrder')}
              disabled={submitting}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={set('isRequired')}
                disabled={submitting}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={set('isActive')}
                disabled={submitting}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Active</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
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
              {submitting ? 'Saving...' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── OptionModal ───────────────────────────────────────────────────────────────
function OptionModal({ initial, onSave, onClose, submitting }) {
  const [form, setForm] = useState(
    initial
      ? { ...initial, priceAdjustment: String(initial.priceAdjustment ?? '0') }
      : emptyOptionForm
  )

  function set(field) {
    return (eOrVal) => {
      const value = eOrVal && typeof eOrVal === 'object' && 'target' in eOrVal
        ? (eOrVal.target.type === 'checkbox' ? eOrVal.target.checked : eOrVal.target.value)
        : eOrVal
      setForm(f => ({ ...f, [field]: value }))
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Option name is required'); return }
    onSave({
      name: form.name.trim(),
      priceAdjustment: parseFloat(form.priceAdjustment) || 0,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: Boolean(form.isActive),
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start sm:items-center justify-center z-50 overflow-y-auto py-8"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">
          {initial ? 'Edit Option' : 'Add Option'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Option Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Large, Extra Cheese, Very Spicy"
              autoFocus
              disabled={submitting}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Price Adjustment
            </label>
            <PriceInput
              value={form.priceAdjustment}
              onChange={set('priceAdjustment')}
              placeholder="0.00"
              disabled={submitting}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Extra charge added to the base price. Use 0 for no extra charge (Free).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Sort Order
            </label>
            <input
              type="number"
              min="0"
              value={form.sortOrder}
              onChange={set('sortOrder')}
              disabled={submitting}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="opt-active"
              checked={form.isActive}
              onChange={set('isActive')}
              disabled={submitting}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="opt-active" className="text-sm font-medium text-gray-700 dark:text-slate-300 cursor-pointer">
              Active
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
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
              {submitting ? 'Saving...' : initial ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProductModifiers() {
  usePageTitle('Product Modifiers')
  const { id: productId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { symbol } = useCurrency()

  const perms     = user?.permissions ?? []
  const canUpdate = perms.includes('product_update')

  const [productName, setProductName] = useState('')
  const [groups, setGroups]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [expandedIds, setExpandedIds] = useState(new Set())

  // Group modal
  const [groupModal, setGroupModal]     = useState(null)   // null | { mode: 'create'|'edit', group?: {} }
  const [groupSubmitting, setGroupSub]  = useState(false)
  const [confirmDeleteGroupId, setConfirmDeleteGroupId] = useState(null)

  // Option modal
  const [optionModal, setOptionModal]   = useState(null)   // null | { mode, groupId, option? }
  const [optionSubmitting, setOptSub]   = useState(false)
  const [confirmDeleteOpt, setConfirmDeleteOpt] = useState(null) // null | { groupId, optId }

  // ── Fetch groups ────────────────────────────────────────────────────────────
  const fetchGroups = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getModifierGroups(productId)
      const data = res.data?.data ?? res.data ?? []
      setGroups(Array.isArray(data) ? data : [])
    } catch {
      toast.error('Failed to load modifier groups')
    } finally {
      setLoading(false)
    }
  }, [productId])

  // Fetch product name for the header
  useEffect(() => {
    let cancelled = false
    productsApi.getAll(1, 1, '').then(res => {
      // Fallback: just label the page without a name until we have a getById endpoint
    }).catch(() => {})
    // Attempt via a lightweight lookup: fetch the product page that contains this id
    // We rely on navigation state if available, otherwise display "Product #id"
    return () => { cancelled = true }
  }, [productId])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  // Expand first group automatically when loaded
  useEffect(() => {
    if (groups.length > 0) {
      setExpandedIds(new Set([groups[0].id]))
    }
  }, [groups.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard: Escape closes modals ──────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setGroupModal(null)
        setOptionModal(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ── Toggle expand ────────────────────────────────────────────────────────────
  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Group CRUD ───────────────────────────────────────────────────────────────
  async function handleSaveGroup(formData) {
    setGroupSub(true)
    try {
      if (groupModal.mode === 'edit') {
        const res = await updateModifierGroup(groupModal.group.id, {
          ...formData,
          productId: Number(productId),
        })
        const updated = res.data?.data ?? res.data
        setGroups(prev => prev.map(g => g.id === groupModal.group.id ? { ...g, ...updated } : g))
        toast.success('Group updated')
      } else {
        const res = await createModifierGroup({ ...formData, productId: Number(productId) })
        const created = res.data?.data ?? res.data
        setGroups(prev => [...prev, { ...created, options: [] }])
        setExpandedIds(prev => new Set([...prev, created.id]))
        toast.success('Group created')
      }
      setGroupModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save group')
    } finally {
      setGroupSub(false)
    }
  }

  async function handleDeleteGroup(groupId) {
    try {
      await deleteModifierGroup(groupId)
      setGroups(prev => prev.filter(g => g.id !== groupId))
      toast.success('Group deleted')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete group')
    } finally {
      setConfirmDeleteGroupId(null)
    }
  }

  // ── Option CRUD ──────────────────────────────────────────────────────────────
  async function handleSaveOption(formData) {
    setOptSub(true)
    const { groupId, option } = optionModal
    try {
      if (optionModal.mode === 'edit') {
        const res = await updateModifierOption(groupId, option.id, formData)
        const updated = res.data?.data ?? res.data
        setGroups(prev => prev.map(g => g.id === groupId
          ? { ...g, options: (g.options ?? []).map(o => o.id === option.id ? { ...o, ...updated } : o) }
          : g
        ))
        toast.success('Option updated')
      } else {
        const res = await createModifierOption(groupId, formData)
        const created = res.data?.data ?? res.data
        setGroups(prev => prev.map(g => g.id === groupId
          ? { ...g, options: [...(g.options ?? []), created] }
          : g
        ))
        toast.success('Option created')
      }
      setOptionModal(null)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save option')
    } finally {
      setOptSub(false)
    }
  }

  async function handleDeleteOption(groupId, optId) {
    try {
      await deleteModifierOption(groupId, optId)
      setGroups(prev => prev.map(g => g.id === groupId
        ? { ...g, options: (g.options ?? []).filter(o => o.id !== optId) }
        : g
      ))
      toast.success('Option deleted')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete option')
    } finally {
      setConfirmDeleteOpt(null)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/products')}
          className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Back to products"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Settings2 size={20} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Modifier Groups
            {productName ? ` — ${productName}` : ` — Product #${productId}`}
          </h1>
        </div>
        {canUpdate && (
          <button
            onClick={() => setGroupModal({ mode: 'create' })}
            className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Group
          </button>
        )}
      </div>

      {/* Groups list */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-12 text-center">
            <Settings2 size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="text-gray-500 dark:text-slate-400 font-medium">No modifier groups yet</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              Add modifier groups like Size, Extras, or Spice Level
            </p>
            {canUpdate && (
              <button
                onClick={() => setGroupModal({ mode: 'create' })}
                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Plus size={16} />
                Add First Group
              </button>
            )}
          </div>
        ) : (
          groups.map(group => {
            const isExpanded = expandedIds.has(group.id)
            const options = group.options ?? []
            return (
              <div
                key={group.id}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700"
              >
                {/* Group header row */}
                <div className="flex items-center gap-3 p-4">
                  <button
                    onClick={() => toggleExpand(group.id)}
                    className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer flex-shrink-0"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? 'Collapse group' : 'Expand group'}
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>

                  <div className="flex-1 flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-800 dark:text-slate-200">{group.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      group.isRequired
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'
                    }`}>
                      {group.isRequired ? 'Required' : 'Optional'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      Max {group.maxSelections} {group.maxSelections === 1 ? 'selection' : 'selections'}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      group.isActive
                        ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-500'
                    }`}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {options.length} option{options.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {canUpdate && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setGroupModal({ mode: 'edit', group })}
                        className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        aria-label={`Edit group ${group.name}`}
                      >
                        <Edit2 size={13} />
                        Edit
                      </button>
                      {confirmDeleteGroupId === group.id ? (
                        <span className="flex items-center gap-2 text-sm">
                          <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                          <button onClick={() => handleDeleteGroup(group.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                          <button onClick={() => setConfirmDeleteGroupId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteGroupId(group.id)}
                          className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          aria-label={`Delete group ${group.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Options list (expanded) */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-slate-700 px-4 pb-4">
                    {options.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-slate-500 py-3 text-center">
                        No options yet. Add the first option below.
                      </p>
                    ) : (
                      <table className="w-full text-sm mt-3 mb-3">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-slate-700">
                            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Option</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Price Adj.</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sort</th>
                            <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                            {canUpdate && (
                              <th className="text-left py-2 px-2 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {options.map(opt => (
                            <tr key={opt.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                              <td className="py-2 px-2 text-gray-700 dark:text-slate-300 font-medium">{opt.name}</td>
                              <td className="py-2 px-2">
                                <span className={`text-sm font-medium ${Number(opt.priceAdjustment) > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}`}>
                                  {formatPriceAdj(opt.priceAdjustment, symbol)}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-gray-500 dark:text-slate-400 text-xs">{opt.sortOrder ?? 0}</td>
                              <td className="py-2 px-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  opt.isActive
                                    ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400'
                                    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-500'
                                }`}>
                                  {opt.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              {canUpdate && (
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => setOptionModal({ mode: 'edit', groupId: group.id, option: opt })}
                                      className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit2 size={11} />
                                      Edit
                                    </button>
                                    {confirmDeleteOpt?.groupId === group.id && confirmDeleteOpt?.optId === opt.id ? (
                                      <span className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                        <button onClick={() => handleDeleteOption(group.id, opt.id)} className="text-red-600 font-medium hover:underline cursor-pointer text-xs">Yes</button>
                                        <button onClick={() => setConfirmDeleteOpt(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer text-xs">No</button>
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => setConfirmDeleteOpt({ groupId: group.id, optId: opt.id })}
                                        className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {canUpdate && (
                      <button
                        onClick={() => setOptionModal({ mode: 'create', groupId: group.id })}
                        className="mt-1 text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        Add Option
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Group modal */}
      {groupModal && (
        <GroupModal
          initial={groupModal.mode === 'edit' ? groupModal.group : null}
          onSave={handleSaveGroup}
          onClose={() => setGroupModal(null)}
          submitting={groupSubmitting}
        />
      )}

      {/* Option modal */}
      {optionModal && (
        <OptionModal
          initial={optionModal.mode === 'edit' ? optionModal.option : null}
          onSave={handleSaveOption}
          onClose={() => setOptionModal(null)}
          submitting={optionSubmitting}
        />
      )}
    </div>
  )
}

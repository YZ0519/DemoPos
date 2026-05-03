import { useState, useEffect } from 'react'
import { Plus, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import {
  getVouchers,
  createVoucher,
  updateVoucher,
  removeVoucher,
} from '../../api/vouchers'
import productsApi from '../../api/products'
import PriceInput from '../../components/PriceInput'
import SearchableSelect from '../../components/SearchableSelect'
import { formatDate } from '../../lib/utils/dates'

const DISCOUNT_TYPES = [
  { value: 'fixed',      label: 'Fixed Amount' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'override',   label: 'Override Price' },
]

const emptyForm = {
  code:          '',
  name:          '',
  description:   '',
  discountType:  'fixed',
  discountValue: 0,
  validFrom:     '',
  validUntil:    '',
  isActive:      true,
  appliesTo:     'all',
  items:         [], // [{ productId, productName, overridePrice }]
}

export default function Vouchers() {
  const { user } = useAuth()
  const perms     = user?.permissions ?? []
  const canView   = perms.includes('voucher_view')
  const canCreate = perms.includes('voucher_create')
  const canUpdate = perms.includes('voucher_update')
  const canDelete = perms.includes('voucher_delete')

  const [vouchers, setVouchers]                 = useState([])
  const [loading, setLoading]                   = useState(true)
  const [submitting, setSubmitting]             = useState(false)
  const [modalOpen, setModalOpen]               = useState(false)
  const [editingItem, setEditingItem]           = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData]                 = useState(emptyForm)
  const [formError, setFormError]               = useState('')

  // Product list for the "Specific Items" section
  const [allProducts, setAllProducts]           = useState([])
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [itemOverridePrice, setItemOverridePrice] = useState(0)

  useEffect(() => {
    if (!canView) return
    fetchVouchers()
  }, [canView])

  // Load all products once for the item picker (non-critical)
  useEffect(() => {
    if (!canView) return
    productsApi.getAll(1, 999, '')
      .then(res => {
        const d = res.data?.data
        const list = Array.isArray(d) ? d : (d?.items ?? [])
        setAllProducts(list)
      })
      .catch(() => {/* non-critical */})
  }, [canView])

  function fetchVouchers() {
    setLoading(true)
    getVouchers()
      .then(res => setVouchers(res.data?.data ?? []))
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false))
  }

  function openCreateModal() {
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
    setSelectedProductId(null)
    setItemOverridePrice(0)
    setModalOpen(true)
  }

  function openEditModal(item) {
    setEditingItem(item)
    setFormData({
      code:          item.code ?? '',
      name:          item.name ?? '',
      description:   item.description ?? '',
      discountType:  item.discountType ?? 'fixed',
      discountValue: item.discountValue ?? 0,
      validFrom:     item.validFrom ? item.validFrom.slice(0, 10) : '',
      validUntil:    item.validUntil ? item.validUntil.slice(0, 10) : '',
      isActive:      item.isActive ?? true,
      appliesTo:     item.appliesTo ?? 'all',
      items:         item.items ?? [],
    })
    setFormError('')
    setSelectedProductId(null)
    setItemOverridePrice(0)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    setFormData(emptyForm)
    setFormError('')
    setSelectedProductId(null)
    setItemOverridePrice(0)
  }

  function handleField(key, value) {
    setFormData(f => ({ ...f, [key]: value }))
  }

  // Add a product to the specific-items list
  function handleAddItem() {
    if (!selectedProductId) return
    const product = allProducts.find(p => p.id === selectedProductId)
    if (!product) return
    // Prevent duplicates
    if (formData.items.some(i => i.productId === selectedProductId)) {
      toast('Product already added', { icon: 'i' })
      return
    }
    handleField('items', [
      ...formData.items,
      {
        productId:     product.id,
        productName:   product.name,
        overridePrice: Number(itemOverridePrice) || null,
      },
    ])
    setSelectedProductId(null)
    setItemOverridePrice(0)
  }

  function handleRemoveItem(productId) {
    handleField('items', formData.items.filter(i => i.productId !== productId))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.code.trim()) {
      setFormError('Voucher code is required.')
      return
    }
    if (!formData.name.trim()) {
      setFormError('Voucher name is required.')
      return
    }
    if (formData.appliesTo === 'specific_items' && formData.items.length === 0) {
      setFormError('Add at least one product when "Specific Items" is selected.')
      return
    }

    setSubmitting(true)
    setFormError('')

    const payload = {
      code:          formData.code.trim().toUpperCase(),
      name:          formData.name.trim(),
      description:   formData.description.trim() || null,
      discountType:  formData.discountType,
      discountValue: formData.discountType === 'override' ? 0 : Number(formData.discountValue) || 0,
      validFrom:     formData.validFrom || null,
      validUntil:    formData.validUntil || null,
      isActive:      formData.isActive,
      appliesTo:     formData.appliesTo,
      items:         formData.appliesTo === 'specific_items'
        ? formData.items.map(i => ({ productId: i.productId, overridePrice: i.overridePrice ?? null }))
        : [],
    }

    try {
      if (editingItem) {
        const res = await updateVoucher(editingItem.id, payload)
        const updated = res.data?.data
        setVouchers(prev => prev.map(v => v.id === editingItem.id ? updated : v))
        toast.success('Voucher updated successfully')
      } else {
        const res = await createVoucher(payload)
        const created = res.data?.data
        setVouchers(prev => [created, ...prev])
        toast.success('Voucher created successfully')
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
      await removeVoucher(id)
      setVouchers(prev => prev.filter(v => v.id !== id))
      toast.success('Voucher deleted successfully')
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Voucher has been used in sales.')
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to delete voucher')
      }
    } finally {
      setConfirmingDeleteId(null)
    }
  }

  // ── Permission guard ─────────────────────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function discountLabel(v) {
    if (v.discountType === 'percentage') return `${v.discountValue}%`
    if (v.discountType === 'fixed')      return `${v.discountValue} off`
    return 'Override'
  }

  function discountTypeName(type) {
    return DISCOUNT_TYPES.find(d => d.value === type)?.label ?? type
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Vouchers</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Voucher
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
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">#</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Code</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Discount Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Value</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Valid From</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Valid Until</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                        No vouchers found.
                      </td>
                    </tr>
                  ) : (
                    vouchers.map((v, index) => (
                      <tr key={v.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-gray-800 dark:text-slate-200 uppercase">{v.code}</td>
                        <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{v.name}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{discountTypeName(v.discountType)}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{discountLabel(v)}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {v.validFrom ? formatDate(v.validFrom) : <span className="text-gray-300 dark:text-slate-600">{'\u2014'}</span>}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {v.validUntil ? formatDate(v.validUntil) : <span className="text-gray-300 dark:text-slate-600">{'\u2014'}</span>}
                        </td>
                        <td className="py-3 px-4">
                          {v.isActive
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactive</span>
                          }
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {canUpdate && (
                              <button
                                onClick={() => openEditModal(v)}
                                className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 size={13} />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              confirmingDeleteId === v.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button onClick={() => handleDelete(v.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                  <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(v.id)}
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

            {/* Mobile cards */}
            <div className="sm:hidden">
              {vouchers.length === 0 ? (
                <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No vouchers found.</p>
              ) : (
                <div className="space-y-3">
                  {vouchers.map((v) => (
                    <div
                      key={v.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: code + name + status badge + Edit */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-mono font-semibold text-gray-900 dark:text-slate-100 uppercase">{v.code}</span>
                            {v.isActive
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                              : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">Inactive</span>
                            }
                          </div>
                          {v.name && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{v.name}</p>
                          )}
                        </div>
                        <div className="shrink-0">
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(v)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              aria-label={`Edit voucher ${v.code}`}
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
                          <span className="text-gray-500 dark:text-slate-400">Discount</span>
                          <span className="text-gray-700 dark:text-slate-300">{discountTypeName(v.discountType)} {'\u2014'} {discountLabel(v)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Valid From</span>
                          <span className="text-gray-700 dark:text-slate-300">
                            {v.validFrom ? formatDate(v.validFrom) : <span className="text-gray-300 dark:text-slate-600">{'\u2014'}</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Valid Until</span>
                          <span className="text-gray-700 dark:text-slate-300">
                            {v.validUntil ? formatDate(v.validUntil) : <span className="text-gray-300 dark:text-slate-600">{'\u2014'}</span>}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Applies To</span>
                          <span className="text-gray-700 dark:text-slate-300 capitalize">{v.appliesTo === 'specific_items' ? 'Specific Items' : 'All Items'}</span>
                        </div>
                      </div>

                      {/* Bottom: Delete */}
                      {canDelete && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex justify-end">
                          {confirmingDeleteId === v.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                              <button
                                onClick={() => handleDelete(v.id)}
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
                              onClick={() => setConfirmingDeleteId(v.id)}
                              className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              aria-label={`Delete voucher ${v.code}`}
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
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voucher-modal-title"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 id="voucher-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingItem ? 'Edit Voucher' : 'Add Voucher'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                {/* Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={e => handleField('code', e.target.value.toUpperCase())}
                    placeholder="e.g. SAVE10"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 uppercase font-mono"
                    autoFocus
                    disabled={submitting}
                    aria-required="true"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => handleField('name', e.target.value)}
                    placeholder="Voucher name"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting}
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => handleField('description', e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 resize-none"
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Discount Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={e => {
                      handleField('discountType', e.target.value)
                      handleField('discountValue', 0)
                    }}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}
                  >
                    {DISCOUNT_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Discount Value — hidden for override type */}
                {formData.discountType !== 'override' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Discount Value {formData.discountType === 'percentage' ? '(%)' : ''}
                    </label>
                    <PriceInput
                      value={formData.discountValue}
                      onChange={val => handleField('discountValue', parseFloat(val) || 0)}
                      placeholder="0.00"
                      disabled={submitting}
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Valid From */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={formData.validFrom}
                    onChange={e => handleField('validFrom', e.target.value)}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}
                  />
                </div>

                {/* Valid Until */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={formData.validUntil}
                    onChange={e => handleField('validUntil', e.target.value)}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Is Active */}
              <div className="flex items-center gap-2">
                <input
                  id="voucher-isActive"
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={e => handleField('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={submitting}
                />
                <label htmlFor="voucher-isActive" className="text-sm font-medium text-gray-700 dark:text-slate-300 cursor-pointer">
                  Is Active
                </label>
              </div>

              {/* Applies To */}
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Applies To</p>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="appliesTo"
                      value="all"
                      checked={formData.appliesTo === 'all'}
                      onChange={() => handleField('appliesTo', 'all')}
                      disabled={submitting}
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">All Items</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="appliesTo"
                      value="specific_items"
                      checked={formData.appliesTo === 'specific_items'}
                      onChange={() => handleField('appliesTo', 'specific_items')}
                      disabled={submitting}
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">Specific Items</span>
                  </label>
                </div>
              </div>

              {/* Specific Items section */}
              {formData.appliesTo === 'specific_items' && (
                <div className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Add Products</p>

                  {/* Product picker row */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <SearchableSelect
                        options={allProducts.map(p => ({ id: p.id, name: p.name }))}
                        value={selectedProductId}
                        onChange={setSelectedProductId}
                        placeholder="Search product..."
                        disabled={submitting}
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Override Price</label>
                      <PriceInput
                        value={itemOverridePrice}
                        onChange={val => setItemOverridePrice(parseFloat(val) || 0)}
                        placeholder="Optional"
                        disabled={submitting}
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      disabled={!selectedProductId || submitting}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  {/* Added items table */}
                  {formData.items.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-slate-700">
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 dark:text-slate-400">Product</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500 dark:text-slate-400">Override Price</th>
                          <th className="py-2 px-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.items.map(item => (
                          <tr key={item.productId} className="border-b border-gray-50 dark:border-slate-700">
                            <td className="py-1.5 px-2 text-gray-700 dark:text-slate-300">{item.productName}</td>
                            <td className="py-1.5 px-2 text-right text-gray-600 dark:text-slate-400">
                              {item.overridePrice ? item.overridePrice : <span className="text-gray-300 dark:text-slate-600">&mdash;</span>}
                            </td>
                            <td className="py-1.5 px-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.productId)}
                                className="text-red-400 hover:text-red-600 text-xs cursor-pointer"
                                aria-label={`Remove ${item.productName}`}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {formData.items.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 text-center py-2">No products added yet.</p>
                  )}
                </div>
              )}

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

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Image, Search, Settings2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import productsApi from '../../api/products'
import categoriesApi from '../../api/categories'
import brandsApi from '../../api/brands'
import unitsApi from '../../api/units'
import { getTemplates } from '../../api/assembly'
import { useAuth } from '../../context/AuthContext'
import { MEDIA_HOST } from '../../api/axios'
import PriceInput from '../../components/PriceInput'
import SearchableSelect from '../../components/SearchableSelect'
import usePageTitle from '../../hooks/usePageTitle'

const PAGE_SIZE = 20

const emptyForm = {
  name: '', sku: '', description: '',
  categoryId: '', brandId: '', unitId: '',
  price: '', purchasePrice: '', quantity: '0',
  discountType: '', discount: '',
  expireDate: '', status: true, posEnabled: false, image: null,
  autoAssemblyTemplateId: '',
}

function computeDiscountedPrice(price, discount, discountType) {
  const p = parseFloat(price) || 0
  const d = parseFloat(discount) || 0
  if (discountType === 'fixed') return Math.max(0, Math.round((p - d) * 100) / 100)
  if (discountType === 'percentage') return Math.max(0, Math.round((p - p * d / 100) * 100) / 100)
  return p
}

export default function Products() {
  usePageTitle('Products')
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const perms    = user?.permissions ?? []
  const canView   = perms.includes('product_view')
  const canCreate = perms.includes('product_create')
  const canUpdate = perms.includes('product_update')
  const canDelete = perms.includes('product_delete')

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [units, setUnits] = useState([])
  /** Split-type assembly templates for the Auto Assembly selector */
  const [splitTemplates, setSplitTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkSubmitting, setBulkSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [imagePreview, setImagePreview] = useState(null)
  const [formError, setFormError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  /** Tracks the current blob URL so we can revoke it when it changes or on unmount. */
  const blobUrlRef = useRef(null)
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
    fetchAll()
  }, [canView, page, debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke any blob URL when the component unmounts to prevent memory leaks.
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [])

  // Close modal when Escape key is pressed
  useEffect(() => {
    if (!modalOpen) return
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeModal()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  function fetchAll() {
    setLoading(true)
    // Lookup tables (categories, brands, units, templates) only loaded once on first mount.
    // Products are re-fetched on every page/search change.
    const needsLookups = categories.length === 0
    const lookupPromises = needsLookups
      ? [categoriesApi.getAll(), brandsApi.getAll(), unitsApi.getAll(), getTemplates(1, 200)]
      : [Promise.resolve(null), Promise.resolve(null), Promise.resolve(null), Promise.resolve(null)]

    Promise.all([
      productsApi.getAll(page, PAGE_SIZE, debouncedSearch),
      ...lookupPromises,
    ])
      .then(([prodRes, catRes, brandRes, unitRes, tplRes]) => {
        // Products
        const d = prodRes.data?.data
        if (Array.isArray(d)) {
          setProducts(d)
          setTotalPages(1)
        } else {
          setProducts(d?.items ?? [])
          setTotalPages(Math.ceil((d?.totalCount ?? 0) / PAGE_SIZE) || 1)
        }
        // Lookups (only set when fetched)
        if (catRes)    setCategories(catRes.data?.data ?? [])
        if (brandRes)  setBrands(brandRes.data?.data ?? [])
        if (unitRes)   setUnits(unitRes.data?.data ?? [])
        if (tplRes) {
          const tplData = tplRes.data?.data
          const allTpls = Array.isArray(tplData) ? tplData : (tplData?.items ?? [])
          setSplitTemplates(allTpls.filter((t) => t.assemblyType === 'split' && t.isActive))
        }
      })
      .catch(() => toast.error('Failed to load data'))
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
    setFormData({
      name: item.name,
      sku: item.sku,
      description: item.description ?? '',
      categoryId: item.categoryId ?? '',
      brandId: item.brandId ?? '',
      unitId: item.unitId ?? '',
      price: item.price?.toString() ?? '',
      purchasePrice: item.purchasePrice?.toString() ?? '',
      quantity: item.quantity?.toString() ?? '0',
      discountType: item.discountType ?? '',
      discount: item.discount?.toString() ?? '',
      expireDate: item.expireDate ?? '',
      status: item.status,
      posEnabled: item.posEnabled ?? false,
      image: null,
      autoAssemblyTemplateId: item.autoAssemblyTemplateId?.toString() ?? '',
    })
    setImagePreview(item.image ? `${MEDIA_HOST}/${item.image}` : null)
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    // Revoke the blob URL if one was created during this modal session
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setModalOpen(false)
    setEditingItem(null)
    setFormData(emptyForm)
    setImagePreview(null)
    setFormError('')
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke any previous blob URL before creating a new one
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(file)
    blobUrlRef.current = objectUrl
    setFormData((f) => ({ ...f, image: file }))
    setImagePreview(objectUrl)
  }

  /**
   * Returns a setter for `field` that accepts either a native event (from plain
   * <input>/<select> elements) or a raw value (from PriceInput which calls
   * onChange(rawString) directly without wrapping in a synthetic event).
   */
  function set(field) {
    return (eOrValue) => {
      const value = eOrValue && typeof eOrValue === 'object' && 'target' in eOrValue
        ? eOrValue.target.value
        : eOrValue
      setFormData((f) => ({ ...f, [field]: value }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.name.trim()) { setFormError('Product name is required.'); return }
    if (!formData.sku.trim()) { setFormError('SKU is required.'); return }
    if (!formData.price) { setFormError('Price is required.'); return }
    setSubmitting(true)
    setFormError('')

    const fd = new FormData()
    fd.append('name', formData.name.trim())
    fd.append('sku', formData.sku.trim())
    fd.append('description', formData.description.trim())
    if (formData.categoryId) fd.append('categoryId', formData.categoryId)
    if (formData.brandId) fd.append('brandId', formData.brandId)
    if (formData.unitId) fd.append('unitId', formData.unitId)
    fd.append('price', formData.price || '0')
    fd.append('purchasePrice', formData.purchasePrice || '0')
    fd.append('quantity', formData.quantity || '0')
    if (formData.discountType) {
      fd.append('discountType', formData.discountType)
      fd.append('discount', formData.discount || '0')
    }
    if (formData.expireDate) fd.append('expireDate', formData.expireDate)
    fd.append('status', formData.status)
    fd.append('posEnabled', formData.posEnabled)
    if (formData.image) fd.append('image', formData.image)
    if (formData.autoAssemblyTemplateId) {
      fd.append('autoAssemblyTemplateId', formData.autoAssemblyTemplateId)
    } else {
      // Explicitly clear — send empty string so backend can null it out
      fd.append('autoAssemblyTemplateId', '')
    }

    try {
      if (editingItem) {
        const res = await productsApi.update(editingItem.id, fd)
        const updated = res.data?.data
        setProducts((prev) => prev.map((p) => (p.id === editingItem.id ? updated : p)))
        toast.success('Product updated successfully')
      } else {
        await productsApi.create(fd)
        // Go to page 1 so the new product is visible
        setPage(1)
        setDebouncedSearch('')
        setSearch('')
        toast.success('Product created successfully')
      }
      closeModal()
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleInlineTogglePosEnabled(product) {
    if (!canUpdate) return
    const newValue = !product.posEnabled
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, posEnabled: newValue } : p))
    )
    try {
      await productsApi.bulkSetPosEnabled([product.id], newValue)
    } catch (err) {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, posEnabled: !newValue } : p))
      )
      toast.error(err.response?.data?.message ?? 'Failed to update POS status')
    }
  }

  function handleRowCheck(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      checked ? next.add(id) : next.delete(id)
      return next
    })
  }

  function handleSelectAll(checked) {
    setSelectedIds(checked ? new Set(products.map((p) => p.id)) : new Set())
  }

  async function handleBulkTogglePosEnabled(enable) {
    if (selectedIds.size === 0) return
    setBulkSubmitting(true)
    const ids = [...selectedIds]
    try {
      await productsApi.bulkSetPosEnabled(ids, enable)
      setProducts((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, posEnabled: enable } : p))
      )
      setSelectedIds(new Set())
      toast.success(`${ids.length} product(s) ${enable ? 'enabled' : 'disabled'} for POS`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Bulk update failed')
    } finally {
      setBulkSubmitting(false)
    }
  }

  async function handleDelete(id) {
    try {
      await productsApi.remove(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Product deleted successfully')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete product')
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

  const previewDiscounted = computeDiscountedPrice(formData.price, formData.discount, formData.discountType)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Products</h1>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} />
            Add Product
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
            placeholder="Search products..."
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
          {canUpdate && selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl">
              <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => handleBulkTogglePosEnabled(true)}
                disabled={bulkSubmitting}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Enable for POS
              </button>
              <button
                onClick={() => handleBulkTogglePosEnabled(false)}
                disabled={bulkSubmitting}
                className="text-sm bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 px-3 py-1 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              >
                Disable for POS
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                disabled={bulkSubmitting}
                className="ml-auto text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
              >
                Clear selection
              </button>
            </div>
          )}
          {/* ── Desktop table (sm and above) ──────────────────────────────────── */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  {canUpdate && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={products.length > 0 && selectedIds.size === products.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        aria-label="Select all products"
                      />
                    </th>
                  )}
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-16">Image</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">POS</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={canUpdate ? 10 : 9} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No products found.</td>
                  </tr>
                ) : (
                  products.map((product, index) => {
                    const hasDiscount = product.discountType && product.discountedPrice < product.price
                    return (
                      <tr key={product.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                        {canUpdate && (
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(product.id)}
                              onChange={(e) => handleRowCheck(product.id, e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              aria-label={`Select ${product.name}`}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{(page - 1) * PAGE_SIZE + index + 1}</td>
                        <td className="py-3 px-4">
                          {product.image ? (
                            <img
                              src={`${MEDIA_HOST}/${product.image}`}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover"
                              onError={(e) => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                              <Image size={16} className="text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-gray-700 dark:text-slate-300 font-medium">{product.name}</p>
                            {product.productType === 'combo' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                                Combo
                              </span>
                            )}
                          </div>
                          {product.categoryName && (
                            <p className="text-xs text-gray-400 dark:text-slate-500">{product.categoryName}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-500 dark:text-slate-400 font-mono text-xs">{product.sku}</td>
                        <td className="py-3 px-4">
                          <span className="text-gray-700 dark:text-slate-300 font-medium">{product.discountedPrice}</span>
                          {hasDiscount && (
                            <span className="ml-1 text-xs text-gray-400 dark:text-slate-500 line-through">{product.price}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                          {product.quantity} {product.unitShortName && (
                            <span className="text-gray-400 dark:text-slate-500 text-xs">{product.unitShortName}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            product.status ? 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                          }`}>
                            {product.status ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {canUpdate ? (
                            <button
                              onClick={() => handleInlineTogglePosEnabled(product)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                product.posEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                              }`}
                              role="switch"
                              aria-checked={product.posEnabled}
                              aria-label={`Toggle POS visibility for ${product.name}`}
                              title={product.posEnabled ? 'Visible in POS — click to hide' : 'Hidden from POS — click to show'}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  product.posEnabled ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              product.posEnabled ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                            }`}>
                              {product.posEnabled ? 'POS' : 'Off'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            {canUpdate && (
                              <button
                                onClick={() => openEditModal(product)}
                                className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Edit2 size={13} />
                                Edit
                              </button>
                            )}
                            {canUpdate && (
                              <button
                                onClick={() => navigate(`/products/${product.id}/modifiers`)}
                                className="bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="Manage modifier groups"
                              >
                                <Settings2 size={13} />
                                Modifiers
                              </button>
                            )}
                            {canUpdate && product.productType === 'combo' && (
                              <button
                                onClick={() => navigate(`/products/${product.id}/combo-items`)}
                                className="bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="Manage combo components"
                              >
                                <Package size={13} />
                                Components
                              </button>
                            )}
                            {canDelete && (
                              confirmingDeleteId === product.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button onClick={() => handleDelete(product.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                  <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(product.id)}
                                  className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
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
            {products.length === 0 ? (
              <p className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">No products found.</p>
            ) : (
              <div className="space-y-3">
                {products.map((product) => {
                  const hasDiscount = product.discountType && product.discountedPrice < product.price
                  return (
                    <div
                      key={product.id}
                      className="border border-gray-100 dark:border-slate-700 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-700/30"
                    >
                      {/* Top row: image + name + Edit button */}
                      <div className="flex items-start gap-3">
                        {product.image ? (
                          <img
                            src={`${MEDIA_HOST}/${product.image}`}
                            alt={product.name}
                            className="w-12 h-12 rounded-lg object-cover shrink-0"
                            onError={(e) => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            <Image size={16} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{product.name}</span>
                            {product.productType === 'combo' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">
                                Combo
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              product.status ? 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                            }`}>
                              {product.status ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {product.categoryName && (
                            <p className="text-xs text-gray-400 dark:text-slate-500">{product.categoryName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canUpdate && (
                            <button
                              onClick={() => handleInlineTogglePosEnabled(product)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                                product.posEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                              }`}
                              role="switch"
                              aria-checked={product.posEnabled}
                              aria-label={`Toggle POS visibility for ${product.name}`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  product.posEnabled ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          )}
                          {canUpdate && (
                            <button
                              onClick={() => openEditModal(product)}
                              className="bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
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
                          <span className="text-gray-500 dark:text-slate-400 font-mono text-xs">SKU: {product.sku}</span>
                          <span className="text-gray-600 dark:text-slate-400">
                            Stock: {product.quantity}{product.unitShortName ? ` ${product.unitShortName}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">Price</span>
                          <span>
                            <span className="text-gray-700 dark:text-slate-300 font-medium">{product.discountedPrice}</span>
                            {hasDiscount && (
                              <span className="ml-1 text-xs text-gray-400 dark:text-slate-500 line-through">{product.price}</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 dark:text-slate-400">POS</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            product.posEnabled ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                          }`}>
                            {product.posEnabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>

                      {/* Bottom row: Modifiers, Components, Delete */}
                      {(canUpdate || canDelete) && (
                        <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-600 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            {canUpdate && (
                              <button
                                onClick={() => navigate(`/products/${product.id}/modifiers`)}
                                className="bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-600 dark:text-slate-300 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Settings2 size={12} />
                                Modifiers
                              </button>
                            )}
                            {canUpdate && product.productType === 'combo' && (
                              <button
                                onClick={() => navigate(`/products/${product.id}/combo-items`)}
                                className="bg-purple-50 dark:bg-purple-900/40 hover:bg-purple-100 text-purple-600 dark:text-purple-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <Package size={12} />
                                Components
                              </button>
                            )}
                          </div>
                          {canDelete && (
                            <div className="flex justify-end">
                              {confirmingDeleteId === product.id ? (
                                <span className="flex items-center gap-2 text-sm">
                                  <span className="text-gray-600 dark:text-slate-400">Delete?</span>
                                  <button onClick={() => handleDelete(product.id)} className="text-red-600 font-medium hover:underline cursor-pointer">Yes</button>
                                  <button onClick={() => setConfirmingDeleteId(null)} className="text-gray-500 dark:text-slate-400 hover:underline cursor-pointer">No</button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setConfirmingDeleteId(product.id)}
                                  className="bg-red-50 dark:bg-red-900/40 hover:bg-red-100 text-red-600 dark:text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-8"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-5">
              {editingItem ? 'Edit Product' : 'Add Product'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name + SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Name *</label>
                  <input type="text" value={formData.name} onChange={set('name')}
                    placeholder="Product name"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    autoFocus disabled={submitting} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">SKU *</label>
                  <input type="text" value={formData.sku} onChange={set('sku')}
                    placeholder="Unique SKU"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting} />
                </div>
              </div>

              {/* Category + Brand + Unit */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Category</label>
                  <select value={formData.categoryId} onChange={set('categoryId')}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}>
                    <option value="">— None —</option>
                    {categories.filter((c) => c.status).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Brand</label>
                  <select value={formData.brandId} onChange={set('brandId')}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}>
                    <option value="">— None —</option>
                    {brands.filter((b) => b.status).map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Unit</label>
                  <select value={formData.unitId} onChange={set('unitId')}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}>
                    <option value="">— None —</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.title} ({u.shortName})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price + Purchase Price + Quantity */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Sale Price *</label>
                  <PriceInput
                    value={formData.price}
                    onChange={set('price')}
                    placeholder="0.00"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Purchase Price</label>
                  <PriceInput
                    value={formData.purchasePrice}
                    onChange={set('purchasePrice')}
                    placeholder="0.00"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Quantity</label>
                  <input type="number" min="0" value={formData.quantity} onChange={set('quantity')}
                    placeholder="0"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting} />
                </div>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Discount Type</label>
                  <select value={formData.discountType} onChange={set('discountType')}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}>
                    <option value="">— No discount —</option>
                    <option value="fixed">Fixed amount</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>
                {formData.discountType && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Discount {formData.discountType === 'percentage' ? '(%)' : '(amount)'}
                    </label>
                    <PriceInput
                      value={formData.discount}
                      onChange={set('discount')}
                      placeholder="0.00"
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                      disabled={submitting}
                    />
                  </div>
                )}
              </div>

              {/* Discounted price preview */}
              {formData.discountType && formData.price && (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Selling price after discount: <span className="font-semibold text-green-600">{previewDiscounted}</span>
                </p>
              )}

              {/* Expire date + Status */}
              <div className="grid grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Expire Date</label>
                  <input type="date" value={formData.expireDate} onChange={set('expireDate')}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting} />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <input id="prod-status" type="checkbox" checked={formData.status}
                    onChange={(e) => setFormData((f) => ({ ...f, status: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={submitting} />
                  <label htmlFor="prod-status" className="text-sm font-medium text-gray-700 dark:text-slate-300">Active</label>
                </div>
              </div>

              {/* POS Enabled */}
              <div className="flex items-center gap-2">
                <input
                  id="prod-pos-enabled"
                  type="checkbox"
                  checked={formData.posEnabled}
                  onChange={(e) => setFormData((f) => ({ ...f, posEnabled: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  disabled={submitting}
                />
                <label htmlFor="prod-pos-enabled" className="text-sm font-medium text-gray-700 dark:text-slate-300">
                  Show in POS Terminal
                </label>
                <span className="text-xs text-gray-400 dark:text-slate-500">
                  When unchecked, this product will not appear in the POS product browser or search
                </span>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <textarea value={formData.description} onChange={set('description')}
                  placeholder="Optional product description"
                  rows={2}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                  disabled={submitting} />
              </div>

              {/* Auto Assembly */}
              <div className="pt-1 border-t border-gray-100 dark:border-slate-700">
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">Auto Assembly</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Assembly Template</label>
                  <SearchableSelect
                    options={[
                      { id: '', name: '— None —' },
                      ...splitTemplates.map((t) => ({ id: t.id, name: t.name })),
                    ]}
                    value={formData.autoAssemblyTemplateId}
                    onChange={(id) => setFormData((f) => ({ ...f, autoAssemblyTemplateId: id === '' ? '' : id.toString() }))}
                    placeholder="Select a Split template..."
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    If set, this product will be automatically assembled using the selected template whenever it is purchased.
                    Only active Split templates are shown.
                  </p>
                  {formData.autoAssemblyTemplateId && (
                    <button
                      type="button"
                      onClick={() => setFormData((f) => ({ ...f, autoAssemblyTemplateId: '' }))}
                      className="mt-1 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                      disabled={submitting}
                    >
                      Clear auto assembly
                    </button>
                  )}
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Image</label>
                {imagePreview && (
                  <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover mb-2" />
                )}
                <input type="file" accept="image/*" onChange={handleImageChange}
                  className="w-full text-sm text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 dark:file:bg-blue-900/40 file:text-blue-600 dark:file:text-blue-400 file:text-sm file:cursor-pointer"
                  disabled={submitting} />
              </div>

              {formError && <p className="text-xs text-red-600">{formError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 dark:border-slate-700">
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

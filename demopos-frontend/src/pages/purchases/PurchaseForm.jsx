import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPurchaseById, createOrUpdatePurchase } from '../../api/purchases'
import { getAllSuppliers } from '../../api/suppliers'
import productsApi from '../../api/products'
import { useAuth } from '../../context/AuthContext'
import paymentMethodsApi from '../../api/payment-methods'
import { getAll as getSettings } from '../../api/settings'
import { applyCashRounding } from '../../lib/utils/rounding'
import { today } from '../../lib/utils/dates'
import SearchableSelect from '../../components/SearchableSelect'
import PriceInput from '../../components/PriceInput'
import { DISCOUNT_TYPE } from '../../constants/discountTypes'
import useProductSearch from '../../hooks/useProductSearch'

export default function PurchaseForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const perms = user?.permissions ?? []
  const canCreate = perms.includes('purchase_create')
  const canUpdate = perms.includes('purchase_update')
  const hasAccess = isEdit ? canUpdate : canCreate

  const [purchase, setPurchase] = useState(null)
  const [suppliers, setSuppliers] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [paymentMethodId, setPaymentMethodId] = useState(null)
  const [items, setItems] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [date, setDate] = useState(() => today())
  const [tax, setTax] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [discountType, setDiscountType] = useState(DISCOUNT_TYPE.FIXED)
  const [shipping, setShipping] = useState(0)
  const [note, setNote] = useState('')
  const {
    productSearch, searchResults, searching, loadingMore, hasMore, dropdownOpen,
    handleProductSearchChange, handleSearchFocus, handleSearchBlur,
    handleDropdownScroll, resetSearch,
  } = useProductSearch(productsApi.searchAll)

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [purchaseRoundingEnabled, setPurchaseRoundingEnabled] = useState(false)
  const [purchaseRoundingQuantum, setPurchaseRoundingQuantum] = useState(0.05)

  // Load suppliers, payment methods, and settings on mount
  useEffect(() => {
    getAllSuppliers()
      .then(res => {
        const list = res.data?.data
        setSuppliers(Array.isArray(list) ? list : [])
      })
      .catch(() => toast.error('Failed to load suppliers'))

    paymentMethodsApi.getActive()
      .then(res => {
        const pmList = res.data?.data ?? []
        setPaymentMethods(pmList)
        if (!id) {
          const defaultPm = pmList.find(pm => pm.isDefault) ?? pmList[0] ?? null
          setPaymentMethodId(defaultPm?.id ?? null)
        }
      })
      .catch(() => {})

    getSettings()
      .then(res => {
        const s = res.data?.data ?? {}
        setPurchaseRoundingEnabled(s.purchase_rounding_enabled === 'true')
        setPurchaseRoundingQuantum(s.purchase_rounding_quantum === '0.10' ? 0.10 : 0.05)
      })
      .catch(() => {})
  }, [])

  // Load purchase in edit mode
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPurchaseById(id)
      .then(res => {
        const p = res.data?.data
        if (!p) return
        setSupplierId(String(p.supplierId ?? ''))
        setDate(
          p.date
            ? new Date(p.date).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)
        )
        setTax(p.tax ?? 0)
        setDiscount(p.discount ?? 0)
        setDiscountType(p.discountType ?? DISCOUNT_TYPE.FIXED)
        setShipping(p.shipping ?? 0)
        setNote(p.note ?? '')
        setPaymentMethodId(p.paymentMethodId ?? null)
        setItems(
          (p.items ?? []).map(item => ({
            itemId: item.id,
            productId: item.productId,
            productName: item.productName,
            purchasePrice: item.purchasePrice,
            price: item.price,
            qty: item.quantity,
          }))
        )
      })
      .catch(() => toast.error('Failed to load purchase'))
      .finally(() => setLoading(false))
  }, [id])

  function addProduct(product) {
    const existing = items.findIndex(i => i.productId === product.id)
    if (existing >= 0) {
      setItems(prev =>
        prev.map((it, idx) =>
          idx === existing ? { ...it, qty: Number(it.qty) + 1 } : it
        )
      )
    } else {
      setItems(prev => [
        ...prev,
        {
          itemId: null,
          productId: product.id,
          productName: product.name,
          purchasePrice: Number(product.purchasePrice ?? product.price ?? 0),
          price: Number(product.discountedPrice ?? product.price ?? 0),
          qty: 1,
        },
      ])
    }
    resetSearch()
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx, field, value) {
    setItems(prev =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    )
  }

  // Derived totals
  const subTotal = items.reduce(
    (sum, it) => sum + Number(it.purchasePrice) * Number(it.qty),
    0
  )
  const resolvedDiscount =
    discountType === DISCOUNT_TYPE.PERCENT
      ? (subTotal * Number(discount)) / 100
      : Number(discount)
  const grandTotal = Math.max(0, subTotal + Number(tax) + Number(shipping) - resolvedDiscount)

  const selectedPm    = paymentMethods.find(pm => pm.id === paymentMethodId) ?? null
  const isCashPayment = !(selectedPm?.autoFillAmount ?? false)
  const shouldRound   = purchaseRoundingEnabled && isCashPayment && grandTotal > 0

  const { roundedTotal: purchaseRoundedTotal, roundingAdjustment: purchaseRoundingAdj } = shouldRound
    ? applyCashRounding(grandTotal, purchaseRoundingQuantum)
    : { roundedTotal: grandTotal, roundingAdjustment: 0 }

  function handleCancel() {
    if (isEdit) {
      navigate(`/purchases/${id}/products`)
    } else {
      navigate('/purchases')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!supplierId) {
      toast.error('Please select a supplier')
      return
    }
    if (items.length === 0) {
      toast.error('Add at least one product')
      return
    }
    if (items.some(it => Number(it.qty) <= 0 || Number(it.purchasePrice) < 0)) {
      toast.error('All items must have a valid quantity and purchase price')
      return
    }

    setSaving(true)
    const payload = {
      purchaseId:      id ? parseInt(id) : null,
      supplierId:      parseInt(supplierId),
      date:            date || null,
      note:            note.trim() || null,
      paymentMethodId: paymentMethodId ?? null,
      products: items.map(it => ({
        id: it.productId,
        itemId: it.itemId ?? null,
        purchasePrice: Number(it.purchasePrice),
        price: Number(it.price),
        qty: Number(it.qty),
      })),
      totals: {
        subTotal: Number(subTotal.toFixed(2)),
        tax: Number(tax),
        discount: Number(discount),
        discountType,
        shipping: Number(shipping),
        grandTotal: Number(grandTotal.toFixed(2)),
      },
    }

    try {
      await createOrUpdatePurchase(payload)
      toast.success(isEdit ? 'Purchase updated successfully' : 'Purchase created successfully')
      navigate('/purchases')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          type="button"
          onClick={handleCancel}
          className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            {isEdit ? `Edit Purchase #${id}` : 'New Purchase'}
          </h1>
          {isEdit && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Supplier and items can be updated. Grand total will be recalculated.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="purchase-form"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Purchase' : 'Save Purchase'}
          </button>
        </div>
      </div>

      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Top two-column grid: Purchase Details | Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Details card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">
              Purchase Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Supplier</label>
                <SearchableSelect
                  options={suppliers}
                  value={supplierId}
                  onChange={id => setSupplierId(String(id))}
                  placeholder="— Select Supplier —"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Totals card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-4">
              Totals
            </h2>
            <div className="space-y-3">
              {/* Sub Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-slate-400">Sub Total</span>
                <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{subTotal.toFixed(2)}</span>
              </div>

              {/* Tax */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-slate-400">Tax</span>
                <PriceInput
                  value={tax}
                  onChange={setTax}
                  className="w-32 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              {/* Discount */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-slate-400">Discount</span>
                <div className="flex items-center gap-2">
                  <PriceInput
                    value={discount}
                    onChange={setDiscount}
                    className="w-24 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <select
                    value={discountType}
                    onChange={e => setDiscountType(e.target.value)}
                    className="border border-gray-200 dark:border-slate-600 rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value={DISCOUNT_TYPE.FIXED}>Fixed</option>
                    <option value={DISCOUNT_TYPE.PERCENT}>%</option>
                  </select>
                </div>
              </div>

              {/* Shipping */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-slate-400">Shipping</span>
                <PriceInput
                  value={shipping}
                  onChange={setShipping}
                  className="w-32 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>

              {/* Payment Method */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-600 dark:text-slate-400">Payment Method</span>
                <select
                  value={paymentMethodId ?? ''}
                  onChange={e => setPaymentMethodId(Number(e.target.value) || null)}
                  className="w-40 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">— None —</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>

              {/* Rounding adjustment row — shown only when active and non-zero */}
              {shouldRound && purchaseRoundingAdj !== 0 && (
                <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 italic">
                  <span>Rounding</span>
                  <span>{purchaseRoundingAdj > 0 ? '+' : ''}{purchaseRoundingAdj.toFixed(2)}</span>
                </div>
              )}

              {/* Divider + Grand Total */}
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">Grand Total</span>
                  <span className="text-lg font-bold text-blue-600">
                    {(shouldRound ? purchaseRoundedTotal : grandTotal).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>{/* end top grid */}

        {/* Product search */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-3">
            Add Products
          </label>
          <div className="relative">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search products by name..."
                value={productSearch}
                onChange={e => handleProductSearchChange(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search results dropdown */}
            {dropdownOpen && (searchResults.length > 0 || searching) && (
              <div
                className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-60 overflow-y-auto"
                onScroll={handleDropdownScroll}
              >
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => addProduct(p)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 text-sm cursor-pointer dark:text-slate-200"
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-gray-400 dark:text-slate-500 ml-2">(stock: {p.quantity ?? 0})</span>
                    <span className="float-right text-blue-600">
                      {Number(p.price ?? 0).toFixed(2)}
                    </span>
                  </button>
                ))}

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex items-center justify-center py-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">Loading more...</span>
                  </div>
                )}

                {/* End of list indicator */}
                {!hasMore && searchResults.length > 0 && !loadingMore && !searching && (
                  <p className="text-center text-xs text-gray-400 dark:text-slate-500 py-2">No more products</p>
                )}
              </div>
            )}

            {/* No results state */}
            {dropdownOpen && !searching && searchResults.length === 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg">
                <p className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500">No products found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Line items table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-4">
            Purchase Items
          </h2>
          {items.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">No products added yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700">
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      #
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      Product
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      Purchase Price
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      Selling Price
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      Qty
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      Row Total
                    </th>
                    <th className="py-3 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 dark:border-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{idx + 1}</td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-sm font-medium">
                        {item.productName}
                      </td>
                      <td className="py-3 px-4">
                        <PriceInput
                          value={item.purchasePrice}
                          onChange={val => updateItem(idx, 'purchasePrice', val)}
                          className="w-28 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <PriceInput
                          value={item.price}
                          onChange={val => updateItem(idx, 'price', val)}
                          className="w-28 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.qty}
                          onChange={e => updateItem(idx, 'qty', e.target.value)}
                          className="w-20 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-sm">
                        {(Number(item.purchasePrice) * Number(item.qty)).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom action bar */}
        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Purchase' : 'Save Purchase'}
          </button>
        </div>
      </form>
    </div>
  )
}

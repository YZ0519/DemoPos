import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, Search, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOrderById, updateOrder, createOrderDirect, collectDue } from '../../api/sales'
import { getAllCustomers } from '../../api/customers'
import productsApi from '../../api/products'
import paymentMethodsApi from '../../api/payment-methods'
import { useAuth } from '../../context/AuthContext'
import SearchableSelect from '../../components/SearchableSelect'
import PriceInput from '../../components/PriceInput'
import { getAll as getSettings } from '../../api/settings'
import { applyCashRounding } from '../../lib/utils/rounding'
import { today } from '../../lib/utils/dates'
import useProductSearch from '../../hooks/useProductSearch'

/**
 * OrderForm page — creates a new order (create mode) or edits an existing one (edit mode).
 *
 * Create mode: /sales/create — no id param
 * Edit mode:   /sales/:id/edit — has id param
 *
 * Business rules:
 * - Create mode requires `sale_create` permission.
 * - Edit mode requires `sale_update` permission.
 * - SubTotal = sum of (item.price × item.quantity); Total = SubTotal − Discount.
 * - Edit mode: paid/transactions are read-only; warns if Total < Paid.
 * - Create mode: accepts Paid + optional PaymentMethodId.
 */
export default function OrderForm() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const isCreate = !id

  const perms     = user?.permissions ?? []
  const canCreate = perms.includes('sale_create')
  const canEdit   = perms.includes('sale_update')
  const hasAccess = isCreate ? canCreate : canEdit

  // ─── data loading state ───────────────────────────────────────────────
  const [order, setOrder]                   = useState(null)
  const [customers, setCustomers]           = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [loading, setLoading]               = useState(true)

  // ─── form state ───────────────────────────────────────────────────────
  const [orderDate, setOrderDate]           = useState(() => today())
  const [customerId, setCustomerId]         = useState('')
  const [note, setNote]                     = useState('')
  const [discount, setDiscount]             = useState(0)
  const [paid, setPaid]                     = useState(0)
  const [paymentMethodId, setPaymentMethodId] = useState('')
  /** The full payment method object for the currently selected id (create mode only). */
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null)

  // ─── edit-mode payment state ──────────────────────────────────────────
  const [editPaymentMethodId, setEditPaymentMethodId]           = useState('')
  const [editSelectedPaymentMethod, setEditSelectedPaymentMethod] = useState(null)
  const [editPaidAmount, setEditPaidAmount]                     = useState('')
  const [editTransactionId, setEditTransactionId]               = useState('')

  /**
   * editItems: the order's line-items as editable rows.
   * Each row shape:
   *   { _key, id, productId, productName, productSku, price, quantity }
   *
   * `id`        — existing order-item id (null for newly added rows)
   * `price`     — unit selling price (read-only; comes from the saved item or product lookup)
   * `quantity`  — editable integer
   */
  const [editItems, setEditItems] = useState([])

  // ─── product search (Add Product section) ─────────────────────────────
  const {
    productSearch, searchResults, searching, loadingMore, hasMore, dropdownOpen,
    handleProductSearchChange, handleSearchFocus, handleSearchBlur,
    handleDropdownScroll, resetSearch,
  } = useProductSearch(productsApi.searchForSale)

  // ─── rounding state ───────────────────────────────────────────────────
  const [roundingEnabled, setRoundingEnabled] = useState(false)
  const [roundingQuantum, setRoundingQuantum] = useState(0.05)

  // ─── submit state ─────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  const searchRef = useRef(null)

  // ─── Access guard ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasAccess) {
      toast.error(`You do not have permission to ${isCreate ? 'create' : 'edit'} sales.`)
      navigate(isCreate ? '/sales' : `/sales/${id}`)
    }
  }, [hasAccess, isCreate, id, navigate])

  // ─── Load data on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!hasAccess) return

    let cancelled = false
    setLoading(true)

    const fetches = isCreate
      ? [Promise.resolve(null), getAllCustomers(), paymentMethodsApi.getActive(), getSettings().catch(() => null)]
      : [getOrderById(id), getAllCustomers(), paymentMethodsApi.getActive(), getSettings().catch(() => null)]

    Promise.all(fetches)
      .then(([orderRes, custRes, pmRes, settingsRes]) => {
        if (cancelled) return

        // Customers
        const custList = custRes?.data?.data
        setCustomers(Array.isArray(custList) ? custList : (custList?.items ?? []))

        // Payment methods (both create and edit mode)
        const pmList = pmRes?.data?.data
        setPaymentMethods(Array.isArray(pmList) ? pmList : (pmList?.items ?? []))

        // Rounding settings
        const sData = settingsRes?.data?.data
        if (sData) {
          setRoundingEnabled(sData.rounding_enabled === 'true')
          setRoundingQuantum(sData.rounding_quantum === '0.10' ? 0.10 : 0.05)
        }

        if (!isCreate) {
          // Existing order (edit mode)
          const o = orderRes?.data?.data ?? orderRes?.data
          if (!o) {
            toast.error('Sale not found.')
            navigate('/sales')
            return
          }
          setOrder(o)
          if (o.orderDate) setOrderDate(new Date(o.orderDate).toISOString().slice(0, 10))
          setCustomerId(String(o.customerId ?? ''))
          setNote(o.note ?? '')
          setDiscount(Number(o.discount ?? 0))

          const rawItems = o.items ?? o.orderItems ?? []
          setEditItems(
            rawItems.map((item, idx) => ({
              _key:          `existing-${item.id ?? idx}`,
              id:            item.id ?? null,
              productId:     item.productId,
              productName:   item.productName ?? item.product?.name ?? '—',
              productSku:    item.productSku ?? '',
              price:         Number(item.price ?? 0),
              quantity:      Number(item.quantity ?? 1),
              kitchenSentAt: item.kitchenSentAt ?? null,
            }))
          )
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load form data.')
          navigate('/sales')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id, hasAccess, isCreate, navigate])

  /**
   * Adds the given product directly to editItems with qty=1.
   * If the product already exists in the list, increments its quantity by 1.
   */
  function handleAddItem(product) {
    const existingIdx = editItems.findIndex(i => i.productId === product.id)
    if (existingIdx !== -1) {
      setEditItems(prev =>
        prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        )
      )
    } else {
      const unitPrice = Number(product.discountedPrice ?? product.price ?? 0)
      setEditItems(prev => [
        ...prev,
        {
          _key:        `new-${product.id}-${Date.now()}`,
          id:          null,
          productId:   product.id,
          productName: product.name,
          productSku:  product.sku ?? '',
          price:       unitPrice,
          quantity:    1,
        },
      ])
    }
    resetSearch()
  }

  // ─── Item editing helpers ─────────────────────────────────────────────
  function handleQtyChange(key, rawVal) {
    const qty = parseInt(rawVal, 10)
    if (isNaN(qty) || qty < 1) return
    setEditItems(prev =>
      prev.map(item => item._key === key ? { ...item, quantity: qty } : item)
    )
  }

  function handleRemoveItem(key) {
    setEditItems(prev => prev.filter(item => item._key !== key))
  }

  /**
   * Handles payment method selection in create mode.
   * If the method has autoFillAmount=true, pre-fills paid with the current computed total.
   * If autoFillAmount=false (cash), leaves paid for manual entry.
   */
  function handlePaymentMethodChange(newId) {
    setPaymentMethodId(newId)
    const method = paymentMethods.find(pm => String(pm.id) === String(newId)) ?? null
    setSelectedPaymentMethod(method)
    if (method?.autoFillAmount) {
      // total is derived from current editItems — may be 0 if no items yet
      setPaid(Math.max(0, subTotal - (Number(discount) || 0)))
    }
    // For cash (autoFillAmount=false) we leave paid untouched — cashier enters manually
  }

  /**
   * Handles payment method selection in edit mode.
   * Auto-fills editPaidAmount when the method has autoFillAmount=true (card/QR/bank).
   * Leaves editPaidAmount blank for manual entry when autoFillAmount=false (cash).
   */
  function handleEditPaymentMethodChange(newId) {
    setEditPaymentMethodId(newId)
    const method = paymentMethods.find(pm => String(pm.id) === String(newId)) ?? null
    setEditSelectedPaymentMethod(method)
    if (method?.autoFillAmount) {
      const localSubTotal = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      const localTotal    = Math.max(0, localSubTotal - (Number(discount) || 0))
      const wasRounded    = Number(order?.roundingAdjustment ?? 0) !== 0
      const { roundedTotal: localPayable } = roundingEnabled && wasRounded
        ? applyCashRounding(localTotal, roundingQuantum)
        : { roundedTotal: localTotal }
      const currentDue = Math.max(0, localPayable - Number(order?.paid ?? 0))
      setEditPaidAmount(currentDue > 0 ? currentDue.toFixed(2) : '')
    } else {
      setEditPaidAmount('')
    }
    setEditTransactionId('')
  }

  // ─── Derived totals (live) ────────────────────────────────────────────
  const subTotal    = editItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const discountNum = Number(discount) || 0
  const total       = Math.max(0, subTotal - discountNum)
  // Rounding preview: create mode — check selected method; edit mode — check if original order was rounded (cash)
  const isCashPayment = isCreate
    ? !(selectedPaymentMethod?.autoFillAmount ?? false)
    : Number(order?.roundingAdjustment ?? 0) !== 0
  const shouldRound = roundingEnabled && isCashPayment
  const { roundedTotal: payableTotal, roundingAdjustment: roundingAdj } = shouldRound
    ? applyCashRounding(total, roundingQuantum)
    : { roundedTotal: total, roundingAdjustment: 0 }
  const paidNum     = isCreate ? (Number(paid) || 0) : Number(order?.paid ?? 0)
  const totalTooLow = !isCreate && payableTotal < paidNum

  const editDue            = !isCreate ? Math.max(0, payableTotal - Number(order?.paid ?? 0)) : 0
  const editPaidNumDerived = !isCreate ? (Number(editPaidAmount) || 0) : 0
  const cashUnderpayment   = !isCreate
    && !!editPaymentMethodId
    && !(editSelectedPaymentMethod?.autoFillAmount ?? false)
    && editPaidNumDerived > 0
    && editPaidNumDerived < editDue

  // Reset edit-payment fields when outstanding due drops to zero (order already paid or
  // user's item changes bring the balance back to zero) so stale state cannot trigger collectDue.
  useEffect(() => {
    if (!isCreate && editDue <= 0) {
      setEditPaymentMethodId('')
      setEditSelectedPaymentMethod(null)
      setEditPaidAmount('')
      setEditTransactionId('')
    }
  }, [isCreate, editDue])

  // ─── Submit ────────────────────────────────────────────────────────────
  async function handleSave(e) {
    e.preventDefault()

    if (editItems.length === 0) {
      toast.error('A sale must have at least one item.')
      return
    }
    if (totalTooLow) {
      toast.error(`Total (${total.toFixed(2)}) cannot be less than the amount already paid (${paidNum.toFixed(2)}).`)
      return
    }

    setSaving(true)
    try {
      if (isCreate) {
        const res = await createOrderDirect({
          customerId:      Number(customerId) || null,
          orderDate:       orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
          discount:        discountNum,
          paid:            paidNum,
          paymentMethodId: paymentMethodId ? Number(paymentMethodId) : null,
          note:            note.trim() || null,
          items: editItems.map(item => ({
            productId: item.productId,
            quantity:  item.quantity,
          })),
        })
        const newOrder = res.data?.data
        toast.success('Sale created successfully')
        navigate(`/sales/${newOrder.id}`)
      } else {
        const updateRes    = await updateOrder(id, {
          customerId: Number(customerId) || null,
          orderDate:  orderDate ? new Date(orderDate).toISOString() : new Date().toISOString(),
          discount:   discountNum,
          note:       note.trim() || null,
          items: editItems.map(item => ({
            id:        item.id,
            productId: item.productId,
            quantity:  item.quantity,
          })),
        })
        const updatedOrder = updateRes?.data?.data
        const editPaidNum  = Math.round((Number(editPaidAmount) || 0) * 100) / 100
        if (editPaymentMethodId && editPaidNum > 0) {
          const serverDue = Math.round(Math.max(0, Number(updatedOrder?.due ?? 0)) * 100) / 100
          const netAmount = Math.min(editPaidNum, serverDue)
          if (netAmount > 0) {
            await collectDue(id, {
              amount:          netAmount,
              paidAmount:      editPaidNum,
              paymentMethodId: Number(editPaymentMethodId),
              transactionId:   editTransactionId.trim() || null,
            })
          }
        }
        toast.success('Sale updated successfully')
        navigate(`/sales/${id}`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message ?? `Failed to ${isCreate ? 'create' : 'update'} sale`)
    } finally {
      setSaving(false)
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isCreate && !order) return null

  const backTarget = isCreate ? '/sales' : `/sales/${id}`
  const pageTitle  = isCreate ? 'New Sale' : `Edit Sale #${order.id}`

  return (
    <div>
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(backTarget)}
          className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || editItems.length === 0 || totalTooLow || cashUnderpayment}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? (isCreate ? 'Creating...' : 'Saving...') : (isCreate ? 'Create Sale' : 'Save Changes')}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Order details card ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">
            Sale Details
          </h2>
          <div className="space-y-4">
            {/* Date */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Date</label>
              <input
                type="date"
                value={orderDate}
                onChange={e => setOrderDate(e.target.value)}
                disabled={saving}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              />
            </div>

            {/* Customer */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">Customer</label>
              <SearchableSelect
                options={customers}
                value={customerId}
                onChange={id => setCustomerId(String(id))}
                placeholder="— Select customer —"
                disabled={saving}
              />
            </div>

            {/* Note */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                Note
              </label>
              <textarea
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                disabled={saving}
                placeholder="Optional note..."
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              />
            </div>

            {/* Create mode: Paid Amount */}
            {isCreate && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Paid Amount
                </label>
                <PriceInput
                  value={paid}
                  onChange={setPaid}
                  disabled={saving}
                  placeholder="0.00"
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                />
              </div>
            )}

            {/* Create mode: Payment Method — always visible so auto-fill can trigger */}
            {isCreate && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethodId}
                  onChange={e => handlePaymentMethodChange(e.target.value)}
                  disabled={saving}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="">— Select method —</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Summary Preview card ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">
            Summary Preview
          </h2>

          <div className="space-y-2">
            {/* Discount input */}
            <div className="flex items-center justify-between gap-4">
              <label className="text-sm text-gray-600 dark:text-slate-400">Discount</label>
              <PriceInput
                value={discount}
                onChange={setDiscount}
                disabled={saving}
                placeholder="0.00"
                className="w-32 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>

            {/* Running totals */}
            <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
              <span>Sub Total</span>
              <span className="font-medium">{subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
              <span>Discount</span>
              <span className="font-medium">− {discountNum.toFixed(2)}</span>
            </div>
            {shouldRound && roundingAdj !== 0 && (
              <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 italic">
                <span>Rounding</span>
                <span>{roundingAdj > 0 ? '+' : ''}{roundingAdj.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-200 pt-2 border-t border-gray-100 dark:border-slate-700">
              <span>{isCreate ? 'Total' : 'New Total'}</span>
              <span>{payableTotal.toFixed(2)}</span>
            </div>

            {/* Paid / Due / Change */}
            <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
              <span>{isCreate ? 'Paid' : 'Already Paid (read-only)'}</span>
              <span className="font-medium">{paidNum.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-yellow-700 dark:text-yellow-400">
              <span>{isCreate ? 'Due' : 'New Due (estimated)'}</span>
              <span className="font-medium">{Math.max(0, payableTotal - paidNum).toFixed(2)}</span>
            </div>
            {/* Change row — cash/manual only, when paid exceeds payable total in create mode */}
            {isCreate && !selectedPaymentMethod?.autoFillAmount && paidNum > payableTotal && (
              <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                <span>Change</span>
                <span className="font-medium">{(paidNum - payableTotal).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Warning: discount makes total less than paid (edit mode only) */}
          {totalTooLow && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-800">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">
                The new total ({payableTotal.toFixed(2)}) is less than the amount already paid ({paidNum.toFixed(2)}).
                Reduce the discount or add more items before saving.
              </p>
            </div>
          )}

          {/* Payment collection section — edit mode only, shown when there is outstanding due */}
          {!isCreate && (() => {
            const existingPaid = Number(order?.paid ?? 0)
            const newDue       = Math.max(0, payableTotal - existingPaid)
            const editPaidNum  = Number(editPaidAmount) || 0
            const showChange   = !editSelectedPaymentMethod?.autoFillAmount && editPaidNum > newDue

            return newDue > 0 ? (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Record Payment
                </h3>

                {/* Payment Method */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={editPaymentMethodId}
                    onChange={e => handleEditPaymentMethodChange(e.target.value)}
                    disabled={saving}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                  >
                    <option value="">— No payment now —</option>
                    {paymentMethods.map(pm => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                </div>

                {/* Cash Tendered — manual entry for non-auto-fill methods */}
                {editPaymentMethodId && !editSelectedPaymentMethod?.autoFillAmount && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                      Cash Tendered
                    </label>
                    <PriceInput
                      value={editPaidAmount}
                      onChange={setEditPaidAmount}
                      disabled={saving}
                      placeholder={`${newDue.toFixed(2)} or more`}
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    />
                  </div>
                )}

                {/* Auto-fill confirmation — card/QR/bank */}
                {editPaymentMethodId && editSelectedPaymentMethod?.autoFillAmount && (
                  <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                    <span>Amount to charge</span>
                    <span className="font-medium">{newDue.toFixed(2)}</span>
                  </div>
                )}

                {/* Transaction ID — card/QR/bank only */}
                {editPaymentMethodId && editSelectedPaymentMethod?.autoFillAmount && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
                      Transaction ID
                    </label>
                    <input
                      type="text"
                      value={editTransactionId}
                      onChange={e => setEditTransactionId(e.target.value)}
                      disabled={saving}
                      placeholder="Optional reference"
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    />
                  </div>
                )}

                {/* Change — cash overpayment */}
                {showChange && (
                  <div className="flex justify-between text-sm font-semibold text-green-700 dark:text-green-400">
                    <span>Change</span>
                    <span>{(editPaidNum - newDue).toFixed(2)}</span>
                  </div>
                )}

                {/* Cash underpayment warning */}
                {cashUnderpayment && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Cash tendered ({editPaidNumDerived.toFixed(2)}) must be at least the due amount ({editDue.toFixed(2)}).
                  </p>
                )}
              </div>
            ) : null
          })()}

        </div>
        </div>{/* end two-column grid */}

        {/* ── Add Products card ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Add Products
          </h2>
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={productSearch}
                onChange={e => handleProductSearchChange(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                disabled={saving}
                placeholder="Search products by name or SKU..."
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
                className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-60 overflow-y-auto"
                onScroll={handleDropdownScroll}
              >
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleAddItem(product)}
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors text-sm cursor-pointer"
                  >
                    <span className="font-medium text-gray-800 dark:text-slate-200">{product.name}</span>
                    {product.sku && (
                      <span className="text-gray-400 text-xs ml-2">SKU: {product.sku}</span>
                    )}
                    <span className="float-right text-gray-600 dark:text-slate-400 font-medium">
                      {Number(product.discountedPrice ?? product.price ?? 0).toFixed(2)}
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
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg">
                <p className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500">No products found.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Items card ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Sale Items
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-8">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">SKU</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-32">Unit Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-32">Quantity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-28">Line Total</th>
                  <th className="py-3 px-4 w-10" aria-label="Remove column" />
                </tr>
              </thead>
              <tbody>
                {editItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No items. Search and add a product above.
                    </td>
                  </tr>
                ) : (
                  editItems.map((item, index) => (
                    <tr key={item._key} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                      <td className="py-3 px-4 font-medium">
                        <span className="text-gray-700 dark:text-slate-300">{item.productName}</span>
                        {item.kitchenSentAt && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">SENT</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{item.productSku || '—'}</td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{item.price.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={e => handleQtyChange(item._key, e.target.value)}
                          disabled={saving}
                          aria-label={`Quantity for ${item.productName}`}
                          className="w-24 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                        {(item.price * item.quantity).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item._key)}
                          disabled={saving}
                          aria-label={`Remove ${item.productName}`}
                          className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bottom action bar ── */}
        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            type="button"
            onClick={() => navigate(backTarget)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || editItems.length === 0 || totalTooLow || cashUnderpayment}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? (isCreate ? 'Creating...' : 'Saving...') : (isCreate ? 'Create Sale' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  )
}

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Package, Trash2, Search, Clock, ChefHat } from 'lucide-react'
import { MEDIA_HOST } from '../../api/axios'
import { groupSubItemsByStep } from '../../lib/utils/bundles'
import { usePos, bundleParentId } from '../../context/PosContext'
import { ORDER_TYPE } from '../../constants/orderTypes'
import { DISCOUNT_TYPE } from '../../constants/discountTypes'
import { POS_PHASE } from '../../constants/posPhases'
import PriceInput from '../../components/PriceInput'
import Spinner from '../../components/Spinner'
import BundleSelectionModal from './components/BundleSelectionModal'
import BundleStepWizard from './components/BundleStepWizard'
import ModifierModal from './components/ModifierModal'

// ── CustomerSelect ────────────────────────────────────────────────────────────
function CustomerSelect({ customers, selected, onSelect, onCreateNew, canCreate }) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const wrapperRef        = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered  = customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
  const showCreate = canCreate && query.trim() &&
    !customers.some(c => c.name.toLowerCase() === query.trim().toLowerCase())

  return (
    <div className="relative mb-3" ref={wrapperRef}>
      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Customer</label>
      <input
        value={query || (open ? '' : (selected?.name ?? ''))}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        placeholder="Select customer..."
        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
        aria-label="Customer search"
        aria-haspopup="listbox"
        aria-expanded={open}
      />
      {open && (
        <div
          className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto"
          role="listbox"
        >
          {filtered.map(c => (
            <button
              key={c.id}
              role="option"
              aria-selected={selected?.id === c.id}
              onClick={() => { onSelect(c); setQuery(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer text-gray-700 dark:text-slate-300"
            >
              {c.name}
            </button>
          ))}
          {showCreate && (
            <button
              onClick={() => { onCreateNew(query.trim()); setQuery(''); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer font-medium"
            >
              + Create "{query.trim()}"
            </button>
          )}
          {filtered.length === 0 && !showCreate && (
            <p className="px-3 py-2 text-sm text-gray-400 dark:text-slate-500">No customers found</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── ProductCard ───────────────────────────────────────────────────────────────
function ProductCard({ product, onAdd }) {
  const { fmt } = usePos()
  const imageUrl = product.image ? `${MEDIA_HOST}/${product.image}` : null
  return (
    <button
      onClick={() => onAdd(product)}
      className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl p-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
      aria-label={`Add ${product.name} to cart`}
    >
      <div className="aspect-square bg-gray-50 dark:bg-slate-700 rounded-xl mb-2 flex items-center justify-center overflow-hidden">
        {imageUrl
          ? <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
          : <Package size={32} className="text-gray-300" />
        }
      </div>
      <p className="text-xs font-medium text-gray-800 dark:text-slate-200 leading-tight line-clamp-2">{product.name}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">({product.quantity} in stock)</p>
      <div className="mt-1">
        {product.discount && product.price !== product.discountedPrice && (
          <p className="text-xs text-gray-400 dark:text-slate-500 line-through">{fmt(product.price)}</p>
        )}
        <p className="text-sm font-semibold text-blue-600">{fmt(product.discountedPrice)}</p>
      </div>
    </button>
  )
}

// ── BundleCard ────────────────────────────────────────────────────────────────
function BundleCard({ bundle, onSelect }) {
  const { fmt } = usePos()
  return (
    <button
      onClick={onSelect}
      className="bg-indigo-50 dark:bg-indigo-900/30 border-2 border-indigo-200 dark:border-indigo-700 rounded-2xl p-3 hover:shadow-md transition-shadow cursor-pointer text-left w-full"
      aria-label={`Select bundle: ${bundle.name}`}
    >
      <div className="aspect-square bg-indigo-100 dark:bg-indigo-800 rounded-xl mb-2 flex items-center justify-center">
        <Package size={28} className="text-indigo-500 dark:text-indigo-300" />
      </div>
      <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200 leading-tight line-clamp-2">{bundle.name}</p>
      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">Bundle {'\u00b7'} {bundle.minItems}{'\u2013'}{bundle.maxItems} items</p>
      <p className="text-sm font-bold text-indigo-600 dark:text-indigo-300 mt-1">{fmt(bundle.price)}</p>
    </button>
  )
}

// ── CartTable ─────────────────────────────────────────────────────────────────
function CartTable({
  cart, onIncrement, onDecrement, onRemove, onRemoveBundle, onPriceChange,
  itemDiscounts, onItemDiscountChange,
  restaurantMode, openOrderId, onVoidItem,
}) {
  const { fmt } = usePos()
  const [editingPriceId, setEditingPriceId] = useState(null)
  const [priceEditValue, setPriceEditValue] = useState('')

  function startPriceEdit(item) {
    setEditingPriceId(item.id)
    setPriceEditValue(String(item.discountedPrice ?? item.price ?? 0))
  }

  function commitPriceEdit(item) {
    const newPrice = parseFloat(priceEditValue)
    setEditingPriceId(null)
    if (!isNaN(newPrice) && newPrice > 0 && newPrice !== (item.discountedPrice ?? item.price))
      onPriceChange(item.id, newPrice)
  }

  if (cart.length === 0) {
    return <div className="text-center py-8 text-gray-400 dark:text-slate-500 text-sm flex-1">Cart is empty</div>
  }

  return (
    <div className="overflow-y-auto flex-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-slate-700">
            <th className="text-left py-2 px-2 text-xs text-gray-400 dark:text-slate-500">Product</th>
            <th className="text-center py-2 px-2 text-xs text-gray-400 dark:text-slate-500">Qty</th>
            <th className="text-right py-2 px-2 text-xs text-gray-400 dark:text-slate-500">Price</th>
            <th className="text-right py-2 px-2 text-xs text-gray-400 dark:text-slate-500">Disc</th>
            <th className="text-right py-2 px-2 text-xs text-gray-400 dark:text-slate-500">Total</th>
            <th className="py-2 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {cart.map(item => {
            if (bundleParentId(item) != null) return null

            if (item.isBundleHeader) {
              const subItems = cart.filter(si => bundleParentId(si) === item.id)
              const stepGroups = groupSubItemsByStep(subItems)

              return (
                <React.Fragment key={item.id}>
                  <tr className="border-b border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/20">
                    <td className="py-2 px-2 text-indigo-700 dark:text-indigo-300 text-xs font-bold" title={item.productName}>
                      {item.productName}
                    </td>
                    <td className="py-2 px-2 text-center text-xs text-indigo-600 dark:text-indigo-400">x{item.quantity}</td>
                    <td className="py-2 px-2 text-right text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {fmt(Number(item.rowTotal ?? item.total ?? 0))}
                    </td>
                    <td className="py-2 px-2" />
                    <td className="py-2 px-2 text-right text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      {fmt(Number(item.rowTotal ?? item.total ?? 0))}
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={() => onRemoveBundle(item.id)} className="text-red-400 hover:text-red-600 cursor-pointer" aria-label={`Remove bundle ${item.productName} from cart`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                  {stepGroups ? (
                    /* Multi-step bundle: group sub-items under step headers */
                    stepGroups.map(([label, items]) => (
                      <React.Fragment key={label}>
                        <tr className="border-b border-gray-50 dark:border-slate-700/50">
                          <td colSpan={6} className="py-1 px-2 pl-4 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">
                            {label}:
                          </td>
                        </tr>
                        {items.map(si => (
                          <tr key={si.id} className="border-b border-gray-50 dark:border-slate-700/50">
                            <td className="py-1.5 px-2 pl-6 text-gray-500 dark:text-slate-400 text-xs" title={si.productName}>
                              <span className="text-indigo-400 mr-1" aria-hidden="true">{'\u203a'}</span>{si.productName}
                            </td>
                            <td className="py-1.5 px-2 text-center text-xs text-gray-400 dark:text-slate-500">x{si.quantity}</td>
                            <td /><td /><td /><td />
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    /* Flat bundle: render sub-items without grouping */
                    subItems.map(si => (
                      <tr key={si.id} className="border-b border-gray-50 dark:border-slate-700/50">
                        <td className="py-1.5 px-2 pl-5 text-gray-500 dark:text-slate-400 text-xs" title={si.productName}>
                          <span className="text-indigo-400 mr-1" aria-hidden="true">{'\u203a'}</span>{si.productName}
                        </td>
                        <td className="py-1.5 px-2 text-center text-xs text-gray-400 dark:text-slate-500">x{si.quantity}</td>
                        <td /><td /><td /><td />
                      </tr>
                    ))
                  )}
                </React.Fragment>
              )
            }

            const itemDisc     = Number(itemDiscounts[item.id] ?? 0)
            const effectiveRow = Math.max(0, (item.rowTotal ?? item.total ?? 0) - itemDisc)
            const isVoided     = item.isVoided === true
            const isStaged     = item.isStaged === true
            const kitchenSent  = !!item.kitchenSentAt
            const isUnsentNew  = restaurantMode && openOrderId && !kitchenSent && !isVoided && !isStaged

            return (
              <tr
                key={item.id}
                className={`border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 ${isVoided ? 'opacity-50' : ''}`}
              >
                <td className="py-2 px-2 text-xs font-medium" title={item.productName}>
                  <p className={`break-words leading-tight ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'}`}>
                    {item.productName}
                  </p>
                  {restaurantMode && (isStaged || openOrderId) && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${
                      isVoided ? 'text-red-400 dark:text-red-500'
                        : isStaged ? 'text-blue-500 dark:text-blue-400'
                        : kitchenSent ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}>
                      {isVoided ? 'VOID' : isStaged ? 'DRAFT' : kitchenSent ? <><Clock size={9} />Sent</> : 'NEW'}
                    </span>
                  )}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => onDecrement(item.id)} disabled={isVoided || kitchenSent}
                      className="w-6 h-6 sm:w-5 sm:h-5 rounded-md bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Decrease quantity of ${item.productName}`}>-</button>
                    <span className="w-6 text-center text-xs text-gray-700 dark:text-slate-300">{item.quantity}</span>
                    <button onClick={() => onIncrement(item.id)}
                      disabled={kitchenSent || (isStaged ? item.quantity >= item.stockQuantity : (item.quantity >= item.stockQuantity || isVoided))}
                      className="w-6 h-6 sm:w-5 sm:h-5 rounded-md bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 flex items-center justify-center text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Increase quantity of ${item.productName}`}>+</button>
                  </div>
                </td>
                <td className="py-2 px-2 text-right">
                  {!isVoided && item.price != null && item.discountedPrice != null && item.price !== item.discountedPrice && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 line-through">{fmt(item.price)}</p>
                  )}
                  {!isVoided && editingPriceId === item.id ? (
                    <input type="number" min="0" step="0.01" value={priceEditValue}
                      onChange={e => setPriceEditValue(e.target.value)}
                      onBlur={() => commitPriceEdit(item)}
                      onKeyDown={e => { if (e.key === 'Enter') commitPriceEdit(item); if (e.key === 'Escape') setEditingPriceId(null) }}
                      autoFocus
                      className="w-16 text-right text-xs border border-blue-400 rounded px-1 py-0.5 focus:outline-none dark:bg-slate-700 dark:text-slate-100"
                      aria-label={`Edit unit price for ${item.productName}`} />
                  ) : (
                    <button onClick={() => !isVoided && startPriceEdit(item)} disabled={isVoided}
                      title={isVoided ? undefined : 'Click to edit price'}
                      className={`text-xs cursor-pointer transition-colors ${isVoided ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed' : 'text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline'}`}
                      aria-label={`Price for ${item.productName}`}>
                      {fmt(item.discountedPrice ?? item.price ?? 0)}
                    </button>
                  )}
                </td>
                <td className="py-2 px-2 text-right">
                  {!isVoided && (
                    <input type="number" min="0" step="0.01" value={itemDiscounts[item.id] ?? ''}
                      onChange={e => onItemDiscountChange(item.id, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-14 text-right text-xs border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5 focus:outline-none focus:border-blue-400 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                      aria-label={`Item discount for ${item.productName}`} />
                  )}
                </td>
                <td className={`py-2 px-2 text-right text-xs font-medium ${isVoided ? 'text-gray-400 dark:text-slate-500 line-through' : 'text-gray-800 dark:text-slate-200'}`}>
                  {fmt(isVoided ? (item.rowTotal ?? item.total ?? 0) : effectiveRow)}
                </td>
                <td className="py-2 px-2">
                  {isVoided ? null : isStaged ? (
                    <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 cursor-pointer" aria-label={`Remove staged ${item.productName} from cart`}><Trash2 size={13} /></button>
                  ) : restaurantMode && openOrderId && kitchenSent ? (
                    <button onClick={() => onVoidItem(item.id)} className="text-red-400 hover:text-red-600 cursor-pointer" aria-label={`Void ${item.productName}`}><Trash2 size={13} /></button>
                  ) : (
                    <button onClick={() => onRemove(item.id)} className="text-red-400 hover:text-red-600 cursor-pointer" aria-label={`Remove ${item.productName} from cart`}><Trash2 size={13} /></button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── OrderSummary ──────────────────────────────────────────────────────────────
function OrderSummary({ subTotal, itemDiscountTotal, voucherDiscount, voucherCode, discount, total, roundingAdjustment, roundedTotal, shouldRound }) {
  const { fmt } = usePos()
  return (
    <div className="space-y-2 mt-4 border-t border-gray-100 dark:border-slate-700 pt-4">
      <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
        <span>Sub Total</span>
        <span>{fmt(subTotal)}</span>
      </div>
      {itemDiscountTotal > 0 && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
          <span>Item Discounts</span>
          <span className="text-orange-600 dark:text-orange-400">-{fmt(itemDiscountTotal)}</span>
        </div>
      )}
      {voucherDiscount > 0 && (
        <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
          <span>Voucher{voucherCode ? ` (${voucherCode})` : ''}</span>
          <span className="text-indigo-600 dark:text-indigo-400">-{fmt(voucherDiscount)}</span>
        </div>
      )}
      <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
        <span>Order Discount</span>
        <span>{fmt(discount)}</span>
      </div>
      {shouldRound && roundingAdjustment !== 0 && (
        <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 italic">
          <span>Rounding</span>
          <span className={roundingAdjustment > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
            {roundingAdjustment > 0 ? '+' : ''}{fmt(Math.abs(roundingAdjustment))}
          </span>
        </div>
      )}
      <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-200 border-t border-gray-100 dark:border-slate-700 pt-2">
        <span>Total</span>
        <span>{fmt(shouldRound ? roundedTotal : total)}</span>
      </div>
    </div>
  )
}

// ── SidebarCategoryBtn ────────────────────────────────────────────────────────
function SidebarCategoryBtn({ label, count, isActive, onClick, accent = 'blue' }) {
  const activeBtn   = accent === 'indigo' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'
  const inactiveBtn = accent === 'indigo'
    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800'
    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700'
  const activeBadge   = 'bg-white/30 text-white'
  const inactiveBadge = accent === 'indigo'
    ? 'bg-indigo-100 dark:bg-indigo-800 text-indigo-600 dark:text-indigo-300'
    : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
  return (
    <button onClick={onClick}
      className={`w-full text-left px-2 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-1 ${isActive ? activeBtn : inactiveBtn}`}
      aria-pressed={isActive}>
      <span className="truncate">{label}</span>
      <span className={`shrink-0 text-[10px] font-bold px-1 py-0.5 rounded-full ${isActive ? activeBadge : inactiveBadge}`}>{count}</span>
    </button>
  )
}

// ── PosOrdering (default export) ──────────────────────────────────────────────
/**
 * Product browser + cart ordering screen.
 * Rendered at:
 *   /pos/table/:tableId  (dine-in)
 *   /pos/walk-in          (walk-in)
 *   /pos/takeaway          (takeaway)
 *   /pos                   (non-restaurant mode)
 */
export default function PosOrdering() {
  const { tableId } = useParams()
  const [searchParams] = useSearchParams()

  const {
    canCreate, canCreateCustomer,
    fmt,
    cart, products, loadingProducts, loadingCart,
    nameSearch, setNameSearch, barcodeInput, setBarcodeInput,
    selectedCategory, filteredProducts, categories,
    bundles, pendingBundle, setPendingBundle,
    customers, selectedCustomer, setCustomer,
    discountType, setDiscountType, discountValue, setDiscountValue,
    itemDiscounts,
    paid, setPaid, paymentMethods, selectedPaymentMethodId, selectedMethod,
    checkingOut, confirmCheckout,
    shouldRound, roundingAdjustment, roundedTotal,
    subTotal, itemDiscountTotal, voucherDiscount,
    orderDiscount, total, grandTotal, currentDue, due,
    isZeroTotal,
    mobileTab, setMobileTab,
    restaurantMode, posPhase,
    tables,
    selectedTable, setSelectedTable,
    openOrderId,
    orderType, setOrderType,
    voidingItemId, setVoidingItemId,
    sendingToKitchen,
    stagedItems,
    appliedVoucher, setAppliedVoucher,
    activeVouchers, vouchersLoading, voucherError, setVoucherError,
    showMergeModal, setShowMergeModal,
    occupiedTables, selectedMergeTables, setSelectedMergeTables, merging,
    pendingModifierProduct, setPendingModifierProduct,
    barcodeRef, sentinelRef, searchInputRef,
    handleSelectTable,
    handleVoidItem, handleSendToKitchen,
    handleSelectVoucher, handleRemoveVoucher,
    handleSelectCategory,
    handleOpenMergeModal, handleMergeConfirm,
    handleAddToCart, handleModifierConfirm,
    handleIncrement, handleDecrement, handleRemoveItem,
    handleClearCart, handlePriceChange, handleItemDiscountChange,
    handleBundleComplete, handleRemoveBundle,
    handleCreateCustomer, handlePaymentMethodChange,
    openCheckoutModal, handleCloseSettleModal, handleCheckout,
    handleBackToTables,
    setPendingSettle,
  } = usePos()

  // If we arrived at /pos/table/:tableId and the context doesn't have
  // that table selected yet, select it now.
  const tableIdNum = tableId ? Number(tableId) : null
  useEffect(() => {
    if (tableIdNum && tables.length > 0 && selectedTable?.id !== tableIdNum) {
      const table = tables.find(t => t.id === tableIdNum)
      if (table) {
        setOrderType(ORDER_TYPE.DINE_IN)
        handleSelectTable(table)
      }
    }
  }, [tableIdNum, tables.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // If we arrived with ?settle=true, trigger the settle flow
  useEffect(() => {
    if (searchParams.get('settle') === 'true' && posPhase === POS_PHASE.ORDERING) {
      setPendingSettle(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Permission guard ───────────────────────────────────────────────────────
  if (!canCreate) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to access the POS terminal.</p>
        </div>
      </div>
    )
  }

  if (loadingCart) return <Spinner />

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-120px)]">
    <div className="flex flex-col md:flex-row gap-0 md:gap-4 flex-1 min-h-0">

      {/* Mobile tab bar */}
      <div className="flex md:hidden bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden mb-3">
        <button onClick={() => setMobileTab('products')}
          className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${mobileTab === 'products' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
          Products
        </button>
        <button onClick={() => setMobileTab('cart')}
          className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer relative ${mobileTab === 'cart' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
          Cart
          {(cart.length + stagedItems.length) > 0 && (
            <span className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${mobileTab === 'cart' ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
              {cart.length + stagedItems.length}
            </span>
          )}
        </button>
      </div>

      {/* LEFT PANEL -- Cart & Summary */}
      <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} md:flex w-full md:w-2/5 flex-col gap-4 overflow-hidden`}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-4 flex-1 flex flex-col overflow-hidden">

          {posPhase === POS_PHASE.ORDERING && restaurantMode && (
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                {orderType === ORDER_TYPE.TAKEAWAY ? 'Takeaway Order'
                  : orderType === ORDER_TYPE.POS ? 'Walk-In Customer'
                  : `Table T${selectedTable?.number}${selectedTable?.label ? ` \u2014 ${selectedTable.label}` : ''}`}
              </span>
              <button
                onClick={handleBackToTables}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
              >
                {'\u2190'} Back
              </button>
            </div>
          )}

          <CartTable
            cart={[...cart, ...stagedItems]}
            onIncrement={handleIncrement}
            onDecrement={handleDecrement}
            onRemove={handleRemoveItem}
            onRemoveBundle={handleRemoveBundle}
            onPriceChange={handlePriceChange}
            itemDiscounts={itemDiscounts}
            onItemDiscountChange={handleItemDiscountChange}
            restaurantMode={restaurantMode}
            openOrderId={openOrderId}
            onVoidItem={id => setVoidingItemId(id)}
          />

          <OrderSummary
            subTotal={subTotal}
            itemDiscountTotal={itemDiscountTotal}
            voucherDiscount={voucherDiscount}
            voucherCode={appliedVoucher?.code}
            discount={orderDiscount}
            total={total}
            roundingAdjustment={roundingAdjustment}
            roundedTotal={roundedTotal}
            shouldRound={shouldRound}
          />

          {restaurantMode && orderType === ORDER_TYPE.DINE_IN && openOrderId && (
            <button onClick={handleOpenMergeModal}
              className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors cursor-pointer">
              Merge Table
            </button>
          )}

          {restaurantMode && orderType === ORDER_TYPE.DINE_IN && stagedItems.length > 0 && (
            <button onClick={handleSendToKitchen} disabled={sendingToKitchen}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              {sendingToKitchen
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <ChefHat size={16} />}
              {sendingToKitchen ? 'Confirming...' : `Confirm (${stagedItems.length})`}
            </button>
          )}

          <div className="flex gap-2 mt-3">
            <button onClick={handleClearCart} disabled={cart.length === 0}
              className="flex-1 bg-red-50 dark:bg-red-900/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              Clear Cart
            </button>
            <button onClick={() => openCheckoutModal()}
              disabled={(cart.filter(i => !i.isVoided).length === 0 && stagedItems.length === 0) || checkingOut}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              {orderType === ORDER_TYPE.TAKEAWAY ? 'Pay & Send to Kitchen'
                : restaurantMode && openOrderId ? 'Settle Bill'
                : 'Checkout'}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL -- Product Browser */}
      <div className={`${mobileTab === 'products' ? 'flex' : 'hidden'} md:flex w-full md:w-3/5 flex-col gap-3 overflow-hidden relative`}>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-3 flex flex-col sm:flex-row gap-2">
          <input
            ref={barcodeRef}
            autoFocus
            value={barcodeInput}
            onChange={e => { setBarcodeInput(e.target.value); setNameSearch('') }}
            aria-label="Barcode scanner input"
            className="sr-only"
          />
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              value={nameSearch}
              onChange={e => { setNameSearch(e.target.value); setBarcodeInput('') }}
              placeholder="Search by name... (F2)"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              aria-label="Product name search"
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex gap-2 min-h-0">
          {!nameSearch && (
            <nav className="w-36 shrink-0 overflow-y-auto flex flex-col gap-1 pr-1" aria-label="Product categories">
              <SidebarCategoryBtn label="All" count={products.length} isActive={selectedCategory == null} onClick={() => handleSelectCategory(null)} />
              <SidebarCategoryBtn label="Bundle" count={bundles.length} isActive={selectedCategory === 'bundle'} onClick={() => handleSelectCategory('bundle')} accent="indigo" />
              {categories.map(cat => (
                <SidebarCategoryBtn key={cat.id} label={cat.name} count={cat.count} isActive={selectedCategory === cat.id} onClick={() => handleSelectCategory(cat.id)} />
              ))}
            </nav>
          )}

          <div className="flex-1 overflow-y-auto">
            {selectedCategory !== 'bundle' && filteredProducts.length === 0 && !loadingProducts && (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">
                {selectedCategory == null ? 'No products found' : 'No products in this category'}
              </div>
            )}
            {selectedCategory === 'bundle' && bundles.length === 0 && !loadingProducts && (
              <div className="flex items-center justify-center h-32 text-gray-400 dark:text-slate-500 text-sm">No active bundles</div>
            )}

            {selectedCategory === 'bundle' && bundles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-20 md:pb-4">
                {bundles.map(bundle => (
                  <BundleCard key={`bundle-${bundle.id}`} bundle={bundle}
                    onSelect={() => setPendingBundle({ bundleDef: bundle, selectedItems: [] })} />
                ))}
              </div>
            )}

            {selectedCategory !== 'bundle' && filteredProducts.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-20 md:pb-4">
                {filteredProducts.map(p => (
                  <ProductCard key={p.id} product={p} onAdd={handleAddToCart} />
                ))}
              </div>
            )}

            {loadingProducts && <Spinner className="py-4" />}
            {selectedCategory == null && <div ref={sentinelRef} className="h-4" aria-hidden="true" />}
          </div>
        </div>

        {(cart.length > 0 || stagedItems.length > 0) && (
          <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <button onClick={() => setMobileTab('cart')}
              className="pointer-events-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg transition-colors cursor-pointer whitespace-nowrap">
              {(() => { const tc = cart.length + stagedItems.length; return `View Cart \u00b7 ${tc} item${tc !== 1 ? 's' : ''} \u00b7 ${fmt(shouldRound ? roundedTotal : total)}` })()}
            </button>
          </div>
        )}
      </div>

    </div>

    <div className="hidden md:flex items-center justify-center py-1 print:hidden shrink-0">
      <p className="text-xs text-gray-400 dark:text-slate-500 select-none">
        <kbd className="font-mono">F2</kbd> Search {' | '}
        <kbd className="font-mono">F12</kbd> Checkout {' | '}
        <kbd className="font-mono">+</kbd> Add {' | '}
        <kbd className="font-mono">-</kbd> Remove {' | '}
        <kbd className="font-mono">Esc</kbd> Cancel
      </p>
    </div>

      {/* Bundle selection modal — step wizard for multi-step bundles, flat modal otherwise */}
      {pendingBundle && (
        pendingBundle.bundleDef.hasSteps ? (
          <BundleStepWizard
            bundleDef={pendingBundle.bundleDef}
            onComplete={handleBundleComplete}
            onCancel={() => setPendingBundle(null)}
          />
        ) : (
          <BundleSelectionModal
            bundleDef={pendingBundle.bundleDef}
            products={products}
            onComplete={handleBundleComplete}
            onCancel={() => setPendingBundle(null)}
          />
        )
      )}

      {/* Modifier selection modal */}
      {pendingModifierProduct && (
        <ModifierModal
          product={pendingModifierProduct.product}
          modifierGroups={pendingModifierProduct.modifierGroups}
          onConfirm={handleModifierConfirm}
          onCancel={() => setPendingModifierProduct(null)}
        />
      )}

      {/* Void item confirmation dialog */}
      {voidingItemId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-xs mx-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-2">Void Item?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">This will notify the kitchen to discard the item.</p>
            <div className="flex gap-3">
              <button onClick={() => setVoidingItemId(null)}
                className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={() => handleVoidItem(voidingItemId)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-2 text-sm font-medium transition-colors cursor-pointer">
                Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout confirmation modal */}
      {confirmCheckout && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 overflow-y-auto py-4 sm:py-0"
          role="dialog" aria-modal="true" aria-labelledby="checkout-modal-title">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 id="checkout-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">Confirm Checkout</h2>
            <div className="space-y-3 text-sm mb-4">

              <CustomerSelect customers={customers} selected={selectedCustomer}
                onSelect={setCustomer} onCreateNew={handleCreateCustomer} canCreate={canCreateCustomer} />

              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Sub Total</span><span>{fmt(subTotal)}</span>
              </div>

              {!isZeroTotal && itemDiscountTotal > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span>Item Discounts</span>
                  <span className="text-orange-600 dark:text-orange-400">-{fmt(itemDiscountTotal)}</span>
                </div>
              )}

              {/* Payment Method — placed before discount controls so selecting
                  a zero-total method immediately hides them */}
              {paymentMethods.length > 0 && (
                <div className="flex justify-between items-center text-gray-600 dark:text-slate-400">
                  <span>Payment Method</span>
                  <select value={selectedPaymentMethodId ?? ''} onChange={e => handlePaymentMethodChange(Number(e.target.value) || null)}
                    className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100">
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>
                </div>
              )}

              {/* Voucher dropdown — hidden in zero-total mode */}
              {!isZeroTotal && (
                <div className="mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Voucher</label>
                  {appliedVoucher ? (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <span className="text-green-700 dark:text-green-400 text-sm font-medium flex-1">
                        {appliedVoucher.discountType === DISCOUNT_TYPE.PERCENTAGE
                          ? `${appliedVoucher.name} \u2014 ${appliedVoucher.discountValue}% off`
                          : appliedVoucher.discountType === DISCOUNT_TYPE.FIXED
                            ? `${appliedVoucher.name} \u2014 ${fmt(appliedVoucher.discountValue)} off`
                            : `${appliedVoucher.name} \u2014 Override pricing applied`}
                      </span>
                      <button type="button" onClick={handleRemoveVoucher} className="text-red-500 dark:text-red-400 text-xs underline cursor-pointer">Remove</button>
                    </div>
                  ) : (
                    <select value="" onChange={e => handleSelectVoucher(e.target.value)}
                      disabled={vouchersLoading || activeVouchers.length === 0}
                      className="w-full border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                      <option value="">{vouchersLoading ? 'Loading vouchers...' : activeVouchers.length === 0 ? 'No active vouchers' : '\u2014 Select a voucher \u2014'}</option>
                      {activeVouchers.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.code} {'\u2014'} {v.name}
                          {v.discountType === DISCOUNT_TYPE.PERCENTAGE ? ` (${v.discountValue}% off)` : v.discountType === DISCOUNT_TYPE.FIXED ? ` (${fmt(v.discountValue)} off)` : ' (Package pricing)'}
                        </option>
                      ))}
                    </select>
                  )}
                  {voucherError && <p className="text-red-500 dark:text-red-400 text-xs mt-1">{voucherError}</p>}
                </div>
              )}

              {!isZeroTotal && appliedVoucher && voucherDiscount > 0 && (
                <div className="flex justify-between text-gray-600 dark:text-slate-400">
                  <span>Voucher ({appliedVoucher.code})</span>
                  <span className="text-indigo-600 dark:text-indigo-400">-{fmt(voucherDiscount)}</span>
                </div>
              )}

              {/* Order-level discount — hidden in zero-total mode */}
              {!isZeroTotal && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 dark:text-slate-400">Discount</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button type="button" onClick={() => { setDiscountType(DISCOUNT_TYPE.FIXED); setDiscountValue(0) }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${discountType === DISCOUNT_TYPE.FIXED ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                        aria-pressed={discountType === DISCOUNT_TYPE.FIXED}>Fixed</button>
                      <button type="button" onClick={() => { setDiscountType(DISCOUNT_TYPE.PERCENT); setDiscountValue(0) }}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${discountType === DISCOUNT_TYPE.PERCENT ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600'}`}
                        aria-pressed={discountType === DISCOUNT_TYPE.PERCENT}>%</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      {discountType === DISCOUNT_TYPE.PERCENT ? `${discountValue || 0}% = ${fmt(orderDiscount)}` : 'Amount'}
                    </span>
                    {discountType === DISCOUNT_TYPE.FIXED ? (
                      <PriceInput value={discountValue} onChange={val => setDiscountValue(parseFloat(val) || 0)}
                        placeholder="0.00"
                        className="w-24 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50" />
                    ) : (
                      <div className="relative">
                        <input type="number" min="0" max="100" step="0.1" value={discountValue}
                          onChange={e => setDiscountValue(Math.min(100, parseFloat(e.target.value) || 0))}
                          placeholder="0"
                          className="w-24 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 pr-6 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50"
                          aria-label="Discount percentage" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-slate-500 pointer-events-none">%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isZeroTotal && shouldRound && roundingAdjustment !== 0 && (
                <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 italic">
                  <span>Rounding</span>
                  <span className={roundingAdjustment > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                    {roundingAdjustment > 0 ? '+' : ''}{fmt(Math.abs(roundingAdjustment))}
                  </span>
                </div>
              )}

              {/* Member Redemption deduction line */}
              {isZeroTotal && total > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-400">Member Redemption</span>
                  <span className="text-purple-600 dark:text-purple-400 font-medium">-{fmt(total)}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-800 dark:text-slate-200 font-semibold border-t border-gray-100 dark:border-slate-700 pt-2">
                <span>Total</span><span>{fmt(shouldRound ? roundedTotal : grandTotal)}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600 dark:text-slate-400">
                <label>Paid</label>
                <PriceInput value={isZeroTotal ? 0 : paid} onChange={val => setPaid(parseFloat(val) || 0)} placeholder="0.00"
                  disabled={isZeroTotal || checkingOut}
                  className="w-24 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50" />
              </div>

              <div className="flex justify-between font-medium text-yellow-700 dark:text-yellow-400">
                <span>Due</span><span>{fmt(due)}</span>
              </div>

              {!isZeroTotal && !selectedMethod?.autoFillAmount && Number(paid) > currentDue && (
                <div className="flex justify-between font-semibold text-green-700 dark:text-green-400">
                  <span>Change</span><span>{fmt(Number(paid) - currentDue)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={handleCloseSettleModal} disabled={checkingOut}
                className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleCheckout}
                disabled={checkingOut || !selectedCustomer || (!isZeroTotal && !selectedMethod?.autoFillAmount && Number(paid) < currentDue)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50">
                {checkingOut ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Table modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-80 max-w-full mx-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-200 mb-4">Merge Tables</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">Select tables to absorb into the current order:</p>
            {occupiedTables.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-4">No other open dine-in orders</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {occupiedTables.map(order => (
                  <label key={order.id} className="flex items-center gap-3 p-2 border border-gray-100 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700">
                    <input type="checkbox" checked={selectedMergeTables.includes(order.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedMergeTables(p => [...p, order.id])
                        else setSelectedMergeTables(p => p.filter(id => id !== order.id))
                      }} />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {order.table
                        ? `Table ${order.table.number}${order.table.label ? ` \u2013 ${order.table.label}` : ''}`
                        : `Order #${order.id}`}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowMergeModal(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                Cancel
              </button>
              <button onClick={handleMergeConfirm} disabled={selectedMergeTables.length === 0 || merging}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {merging ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

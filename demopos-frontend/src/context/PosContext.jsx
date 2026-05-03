import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'
import { useCurrency } from './CurrencyContext'
import { formatCurrency } from '../lib/utils/currency'
import cartApi from '../api/cart'
import api from '../api/axios'
import productsApi from '../api/products'
import { getAllCustomers, createCustomer } from '../api/customers'
import { createOrder, getOrderById } from '../api/sales'
import paymentMethodsApi from '../api/payment-methods'
import { getAll as getSettings } from '../api/settings'
import { getPosBundles } from '../api/bundles'
import { applyCashRounding } from '../lib/utils/rounding'
import { openKitchenTicket } from '../lib/utils/kitchen'
import { ORDER_TYPE } from '../constants/orderTypes'
import { TABLE_STATUS } from '../constants/tableStatuses'
import { DISCOUNT_TYPE } from '../constants/discountTypes'
import { POS_PHASE } from '../constants/posPhases'
import { POS_ROUTES } from '../constants/posRoutes'
import { getActiveTables } from '../api/tables'
import {
  createOpenOrder,
  getOpenOrderForTable,
  getOpenOrders,
  addItemsBatch,
  updateOrderItem,
  voidOrderItem,
  sendToKitchen,
  settleOrder,
  mergeOrders,
} from '../api/open-orders'
import { getModifierGroups } from '../api/modifiers'
import { getActiveVouchers } from '../api/vouchers'
import usePageTitle from '../hooks/usePageTitle'

// ── Web Audio beeps (no audio files needed) ──────────────────────────────────
function playBeep({ frequency = 880, duration = 120, type = 'sine', volume = 0.3 } = {}) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = frequency
    gain.gain.value = volume
    osc.start()
    osc.stop(ctx.currentTime + duration / 1000)
    osc.onended = () => ctx.close()
  } catch {
    // AudioContext not available — fail silently
  }
}
function playSuccess() { playBeep({ frequency: 1000, duration: 80 }) }
function playWarning() { playBeep({ frequency: 400, duration: 200, type: 'square' }) }

// ── Pure helpers (exported so components can import them) ─────────────────────
// Cart items from CartItemDto (walk-in) use BundleHeaderPosCartId,
// while SaleItemDto (dine-in / staged) use BundleHeaderSaleItemId.
// This helper normalises both so CartTable works for both modes.
export const bundleParentId = item =>
  item.bundleHeaderSaleItemId ?? item.bundleHeaderPosCartId ?? null

const PAGE_SIZE = 96

/** Builds the createOpenOrder payload based on order type. */
function buildOpenOrderPayload(orderType, selectedTable) {
  return orderType === ORDER_TYPE.TAKEAWAY
    ? { orderType: ORDER_TYPE.TAKEAWAY }
    : { tableId: selectedTable?.id, orderType: ORDER_TYPE.DINE_IN }
}

/**
 * Converts a local stagedItems array into the batch payload expected by
 * POST /sales/{id}/items/batch.
 */
function buildBatchPayload(stagedItems) {
  return stagedItems
    .map(s => {
      if (s.isBundleHeader) {
        return {
          bundleId: s.bundleId,
          quantity: s.quantity ?? 1,
          selectedProducts: (s.selectedProducts ?? []).map(p => ({
            productId: p.productId ?? p.id,
            quantity:  p.quantity ?? 1,
            // Include bundleStepId when present (multi-step bundles)
            ...(p.bundleStepId ? { bundleStepId: p.bundleStepId } : {}),
          })),
        }
      }
      if (s.bundleHeaderSaleItemId != null) return null
      return {
        productId: s.productId,
        quantity:  s.quantity,
        ...(s.modifierNote ? { modifierNote: s.modifierNote } : {}),
        ...(s.discountedPrice != null && s.discountedPrice !== (s.price ?? s.discountedPrice)
          ? { overriddenPrice: s.discountedPrice } : {}),
      }
    })
    .filter(Boolean)
}

// ── Context ───────────────────────────────────────────────────────────────────
const PosContext = createContext(null)

// ── Provider ──────────────────────────────────────────────────────────────────
export function PosProvider({ children }) {
  usePageTitle('POS Terminal')
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { symbol, precision } = useCurrency()
  const fmt = useMemo(() => amount => formatCurrency(amount, symbol, precision), [symbol, precision])

  const perms              = user?.permissions ?? []
  const canCreate          = perms.includes('sale_create')
  const canCreateCustomer  = perms.includes('customer_create')

  // ── State ────────────────────────────────────────────────────────────────
  const [cart, setCart]                     = useState([])
  const [products, setProducts]             = useState([])
  const [productPage, setProductPage]       = useState(1)
  const [hasMoreProducts, setHasMore]       = useState(true)
  const [loadingProducts, setLoadingP]      = useState(false)
  const [loadingCart, setLoadingCart]       = useState(true)
  const [customers, setCustomers]           = useState([])
  const [selectedCustomer, setCustomer]     = useState(null)
  const [nameSearch, setNameSearch]         = useState('')
  const [barcodeInput, setBarcodeInput]     = useState('')

  // null = All, 'bundle' = Bundles tab, number = specific category id
  const [selectedCategory, setSelectedCategory] = useState(null)

  const [bundles, setBundles]               = useState([])
  const [pendingBundle, setPendingBundle]   = useState(null)

  // discountType: DISCOUNT_TYPE.FIXED | DISCOUNT_TYPE.PERCENT
  const [discountType, setDiscountType]     = useState(DISCOUNT_TYPE.FIXED)
  const [discountValue, setDiscountValue]   = useState(0)
  const [itemDiscounts, setItemDiscounts]   = useState({})

  const [paid, setPaid]                     = useState(0)
  const [checkingOut, setCheckingOut]       = useState(false)
  const [confirmCheckout, setConfirmCheckout] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(null)
  const [mobileTab, setMobileTab]           = useState('products')
  const [roundingEnabled, setRoundingEnabled] = useState(false)
  const [roundingQuantum, setRoundingQuantum] = useState(0.05)

  // ── Restaurant mode state ─────────────────────────────────────────────────
  const [restaurantMode, setRestaurantMode]     = useState(false)

  // posPhase is now derived from the current route instead of local state.
  // POS_PHASE.TABLE_SELECT → /pos/tables
  // POS_PHASE.ORDERING     → /pos/table/:id, /pos/walk-in, /pos/takeaway, /pos (non-restaurant)
  // POS_PHASE.POS          → /pos (initial, before restaurant mode is determined)
  const posPhase = useMemo(() => {
    const path = location.pathname
    if (path === POS_ROUTES.TABLES) return POS_PHASE.TABLE_SELECT
    if (path.startsWith(`${POS_ROUTES.BASE}/table/`) || path === POS_ROUTES.WALK_IN || path === POS_ROUTES.TAKEAWAY)
      return POS_PHASE.ORDERING
    // /pos index — if restaurant mode, treat as TABLE_SELECT; otherwise ORDERING
    if (path === POS_ROUTES.BASE) return restaurantMode ? POS_PHASE.TABLE_SELECT : POS_PHASE.ORDERING
    return POS_PHASE.POS
  }, [location.pathname, restaurantMode])
  const [tables, setTables]                     = useState([])
  const [loadingTables, setLoadingTables]       = useState(false)
  const [selectedTable, setSelectedTable]       = useState(null)
  const [openOrderId, setOpenOrderId]           = useState(null)
  const [orderType, setOrderType]               = useState(ORDER_TYPE.POS)
  const [voidingItemId, setVoidingItemId]       = useState(null)
  const [sendingToKitchen, setSendingToKitchen] = useState(false)
  // Staged items: local-only dine-in items not yet committed to the DB.
  // Cleared on kitchen send, checkout, or table navigation.
  const [stagedItems, setStagedItems]           = useState([])

  // Auto-open settle modal after phase transition (from table-detail → ordering)
  const [pendingSettle, setPendingSettle]       = useState(false)

  // ── Voucher state ──────────────────────────────────────────────────────────
  const [appliedVoucher, setAppliedVoucher]   = useState(null)
  const [activeVouchers, setActiveVouchers]   = useState([])
  const [vouchersLoading, setVouchersLoading] = useState(false)
  const [voucherError, setVoucherError]       = useState('')

  // ── Merge table state ──────────────────────────────────────────────────────
  const [showMergeModal, setShowMergeModal]           = useState(false)
  const [occupiedTables, setOccupiedTables]           = useState([])
  const [selectedMergeTables, setSelectedMergeTables] = useState([])
  const [merging, setMerging]                         = useState(false)

  // ── Modifier state ─────────────────────────────────────────────────────────
  const [pendingModifierProduct, setPendingModifierProduct] = useState(null)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const barcodeRef         = useRef(null)
  const sentinelRef        = useRef(null)
  const searchInputRef     = useRef(null)
  const barcodeDebounceRef = useRef(null)
  const nameDebounceRef    = useRef(null)
  const loadingRef         = useRef(false)

  // ── Derived: category sidebar ─────────────────────────────────────────────
  const categories = useMemo(() => {
    const map = {}
    for (const p of products) {
      const id   = p.categoryId   ?? null
      const name = p.categoryName ?? p.category?.name ?? 'Uncategorized'
      if (id == null) continue
      if (!map[id]) map[id] = { id, name, count: 0 }
      map[id].count++
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
  }, [products])

  const filteredProducts = useMemo(() => {
    if (selectedCategory == null) return products
    if (selectedCategory === 'bundle') return []
    return products.filter(p => p.categoryId === selectedCategory)
  }, [products, selectedCategory])

  // ── Derived values ─────────────────────────────────────────────────────────
  // Exclude bundle sub-items from subTotal — their cost is captured by the bundle header row.
  // Include staged items so the order summary reflects the full pending total.
  const subTotal = useMemo(() => [
    ...cart.filter(i => !bundleParentId(i) && !i.isVoided),
    ...stagedItems,
  ].reduce((s, i) => s + Number(i.rowTotal ?? i.total ?? 0), 0), [cart, stagedItems])

  const itemDiscountTotal  = Object.values(itemDiscounts).reduce((s, d) => s + Number(d || 0), 0)
  const subTotalAfterItems = Math.max(0, subTotal - itemDiscountTotal)

  // Voucher discount — applied before the manual order-level discount
  const voucherDiscount = useMemo(() => {
    if (!appliedVoucher) return 0
    if (appliedVoucher.discountType === DISCOUNT_TYPE.FIXED)
      return appliedVoucher.discountValue ?? 0
    if (appliedVoucher.discountType === DISCOUNT_TYPE.PERCENTAGE)
      return Math.round((subTotalAfterItems * (appliedVoucher.discountValue ?? 0)) / 100 * 100) / 100
    // override: compute savings for matching items so the user sees a deduction preview
    if (appliedVoucher.discountType === DISCOUNT_TYPE.OVERRIDE &&
        appliedVoucher.appliesTo === 'specific_items' &&
        appliedVoucher.items?.length > 0) {
      const overrideMap = {}
      for (const oi of appliedVoucher.items) {
        if (oi.overridePrice != null) overrideMap[oi.productId] = Number(oi.overridePrice)
      }
      let savings = 0
      const activeCartItems = [
        ...cart.filter(i => !bundleParentId(i) && !i.isVoided),
        ...stagedItems.filter(i => !bundleParentId(i)),
      ]
      for (const item of activeCartItems) {
        const pid = item.productId
        if (pid != null && overrideMap[pid] != null) {
          const diff = (Number(item.price ?? 0) - overrideMap[pid]) * (item.quantity ?? 1)
          if (diff > 0) savings += diff
        }
      }
      return Math.round(savings * 100) / 100
    }
    return 0
  }, [appliedVoucher, subTotalAfterItems, cart, stagedItems])

  const afterVoucher   = Math.max(0, subTotalAfterItems - voucherDiscount)
  const orderDiscount  = discountType === DISCOUNT_TYPE.PERCENT
    ? Math.round((afterVoucher * discountValue / 100) * 100) / 100
    : discountValue
  const total          = Math.max(0, Math.round((afterVoucher - orderDiscount) * 100) / 100)
  const selectedMethod = useMemo(
    () => paymentMethods.find(pm => pm.id === selectedPaymentMethodId) ?? null,
    [paymentMethods, selectedPaymentMethodId]
  )

  // Zero-total (member) mode: when the selected method has zeroTotal=true,
  // the entire bill is redeemed and total becomes 0.
  const isZeroTotal  = selectedMethod?.zeroTotal ?? false
  const grandTotal   = isZeroTotal ? 0 : total

  // Rounding applies only when enabled AND the selected method is cash (not auto-fill)
  // Rounding is skipped in zero-total mode (nothing to round when total is 0)
  const isCashPayment  = !(selectedMethod?.autoFillAmount ?? false)
  const shouldRound    = roundingEnabled && isCashPayment && !isZeroTotal
  const { roundedTotal, roundingAdjustment } = shouldRound
    ? applyCashRounding(grandTotal, roundingQuantum)
    : { roundedTotal: grandTotal, roundingAdjustment: 0 }
  const currentDue     = roundedTotal
  const due            = Math.max(0, Math.round((roundedTotal - Math.min(Number(paid), roundedTotal)) * 100) / 100)

  // ── Product loading ────────────────────────────────────────────────────────
  async function loadProducts(page, query, append) {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoadingP(true)
    try {
      const res  = await productsApi.getPosProducts({ q: query || undefined, page, pageSize: PAGE_SIZE })
      const data = res.data?.data ?? {}
      const items   = data.items  ?? []
      const hasMore = data.hasMore ?? false
      setProducts(prev => append ? [...prev, ...items] : items)
      setHasMore(hasMore)
    } catch {
      toast.error('Failed to load products')
    } finally {
      loadingRef.current = false
      setLoadingP(false)
    }
  }

  // ── Mount: clear cart, load customers, load products page 1 ───────────────
  useEffect(() => {
    if (!canCreate) return
    let cancelled = false

    async function init() {
      let restaurantEnabled = false
      try {
        const settingsRes = await getSettings()
        const s = settingsRes?.data?.data ?? {}
        if (!cancelled) {
          setRoundingEnabled(s.rounding_enabled === 'true')
          setRoundingQuantum(s.rounding_quantum === '0.10' ? 0.10 : 0.05)
          restaurantEnabled = s.restaurant_mode === 'true'
          setRestaurantMode(restaurantEnabled)
          if (restaurantEnabled) navigate(POS_ROUTES.TABLES, { replace: true })
        }
      } catch { /* non-critical — rounding defaults to disabled */ }

      // Clear cart on POS page load (business rule) — skipped in restaurant mode
      if (!restaurantEnabled) {
        try {
          await cartApi.clear()
          if (!cancelled) { setCart([]); setLoadingCart(false) }
        } catch {
          if (!cancelled) { toast.error('Failed to initialise cart'); setLoadingCart(false) }
        }
      } else {
        if (!cancelled) setLoadingCart(false)
      }

      try {
        const res  = await getAllCustomers()
        const list = res.data?.data ?? res.data ?? []
        if (!cancelled) {
          setCustomers(list)
          const walking = list.find(c => c.id === 1) ?? list[0] ?? null
          setCustomer(walking)
        }
      } catch {
        if (!cancelled) toast.error('Failed to load customers')
      }

      try {
        const pmRes  = await paymentMethodsApi.getActive()
        const pmList = pmRes.data?.data ?? []
        if (!cancelled) {
          setPaymentMethods(pmList)
          const defaultPm = pmList.find(pm => pm.isDefault) ?? pmList[0] ?? null
          setSelectedPaymentMethodId(defaultPm?.id ?? null)
        }
      } catch { /* non-critical */ }

      try {
        const bundleRes = await getPosBundles()
        if (!cancelled) setBundles(bundleRes.data?.data ?? bundleRes.data ?? [])
      } catch { /* non-critical — POS works without bundles */ }

      if (restaurantEnabled && !cancelled) {
        setLoadingTables(true)
        try {
          const tableRes = await getActiveTables()
          if (!cancelled) setTables(tableRes.data?.data ?? tableRes.data ?? [])
        } catch { /* non-critical */ }
        finally { if (!cancelled) setLoadingTables(false) }
      }
    }

    init()
    loadProducts(1, '', false)
    return () => { cancelled = true }
  }, [canCreate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load active vouchers ──────────────────────────────────────────────────
  useEffect(() => {
    if (!canCreate) return
    setVouchersLoading(true)
    getActiveVouchers()
      .then(res => setActiveVouchers(res?.data?.data ?? []))
      .catch(() => {})
      .finally(() => setVouchersLoading(false))
  }, [canCreate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMoreProducts && !loadingRef.current)
          setProductPage(p => p + 1)
      },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMoreProducts, selectedCategory]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (productPage === 1) return
    loadProducts(productPage, nameSearch || barcodeInput || '', true)
  }, [productPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Name search debounce ──────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(nameDebounceRef.current)
    nameDebounceRef.current = setTimeout(() => {
      setProductPage(1)
      setHasMore(true)
      loadProducts(1, nameSearch, false)
    }, 400)
    return () => clearTimeout(nameDebounceRef.current)
  }, [nameSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Barcode debounce ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!barcodeInput.trim()) return
    clearTimeout(barcodeDebounceRef.current)
    barcodeDebounceRef.current = setTimeout(async () => {
      try {
        const res   = await productsApi.getPosProducts({ q: barcodeInput.trim(), pageSize: 1 })
        const items = res.data?.data?.items ?? []
        if (items.length === 1 && items[0].sku === barcodeInput.trim()) {
          if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY)) {
            await handleAddToCart(items[0])
          } else {
            await handleAddToCartById(items[0].id)
          }
          setBarcodeInput('')
        } else {
          setProductPage(1)
          setProducts(items)
          setHasMore(res.data?.data?.hasMore ?? false)
        }
      } catch { /* barcode search failed silently */ }
    }, 300)
    return () => clearTimeout(barcodeDebounceRef.current)
  }, [barcodeInput]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'F2') { e.preventDefault(); searchInputRef.current?.focus() }
      if (e.key === 'F12' && !isInputFocused) {
        e.preventDefault()
        if (cart.length > 0 && !confirmCheckout) openCheckoutModal()
      }
      if (e.key === 'Escape') setConfirmCheckout(false)
      if ((e.key === '+' || e.key === '=') && !isInputFocused) {
        e.preventDefault()
        if (cart.length > 0) handleIncrement(cart[cart.length - 1].id)
      }
      if (e.key === '-' && !isInputFocused) {
        e.preventDefault()
        if (cart.length > 0) handleDecrement(cart[cart.length - 1].id)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, confirmCheckout]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-open settle modal after phase transition ─────────────────────────
  useEffect(() => {
    if (pendingSettle && posPhase === POS_PHASE.ORDERING) {
      openCheckoutModal()
      setPendingSettle(false)
    }
  }, [posPhase, pendingSettle]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Restaurant mode: table selection ──────────────────────────────────────
  async function handleSelectTable(table) {
    setItemDiscounts({})
    try {
      if (table.status === TABLE_STATUS.OCCUPIED) {
        const res = await getOpenOrderForTable(table.id)
        const existingOrder = res.data?.data
        if (existingOrder) {
          const activeItems = (existingOrder.items ?? []).filter(i => !i.isVoided)
          if (activeItems.length === 0) {
            setOpenOrderId(null); setCart([]); setStagedItems([])
            setSelectedTable({ ...table, status: TABLE_STATUS.AVAILABLE })
            setOrderType(ORDER_TYPE.DINE_IN)
            setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: TABLE_STATUS.AVAILABLE } : t))
            getActiveTables().then(r => setTables(r.data?.data ?? r.data ?? [])).catch(() => {})
          } else {
            setOpenOrderId(existingOrder.id)
            setCart(existingOrder.items ?? [])
            setStagedItems([])
            setSelectedTable(table)
            setOrderType(ORDER_TYPE.DINE_IN)
          }
        } else {
          setOpenOrderId(null); setCart([]); setStagedItems([])
          setSelectedTable({ ...table, status: TABLE_STATUS.AVAILABLE })
          setOrderType(ORDER_TYPE.DINE_IN)
          setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: TABLE_STATUS.AVAILABLE } : t))
        }
      } else {
        setOpenOrderId(null); setCart([]); setStagedItems([])
        setSelectedTable(table)
        setOrderType(ORDER_TYPE.DINE_IN)
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setOpenOrderId(null); setCart([]); setStagedItems([])
        setSelectedTable({ ...table, status: TABLE_STATUS.AVAILABLE })
        setOrderType(ORDER_TYPE.DINE_IN)
        setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: TABLE_STATUS.AVAILABLE } : t))
        getActiveTables().then(r => setTables(r.data?.data ?? r.data ?? [])).catch(() => {})
      } else {
        toast.error(err.response?.data?.message ?? 'Could not open table order')
      }
    }
  }

  async function handleEnterPosMode(type) {
    setOrderType(type)
    setSelectedTable(null)
    setOpenOrderId(null)
    setStagedItems([])
    setItemDiscounts({})
    try {
      const res = await cartApi.get()
      setCart(res.data?.data ?? [])
    } catch { setCart([]) }
    // Navigation is handled by handleWalkIn / handleTakeaway after this completes
  }

  const handleTakeaway = async () => {
    await handleEnterPosMode(ORDER_TYPE.TAKEAWAY)
    navigate(POS_ROUTES.TAKEAWAY)
  }
  const handleWalkIn = async () => {
    await handleEnterPosMode(ORDER_TYPE.POS)
    navigate(POS_ROUTES.WALK_IN)
  }

  // ── Restaurant mode: void an item ─────────────────────────────────────────
  async function handleVoidItem(itemId) {
    setVoidingItemId(null)
    try {
      const res = await voidOrderItem(openOrderId, itemId)
      const sale = res.data?.data
      const voidTicket = res.data?.voidTicket
      setCart(sale?.items ?? [])
      const activeItems = (sale?.items ?? []).filter(i => !i.isVoided)
      if (activeItems.length === 0 && selectedTable) {
        try {
          const tableRes = await getActiveTables()
          setTables(tableRes.data?.data ?? tableRes.data ?? [])
        } catch { /* non-critical */ }
        setOpenOrderId(null); setSelectedTable(null); setCart([]); setStagedItems([])
      }
      if (voidTicket) openKitchenTicket(voidTicket, openOrderId, 'void')
      toast.success('Item voided')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not void item')
    }
  }

  // ── Restaurant mode: send items to kitchen (two-phase) ────────────────────
  async function handleSendToKitchen() {
    setSendingToKitchen(true)
    try {
      let orderId = openOrderId
      if (stagedItems.length > 0) {
        if (!orderId) {
          const orderRes = await createOpenOrder(buildOpenOrderPayload(orderType, selectedTable))
          orderId = orderRes.data?.data?.id
          setOpenOrderId(orderId)
          if (orderType !== ORDER_TYPE.TAKEAWAY) {
            try {
              const tableRes = await getActiveTables()
              setTables(tableRes.data?.data ?? tableRes.data ?? [])
            } catch { /* non-critical */ }
          }
        }
        await addItemsBatch(orderId, buildBatchPayload(stagedItems))
        setStagedItems([])
      }
      if (orderId) {
        const kitchenRes = await sendToKitchen(orderId)
        const ticket = kitchenRes.data?.data
        if (ticket) openKitchenTicket(ticket, orderId)
        const cartRefreshPromise = orderType === ORDER_TYPE.TAKEAWAY
          ? getOrderById(orderId)
          : selectedTable?.id ? getOpenOrderForTable(selectedTable.id) : null
        if (cartRefreshPromise) {
          const orderRes = await cartRefreshPromise
          setCart(orderRes.data?.data?.items ?? [])
        }
      }
      toast.success('Sent to kitchen')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to send to kitchen')
    } finally {
      setSendingToKitchen(false)
    }
  }

  // ── Voucher handlers ──────────────────────────────────────────────────────
  function handleSelectVoucher(voucherId) {
    setVoucherError('')
    if (!voucherId) { setAppliedVoucher(null); return }
    const voucher = activeVouchers.find(v => v.id === Number(voucherId))
    if (voucher) setAppliedVoucher(voucher)
  }

  function handleRemoveVoucher() {
    setAppliedVoucher(null)
    setVoucherError('')
  }

  function handleSelectCategory(catId) { setSelectedCategory(catId) }

  /** Navigate from table select → ordering screen for the selected table. */
  function navigateToTableOrdering(tableId, settle = false) {
    navigate(settle ? `${POS_ROUTES.TABLE(tableId)}?settle=true` : POS_ROUTES.TABLE(tableId))
  }

  /** Navigate back to table select (discards any unsent staged items). */
  function handleBackToTables() {
    setStagedItems([])
    navigate(POS_ROUTES.TABLES)
  }

  // ── Merge table handlers ──────────────────────────────────────────────────
  async function handleOpenMergeModal() {
    try {
      const { data } = await getOpenOrders()
      const orders = data.data || data
      const others = Array.isArray(orders)
        ? orders.filter(s => s.id !== openOrderId && s.orderType === ORDER_TYPE.DINE_IN)
        : []
      setOccupiedTables(others)
      setSelectedMergeTables([])
      setShowMergeModal(true)
    } catch {
      toast.error('Failed to load open orders')
    }
  }

  async function handleMergeConfirm() {
    if (selectedMergeTables.length === 0) return
    setMerging(true)
    try {
      await mergeOrders(openOrderId, { absorbSaleIds: selectedMergeTables })
      if (selectedTable?.id) {
        const orderRes = await getOpenOrderForTable(selectedTable.id)
        setCart(orderRes.data?.data?.items ?? [])
      }
      setShowMergeModal(false)
      toast.success('Tables merged successfully')
    } catch {
      toast.error('Failed to merge tables')
    } finally {
      setMerging(false)
    }
  }

  // ── Cart mutation helpers ─────────────────────────────────────────────────
  async function handleAddToCart(product) {
    if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY)) {
      if (product.hasModifiers !== false) {
        try {
          const modRes = await getModifierGroups(product.id)
          const groups = modRes.data?.data ?? modRes.data ?? []
          const hasRequired = Array.isArray(groups) && groups.some(g => g.isRequired && g.isActive !== false)
          if (hasRequired) {
            setPendingModifierProduct({ product, modifierGroups: groups, quantity: 1 })
            return
          }
        } catch { /* modifier check failed — proceed without modifiers */ }
      }
      const unitPrice = product.discountedPrice ?? product.price ?? 0
      const stagedItem = {
        id: `staged-${Date.now()}-${product.id}`,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price ?? product.discountedPrice ?? 0,
        discountedPrice: unitPrice,
        total: unitPrice,
        rowTotal: unitPrice,
        stockQuantity: product.stockQuantity ?? product.quantity ?? 0,
        isVoided: false,
        kitchenSentAt: null,
        isStaged: true,
      }
      setStagedItems(prev => {
        const existing = prev.find(s => s.productId === product.id)
        if (existing) {
          const newQty = existing.quantity + 1
          return prev.map(s => s.productId === product.id
            ? { ...s, quantity: newQty, total: newQty * s.discountedPrice, rowTotal: newQty * s.discountedPrice }
            : s
          )
        }
        return [...prev, stagedItem]
      })
      setMobileTab('cart')
      playSuccess()
      return
    }
    try {
      const res = await cartApi.add(product.id)
      setCart(res.data?.data ?? [])
      setMobileTab('cart')
      playSuccess()
    } catch (err) {
      playWarning()
      toast.error(err.response?.data?.message ?? 'Could not add item')
    }
  }

  async function handleModifierConfirm({ modifierNote, priceAdjustment }) {
    const product  = pendingModifierProduct.product
    const quantity = pendingModifierProduct.quantity ?? 1
    setPendingModifierProduct(null)
    const basePrice      = Number(product.discountedPrice ?? product.price ?? 0)
    const overriddenPrice = priceAdjustment > 0 ? basePrice + priceAdjustment : undefined
    const unitPrice      = overriddenPrice ?? basePrice

    if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY)) {
      const stagedItem = {
        id: `staged-${Date.now()}-${product.id}`,
        productId: product.id,
        productName: product.name,
        quantity,
        price: product.price ?? product.discountedPrice ?? 0,
        discountedPrice: unitPrice,
        total: quantity * unitPrice,
        rowTotal: quantity * unitPrice,
        stockQuantity: product.stockQuantity ?? product.quantity ?? 0,
        modifierNote: modifierNote || undefined,
        isVoided: false,
        kitchenSentAt: null,
        isStaged: true,
      }
      setStagedItems(prev => [...prev, stagedItem])
      setMobileTab('cart')
      playSuccess()
      return
    }
    try {
      const res = await cartApi.add(product.id)
      setCart(res.data?.data ?? [])
      setMobileTab('cart')
      playSuccess()
    } catch (err) {
      playWarning()
      toast.error(err.response?.data?.message ?? 'Could not add item')
    }
  }

  async function handleAddToCartById(productId) {
    try {
      const res = await cartApi.add(productId)
      setCart(res.data?.data ?? [])
      setMobileTab('cart')
      playSuccess()
    } catch (err) {
      playWarning()
      toast.error(err.response?.data?.message ?? 'Could not add item')
    }
  }

  async function handleIncrement(cartItemId) {
    if (String(cartItemId).startsWith('staged-')) {
      const stagedItem = stagedItems.find(s => s.id === cartItemId)
      if (stagedItem?.bundleHeaderSaleItemId != null) return
      setStagedItems(prev => prev.map(s => {
        if (s.id !== cartItemId) return s
        const newQty = s.quantity + 1
        return { ...s, quantity: newQty, total: newQty * s.discountedPrice, rowTotal: newQty * s.discountedPrice }
      }))
      return
    }
    if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY) && openOrderId) {
      try {
        const item = cart.find(i => i.id === cartItemId)
        const res = await updateOrderItem(openOrderId, cartItemId, { quantity: (item?.quantity ?? 1) + 1 })
        setCart(res.data?.data?.items ?? [])
      } catch (err) {
        toast.error(err.response?.data?.message ?? 'Could not increment')
      }
      return
    }
    try {
      const res = await cartApi.increment(cartItemId)
      setCart(res.data?.data ?? [])
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not increment')
    }
  }

  async function handleDecrement(cartItemId) {
    if (String(cartItemId).startsWith('staged-')) {
      const stagedItemCheck = stagedItems.find(s => s.id === cartItemId)
      if (stagedItemCheck?.bundleHeaderSaleItemId != null) return
      setStagedItems(prev => {
        const item = prev.find(s => s.id === cartItemId)
        if (!item) return prev
        const newQty = item.quantity - 1
        if (newQty <= 0) return prev.filter(s => s.id !== cartItemId)
        return prev.map(s => s.id !== cartItemId ? s : {
          ...s, quantity: newQty, total: newQty * s.discountedPrice, rowTotal: newQty * s.discountedPrice,
        })
      })
      return
    }
    if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY) && openOrderId) {
      try {
        const item = cart.find(i => i.id === cartItemId)
        const newQty = (item?.quantity ?? 1) - 1
        if (newQty <= 0) {
          const res = await voidOrderItem(openOrderId, cartItemId)
          const sale = res.data?.data
          const voidTicket = res.data?.voidTicket
          setCart(sale?.items ?? [])
          if (voidTicket) openKitchenTicket(voidTicket, openOrderId, 'void')
        } else {
          const res = await updateOrderItem(openOrderId, cartItemId, { quantity: newQty })
          setCart(res.data?.data?.items ?? [])
        }
      } catch (err) {
        toast.error(err.response?.data?.message ?? 'Could not decrement')
      }
      return
    }
    try {
      const res = await cartApi.decrement(cartItemId)
      setCart(res.data?.data ?? [])
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not decrement')
    }
  }

  async function handleRemoveItem(cartItemId) {
    if (String(cartItemId).startsWith('staged-')) {
      const stagedItem = stagedItems.find(s => s.id === cartItemId)
      if (stagedItem) {
        if (stagedItem.isBundleHeader) {
          setStagedItems(prev => prev.filter(s => s.id !== cartItemId && s.bundleHeaderSaleItemId !== cartItemId))
          return
        }
        if (stagedItem.bundleHeaderSaleItemId != null) return
      }
      setStagedItems(prev => prev.filter(s => s.id !== cartItemId))
      return
    }
    if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY) && openOrderId) {
      try {
        const res = await voidOrderItem(openOrderId, cartItemId)
        const sale = res.data?.data
        const voidTicket = res.data?.voidTicket
        setCart(sale?.items ?? [])
        if (voidTicket) openKitchenTicket(voidTicket, openOrderId, 'void')
      } catch (err) {
        toast.error(err.response?.data?.message ?? 'Could not remove item')
      }
      return
    }
    try {
      const res = await cartApi.remove(cartItemId)
      setCart(res.data?.data ?? [])
      setItemDiscounts(prev => { const next = { ...prev }; delete next[cartItemId]; return next })
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not remove item')
    }
  }

  async function handleClearCart() {
    try {
      const res = await cartApi.clear()
      setCart(res.data?.data ?? [])
      setItemDiscounts({})
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not clear cart')
    }
  }

  async function handlePriceChange(cartItemId, newPrice) {
    try {
      const res = await cartApi.updatePrice(cartItemId, newPrice)
      setCart(res.data?.data ?? [])
    } catch (err) {
      const status = err.response?.status
      if (status === 404) toast('Price edit not available yet', { icon: 'i' })
      else toast.error(err.response?.data?.message ?? 'Could not update price')
    }
  }

  function handleItemDiscountChange(cartItemId, amount) {
    setItemDiscounts(prev => ({ ...prev, [cartItemId]: amount }))
  }

  async function handleBundleComplete(selectedItems) {
    const bundleDef   = pendingBundle?.bundleDef
    const bundleSteps = bundleDef?.steps ?? []

    // Helper: resolve a step label by stepId from the bundle definition
    const stepLabelMap = Object.fromEntries(bundleSteps.map(s => [s.id, s.label]))

    if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY)) {
      const bundlePrice = bundleDef?.price ?? 0
      const headerId    = `staged-bundle-${Date.now()}`
      const headerItem  = {
        id: headerId, isBundleHeader: true, bundleId: bundleDef?.id,
        productId: null, productName: bundleDef?.name ?? 'Bundle',
        quantity: 1, price: bundlePrice, discountedPrice: bundlePrice,
        rowTotal: bundlePrice, total: bundlePrice, stockQuantity: null,
        isVoided: false, kitchenSentAt: null, isStaged: true,
        selectedProducts: selectedItems,
      }
      const subItems = (selectedItems ?? []).map((sel, idx) => ({
        id: `staged-bundle-sub-${Date.now()}-${idx}`,
        isBundleHeader: false, bundleHeaderSaleItemId: headerId,
        productId: sel.productId ?? sel.id,
        productName: sel.productName ?? sel.name ?? '',
        quantity: sel.quantity ?? 1, price: 0, discountedPrice: 0,
        rowTotal: 0, total: 0, isVoided: false, kitchenSentAt: null, isStaged: true,
        // Multi-step bundle fields (null for flat bundles)
        bundleStepId: sel.bundleStepId ?? null,
        bundleStepLabel: sel.bundleStepId ? (stepLabelMap[sel.bundleStepId] ?? null) : null,
      }))
      setStagedItems(prev => [...prev, headerItem, ...subItems])
      setPendingBundle(null)
      setMobileTab('cart')
      playSuccess()
      return
    }
    try {
      const res = await api.post('/cart/bundle', {
        bundleId: bundleDef.id,
        selectedProducts: (selectedItems ?? []).map(sel => ({
          productId: sel.productId,
          quantity: sel.quantity,
          // Include bundleStepId when present (multi-step bundles)
          ...(sel.bundleStepId ? { bundleStepId: sel.bundleStepId } : {}),
        })),
      })
      setCart(res.data?.data ?? [])
      setPendingBundle(null)
      setMobileTab('cart')
      playSuccess()
    } catch (err) {
      playWarning()
      toast.error(err.response?.data?.message ?? 'Could not add bundle')
    }
  }

  async function handleRemoveBundle(headerId) {
    const isStagedBundle = stagedItems.some(s => s.id === headerId && s.isStaged)
    if (isStagedBundle) {
      setStagedItems(prev => prev.filter(s => s.id !== headerId && s.bundleHeaderSaleItemId !== headerId))
      return
    }
    try {
      const res = await api.delete(`/cart/bundle/${headerId}`)
      setCart(res.data?.data ?? [])
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not remove bundle')
    }
  }

  async function handleCreateCustomer(name) {
    try {
      const res = await createCustomer({ name })
      const newCustomer = res.data?.data ?? res.data
      setCustomers(prev => [...prev, newCustomer])
      setCustomer(newCustomer)
      toast.success(`Customer "${name}" created`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not create customer')
    }
  }

  function handlePaymentMethodChange(methodId) {
    setSelectedPaymentMethodId(methodId)
    const method = paymentMethods.find(pm => pm.id === methodId)
    if (method?.zeroTotal) {
      // Zero-total (member) mode: clear all discounts and set paid to 0
      setDiscountType(DISCOUNT_TYPE.FIXED)
      setDiscountValue(0)
      setItemDiscounts({})
      setAppliedVoucher(null)
      setVoucherError('')
      setPaid(0)
    } else if (method?.autoFillAmount) {
      setPaid(currentDue)
    } else {
      setPaid('')
    }
  }

  function openCheckoutModal() {
    setDiscountType(DISCOUNT_TYPE.FIXED)
    setDiscountValue(0)
    setPaid('')
    setCustomer(customers.find(c => c.id === 1) ?? customers[0] ?? null)
    setAppliedVoucher(null)
    setVoucherError('')
    setConfirmCheckout(true)
  }

  function handleCloseSettleModal() {
    setAppliedVoucher(null)
    setVoucherError('')
    setConfirmCheckout(false)
  }

  async function handleCheckout() {
    setCheckingOut(true)
    try {
      const itemDiscountsArray = Object.entries(itemDiscounts)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([cartItemId, amount]) => ({ cartItemId: Number(cartItemId), amount: Number(amount) }))

      let resolvedOrderId = openOrderId
      if (restaurantMode && (orderType === ORDER_TYPE.DINE_IN || orderType === ORDER_TYPE.TAKEAWAY) && stagedItems.length > 0) {
        if (!resolvedOrderId) {
          const orderRes = await createOpenOrder(buildOpenOrderPayload(orderType, selectedTable))
          resolvedOrderId = orderRes.data?.data?.id
          setOpenOrderId(resolvedOrderId)
        }
        const batchRes = await addItemsBatch(resolvedOrderId, buildBatchPayload(stagedItems))
        setCart(batchRes.data?.data?.items ?? [])
        setStagedItems([])
      }

      if (restaurantMode && resolvedOrderId) {
        const settlePayload = isZeroTotal
          ? {
              customerId:      selectedCustomer.id,
              billDiscount:    subTotal,
              discountType:    DISCOUNT_TYPE.MEMBER,
              paid:            0,
              paymentMethodId: selectedPaymentMethodId ?? undefined,
            }
          : {
              customerId:      selectedCustomer.id,
              billDiscount:    orderDiscount,
              discountType:    discountType === DISCOUNT_TYPE.PERCENT ? DISCOUNT_TYPE.PERCENTAGE : DISCOUNT_TYPE.FIXED,
              paid:            Number(paid),
              paymentMethodId: selectedPaymentMethodId ?? undefined,
              ...(appliedVoucher?.code ? { voucherCode: appliedVoucher.code } : {}),
              ...(itemDiscountsArray.length > 0 ? { itemDiscounts: itemDiscountsArray } : {}),
            }
        const res = await settleOrder(resolvedOrderId, settlePayload)
        const newOrder = res.data?.data ?? res.data
        toast.success(`Order #${newOrder.id} settled successfully`)
        if (orderType === ORDER_TYPE.TAKEAWAY) {
          sendToKitchen(newOrder.id)
            .then(res => { const ticket = res.data?.data; if (ticket) openKitchenTicket(ticket, newOrder.id) })
            .catch(() => toast('Kitchen ticket could not be printed — order is paid', { icon: 'i' }))
        }
        navigate(POS_ROUTES.INVOICE(newOrder.id))
      } else {
        const orderPayload = isZeroTotal
          ? {
              customerId:      selectedCustomer.id,
              discount:        subTotal,
              discountType:    DISCOUNT_TYPE.MEMBER,
              paid:            0,
              note:            null,
              paymentMethodId: selectedPaymentMethodId ?? undefined,
            }
          : {
              customerId:      selectedCustomer.id,
              discount:        orderDiscount,
              paid:            Number(paid),
              note:            null,
              paymentMethodId: selectedPaymentMethodId ?? undefined,
              ...(appliedVoucher?.code ? { voucherCode: appliedVoucher.code } : {}),
              ...(itemDiscountsArray.length > 0 ? { itemDiscounts: itemDiscountsArray } : {}),
            }
        const res = await createOrder(orderPayload)
        const newOrder = res.data?.data ?? res.data
        toast.success(`Order #${newOrder.id} created successfully`)
        navigate(POS_ROUTES.INVOICE(newOrder.id))
      }
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Checkout failed')
      setConfirmCheckout(false)
    } finally {
      setCheckingOut(false)
    }
  }

  const value = {
    // permissions
    canCreate, canCreateCustomer,
    // currency
    fmt,
    // cart + products
    cart, setCart, products, loadingProducts, loadingCart,
    // product pagination + search
    productPage, setProductPage, hasMoreProducts,
    nameSearch, setNameSearch, barcodeInput, setBarcodeInput,
    selectedCategory, setSelectedCategory, filteredProducts, categories,
    // bundles
    bundles, pendingBundle, setPendingBundle,
    // customers
    customers, selectedCustomer, setCustomer,
    // discount
    discountType, setDiscountType, discountValue, setDiscountValue,
    itemDiscounts, setItemDiscounts,
    // payment
    paid, setPaid, paymentMethods, selectedPaymentMethodId, selectedMethod,
    checkingOut, confirmCheckout, setConfirmCheckout,
    // rounding
    roundingEnabled, roundingQuantum, shouldRound, roundingAdjustment,
    // derived totals
    subTotal, itemDiscountTotal, subTotalAfterItems, voucherDiscount,
    orderDiscount, total, grandTotal, roundedTotal, currentDue, due,
    // zero-total (member) mode
    isZeroTotal,
    // mobile
    mobileTab, setMobileTab,
    // restaurant mode
    restaurantMode, posPhase,
    tables, loadingTables,
    selectedTable, setSelectedTable,
    openOrderId, setOpenOrderId,
    orderType, setOrderType,
    voidingItemId, setVoidingItemId,
    sendingToKitchen,
    stagedItems, setStagedItems,
    pendingSettle, setPendingSettle,
    // vouchers
    appliedVoucher, setAppliedVoucher,
    activeVouchers, vouchersLoading, voucherError, setVoucherError,
    // merge
    showMergeModal, setShowMergeModal,
    occupiedTables, selectedMergeTables, setSelectedMergeTables, merging,
    // modifiers
    pendingModifierProduct, setPendingModifierProduct,
    // refs
    barcodeRef, sentinelRef, searchInputRef,
    // navigation
    navigateToTableOrdering, handleBackToTables,
    // handlers
    loadProducts,
    handleSelectTable, handleEnterPosMode, handleTakeaway, handleWalkIn,
    handleVoidItem, handleSendToKitchen,
    handleSelectVoucher, handleRemoveVoucher,
    handleSelectCategory,
    handleOpenMergeModal, handleMergeConfirm,
    handleAddToCart, handleModifierConfirm, handleAddToCartById,
    handleIncrement, handleDecrement, handleRemoveItem,
    handleClearCart, handlePriceChange, handleItemDiscountChange,
    handleBundleComplete, handleRemoveBundle,
    handleCreateCustomer, handlePaymentMethodChange,
    openCheckoutModal, handleCloseSettleModal, handleCheckout,
  }

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>
}

export function usePos() {
  const ctx = useContext(PosContext)
  if (!ctx) throw new Error('usePos must be used within PosProvider')
  return ctx
}

import { useState, useEffect } from 'react'
import React from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPosInvoice } from '../../api/sales'
import { getAll as getSettings } from '../../api/settings'
import { formatDate } from '../../lib/utils/dates'
import { ORDER_TYPE } from '../../constants/orderTypes'
import { groupSubItemsByStep } from '../../lib/utils/bundles'
import { DISCOUNT_TYPE } from '../../constants/discountTypes'

/** Parse boolean setting value */
const bool = (v) => v === 'true'

/** Map receipt_maxwidth setting to CSS px value */
const widthMap = { small: '300px', medium: '400px', large: '500px' }

const SETTINGS_DEFAULTS = {
  site_name:        'DemoPos',
  receipt_maxwidth: 'medium',
  is_show_logo:     'true',
  is_show_site_name:'true',
  is_show_phone:    'true',
  is_show_email:    'true',
  is_show_address:  'true',
  is_show_customer: 'true',
  is_show_note:     'true',
  note_to_customer: 'Thank you!',
  contact_phone:    '',
  contact_email:    '',
  contact_address:  '',
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function PosInvoice() {
  const { orderId } = useParams()
  const navigate    = useNavigate()
  const location    = useLocation()
  const backTo      = location.state?.backTo ?? '/pos'

  const [order, setOrder]       = useState(null)
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getPosInvoice(orderId),
      getSettings().catch(() => null), // settings failure must not block receipt
    ])
      .then(([orderRes, settingsRes]) => {
        if (cancelled) return

        const data = orderRes.data?.data
        setOrder(data)

        if (settingsRes?.data?.data) {
          setSettings({ ...SETTINGS_DEFAULTS, ...settingsRes.data.data })
        }

        // Auto-print after data loads and DOM renders
        setTimeout(() => window.print(), 500)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load invoice')
        navigate(backTo)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner />
  if (!order)  return null

  const items        = order.items ?? []
  const transactions = order.transactions ?? order.orderTransactions ?? []
  const receiptWidth = widthMap[settings.receipt_maxwidth] ?? '400px'

  return (
    <div>
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 4mm; }
          body { margin: 0; }
        }
      `}</style>

      {/* Screen controls — hidden when printing */}
      <div className="flex flex-wrap items-center gap-4 mb-6 print:hidden">
        <button
          onClick={() => navigate(backTo)}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">POS Invoice #{order.id}</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          aria-label="Print receipt"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {/* Receipt — visible on screen and when printing */}
      <div
        className="receipt mx-auto bg-white text-gray-900 p-6 shadow-sm rounded-2xl"
        style={{ maxWidth: receiptWidth, fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className="text-center mb-4">
          {bool(settings.is_show_logo) && (
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow mx-auto mb-2">
              <span className="text-white font-bold text-base">P</span>
            </div>
          )}
          {bool(settings.is_show_site_name) && (
            <p className="text-lg font-bold">{settings.site_name}</p>
          )}
          {order.orderType === ORDER_TYPE.TAKEAWAY && (
            <p className="text-xs font-bold tracking-widest uppercase text-orange-600 border border-orange-400 rounded px-2 py-0.5 inline-block mt-1">
              Takeaway
            </p>
          )}
          {bool(settings.is_show_address) && settings.contact_address && (
            <p className="text-xs text-gray-500 mt-0.5">{settings.contact_address}</p>
          )}
          {bool(settings.is_show_phone) && settings.contact_phone && (
            <p className="text-xs text-gray-500">{settings.contact_phone}</p>
          )}
          {bool(settings.is_show_email) && settings.contact_email && (
            <p className="text-xs text-gray-500">{settings.contact_email}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {formatDate(order.createdAt)}{' '}
            {order.createdAt
              ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : ''}
          </p>
        </div>

        {/* Customer & Cashier */}
        {bool(settings.is_show_customer) && (
          <div className="text-xs mb-3 space-y-0.5">
            <p>Customer: {order.customerName}</p>
            {order.userName && <p>Cashier: {order.userName}</p>}
            <p>Order #: {order.id}</p>
          </div>
        )}

        <hr className="border-dashed border-gray-300 my-2" />

        {/* Items — handle bundle groups */}
        <div className="text-xs space-y-1 mb-2">
          {(() => {
            const rendered = new Set()
            return items.map((item, i) => {
              if (rendered.has(item.id)) return null
              // Sub-items are rendered inline under their bundle header
              if (item.bundleHeaderSaleItemId != null) return null

              // Voided items are excluded from the receipt entirely
              if (item.isVoided) return null

              if (item.isBundleHeader) {
                const subItems = items.filter(si => si.bundleHeaderSaleItemId === item.id && !si.isVoided)
                subItems.forEach(si => rendered.add(si.id))

                const stepGroups = groupSubItemsByStep(subItems)

                return (
                  <React.Fragment key={i}>
                    <div className="flex justify-between font-medium">
                      <span className="flex-1 pr-2">{item.productName} x{item.quantity}</span>
                      <span>{Number(item.total ?? item.rowTotal ?? 0).toFixed(2)}</span>
                    </div>
                    {stepGroups ? (
                      /* Multi-step bundle: group sub-items under step headers */
                      stepGroups.map(([label, groupItems]) => (
                        <React.Fragment key={label}>
                          <div className="pl-3 text-gray-400 text-[10px] font-semibold uppercase tracking-wide mt-0.5">
                            {label}:
                          </div>
                          {groupItems.map((si, j) => (
                            <div key={j} className="flex justify-between pl-5 text-gray-500">
                              <span className="flex-1 pr-2">- {si.productName} x{si.quantity}</span>
                            </div>
                          ))}
                        </React.Fragment>
                      ))
                    ) : (
                      /* Flat bundle: render sub-items without grouping */
                      subItems.map((si, j) => (
                        <div key={j} className="flex justify-between pl-3 text-gray-500">
                          <span className="flex-1 pr-2">{'\u203a'} {si.productName} x{si.quantity}</span>
                        </div>
                      ))
                    )}
                  </React.Fragment>
                )
              }

              return (
                <div key={i} className="flex justify-between">
                  <span className="flex-1 pr-2">{item.productName} x{item.quantity}</span>
                  <span>{Number(item.total ?? 0).toFixed(2)}</span>
                </div>
              )
            })
          })()}
        </div>

        <hr className="border-dashed border-gray-300 my-2" />

        {/* Totals */}
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Sub Total</span>
            <span>{Number(order.subTotal).toFixed(2)}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between">
              <span>{order.discountType === DISCOUNT_TYPE.MEMBER ? 'Member Redemption' : 'Discount'}</span>
              <span>-{Number(order.discount).toFixed(2)}</span>
            </div>
          )}
          {Number(order.takeawayCharge ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Takeaway Charge</span>
              <span>{Number(order.takeawayCharge).toFixed(2)}</span>
            </div>
          )}
          {Number(order.roundingAdjustment ?? 0) !== 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Rounding</span>
              <span>{Number(order.roundingAdjustment) > 0 ? '+' : ''}{Number(order.roundingAdjustment).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{(Number(order.roundedTotal ?? 0) > 0 ? Number(order.roundedTotal) : Number(order.total)).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid</span>
            <span>{Number(order.paid).toFixed(2)}</span>
          </div>
          {transactions.length > 0 ? (
            <div className="flex justify-between text-gray-500">
              <span>Payment</span>
              <span className="capitalize">
                {transactions[0].paymentMethodName ?? transactions[0].paidBy ?? '—'}
              </span>
            </div>
          ) : order.discountType === DISCOUNT_TYPE.MEMBER ? (
            <div className="flex justify-between text-gray-500">
              <span>Payment</span>
              <span>Member</span>
            </div>
          ) : null}
          <div className="flex justify-between text-yellow-700">
            <span>Due</span>
            <span>{Number(order.due).toFixed(2)}</span>
          </div>
          {Number(order.change ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Change</span>
              <span className="font-medium">{Number(order.change).toFixed(2)}</span>
            </div>
          )}
        </div>

        <hr className="border-dashed border-gray-300 my-3" />

        {bool(settings.is_show_note) && (
          <p className="text-center text-xs text-gray-400">
            {settings.note_to_customer || 'Thank you!'}
          </p>
        )}
      </div>
    </div>
  )
}

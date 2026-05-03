import { useState, useEffect } from 'react'
import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { getOrderInvoice } from '../../api/sales'
import { getAll as getSettings } from '../../api/settings'
import { formatDate } from '../../lib/utils/dates'
import { groupSubItemsByStep } from '../../lib/utils/bundles'
import { DISCOUNT_TYPE } from '../../constants/discountTypes'

/** Parse boolean setting stored as "true"/"false" string */
const bool = (v) => v === 'true'

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
  note_to_customer: 'Thank you for your business!',
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

/** Minimum filler rows so the invoice body isn't empty on short orders */
const MIN_ROWS = 5

export default function SalesInvoice() {
  const { id }      = useParams()
  const navigate    = useNavigate()

  const [order, setOrder]       = useState(null)
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      getOrderInvoice(id),
      getSettings().catch(() => null), // settings failure must not block invoice
    ])
      .then(([orderRes, settingsRes]) => {
        if (cancelled) return

        const data = orderRes.data?.data ?? orderRes.data
        setOrder(data)

        if (settingsRes?.data?.data) {
          setSettings({ ...SETTINGS_DEFAULTS, ...settingsRes.data.data })
        }

        // Auto-print after DOM renders
        setTimeout(() => window.print(), 600)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load invoice')
        navigate('/sales')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <LoadingSpinner />
  if (!order)  return null

  const items        = order.items        ?? []
  const transactions = order.transactions ?? []
  const subTotal          = Number(order.subTotal          ?? 0)
  const discount          = Number(order.discount          ?? 0)
  const total             = Number(order.total             ?? 0)
  const roundingAdjustment = Number(order.roundingAdjustment ?? 0)
  const roundedTotal      = Number(order.roundedTotal      ?? 0)
  const grandTotal        = roundedTotal > 0 ? roundedTotal : total
  const paid              = Number(order.paid              ?? 0)
  const due               = Number(order.due               ?? 0)
  const change            = Number(order.change            ?? 0)
  const isPaid            = order.status === 1

  // How many empty filler rows to add
  // Count only header/regular rows — sub-items are rendered inline so don't count toward MIN_ROWS
  const visibleItemCount = items.filter(i => i.bundleHeaderSaleItemId == null).length
  const fillerCount  = Math.max(0, MIN_ROWS - visibleItemCount)

  // Conditionally build contact line for footer
  const contactParts = []
  if (bool(settings.is_show_phone)   && settings.contact_phone)   contactParts.push(settings.contact_phone)
  if (bool(settings.is_show_email)   && settings.contact_email)   contactParts.push(settings.contact_email)
  if (bool(settings.is_show_address) && settings.contact_address) contactParts.push(settings.contact_address)

  return (
    <div>
      {/* ── Print CSS injected into the document head via a style tag ── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          /* Ensure thead/tfoot repeat on every page */
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          /* Prevent summary rows from being split across pages */
          .summary-row {
            page-break-inside: avoid;
          }
          /* Hide AppLayout chrome */
          aside, header {
            display: none !important;
          }
          /* Ensure invoice fills the page width */
          .invoice-wrapper {
            max-width: 100% !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* ── Screen-only controls bar ── */}
      <div className="no-print flex flex-wrap items-center gap-4 mb-6">
        <button
          onClick={() => navigate(`/sales/${id}`)}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back to sale detail"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
            <FileText size={22} className="text-blue-600" />
            Sales Invoice #{order.id}
          </h1>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          aria-label="Print invoice"
        >
          <Printer size={15} />
          Print
        </button>
      </div>

      {/* ── A4 Invoice container ── */}
      <div
        className="invoice-wrapper mx-auto bg-white rounded-2xl shadow p-8"
        style={{ maxWidth: '860px', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '13px', color: '#1f2937' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>

          {/* ════════════════════════════════════════
              THEAD — repeats on every printed page
          ════════════════════════════════════════ */}
          <thead>

            {/* Row 1: Business identity (left) + "INVOICE" label (right) */}
            <tr>
              <td colSpan={4} style={{ paddingBottom: '4px', verticalAlign: 'bottom' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {bool(settings.is_show_logo) && (
                    <div style={{
                      width: '44px', height: '44px',
                      background: '#2563eb', borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '18px' }}>P</span>
                    </div>
                  )}
                  {bool(settings.is_show_site_name) && (
                    <span style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>
                      {settings.site_name}
                    </span>
                  )}
                </div>
              </td>
              <td colSpan={3} style={{ textAlign: 'right', verticalAlign: 'bottom', paddingBottom: '4px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '2px', color: '#111827' }}>
                  INVOICE
                </div>
              </td>
            </tr>

            {/* Row 2: Contact info (left) + Invoice # and Date (right) */}
            <tr>
              <td colSpan={4} style={{ paddingTop: '2px', paddingBottom: '8px', verticalAlign: 'top' }}>
                {bool(settings.is_show_address) && settings.contact_address && (
                  <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>
                    {settings.contact_address}
                  </div>
                )}
                {bool(settings.is_show_phone) && settings.contact_phone && (
                  <div style={{ color: '#6b7280', fontSize: '12px', marginBottom: '2px' }}>
                    Tel: {settings.contact_phone}
                  </div>
                )}
                {bool(settings.is_show_email) && settings.contact_email && (
                  <div style={{ color: '#6b7280', fontSize: '12px' }}>
                    {settings.contact_email}
                  </div>
                )}
              </td>
              <td colSpan={3} style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '2px', paddingBottom: '8px' }}>
                <div style={{ marginBottom: '3px' }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>Invoice No: </span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>#{order.id}</span>
                </div>
                <div style={{ marginBottom: '3px' }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>Date: </span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {formatDate(order.createdAt)}
                  </span>
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: isPaid ? '#dcfce7' : '#fef9c3',
                      color:      isPaid ? '#15803d' : '#92400e',
                    }}
                  >
                    {order.statusLabel ?? (isPaid ? 'Paid' : 'Due')}
                  </span>
                </div>
              </td>
            </tr>

            {/* Row 3: Horizontal divider */}
            <tr>
              <td colSpan={7} style={{ padding: '0 0 8px 0' }}>
                <div style={{ borderTop: '2px solid #2563eb' }} />
              </td>
            </tr>

            {/* Row 4: Customer / Cashier — conditional */}
            {bool(settings.is_show_customer) && (
              <tr>
                <td colSpan={4} style={{ paddingBottom: '8px' }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>Bill To: </span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {order.customerName ?? '—'}
                  </span>
                </td>
                <td colSpan={3} style={{ textAlign: 'right', paddingBottom: '8px' }}>
                  <span style={{ color: '#6b7280', fontSize: '12px' }}>Cashier: </span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {order.userName ?? '—'}
                  </span>
                </td>
              </tr>
            )}

            {/* Row 5: Column headers for items table */}
            <tr style={{ background: '#f3f4f6' }}>
              <th style={thStyle}>#</th>
              <th style={{ ...thStyle, textAlign: 'left', width: '30%' }}>Product</th>
              <th style={thStyle}>SKU</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Unit Price</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Discount</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
            </tr>

          </thead>

          {/* ════════════════════════════════════════
              TFOOT — repeats on every printed page
          ════════════════════════════════════════ */}
          <tfoot>
            {/* Separator */}
            <tr>
              <td colSpan={7} style={{ paddingTop: '8px' }}>
                <div style={{ borderTop: '1px solid #d1d5db' }} />
              </td>
            </tr>

            {/* Note to customer — conditional */}
            {bool(settings.is_show_note) && settings.note_to_customer && (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '6px 0 2px', color: '#9ca3af', fontSize: '11px', fontStyle: 'italic' }}
                >
                  {settings.note_to_customer}
                </td>
              </tr>
            )}

            {/* Contact line */}
            {contactParts.length > 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '2px 0 4px', color: '#9ca3af', fontSize: '11px' }}
                >
                  {contactParts.join('  |  ')}
                </td>
              </tr>
            )}
          </tfoot>

          {/* ════════════════════════════════════════
              TBODY — items + money summary
          ════════════════════════════════════════ */}
          <tbody>

            {/* Item rows — handle bundle groups */}
            {(() => {
              const rendered = new Set()
              let rowNumber = 0

              return items.map((item, index) => {
                if (rendered.has(item.id)) return null
                // Sub-items are rendered inline under their bundle header
                if (item.bundleHeaderSaleItemId != null) return null

                rowNumber++
                const rowBg = rowNumber % 2 === 0 ? '#fafafa' : '#fff'

                if (item.isBundleHeader) {
                  const subItems = items.filter(si => si.bundleHeaderSaleItemId === item.id)
                  subItems.forEach(si => rendered.add(si.id))

                  const stepGroups = groupSubItemsByStep(subItems)

                  return (
                    <React.Fragment key={item.id ?? index}>
                      {/* Bundle header row */}
                      <tr style={{ borderBottom: '1px solid #e5e7eb', background: rowBg }}>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', width: '36px' }}>
                          {rowNumber}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 700, color: '#4338ca' }}>
                          {item.productName ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>
                          {item.productSku ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {item.quantity ?? '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {Number(item.price ?? 0).toFixed(2)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {Number(item.discount ?? 0).toFixed(2)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#4338ca' }}>
                          {Number(item.total ?? item.lineTotal ?? 0).toFixed(2)}
                        </td>
                      </tr>
                      {stepGroups ? (
                        /* Multi-step bundle: group sub-items under step label headers */
                        stepGroups.map(([label, groupItems]) => (
                          <React.Fragment key={label}>
                            {/* Step label header row */}
                            <tr style={{ borderBottom: '1px solid #f3f4f6', background: rowBg }}>
                              <td style={{ ...tdStyle }} />
                              <td colSpan={6} style={{ ...tdStyle, textAlign: 'left', paddingLeft: '20px', fontSize: '10px', fontWeight: 600, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '4px', paddingBottom: '2px' }}>
                                {label}:
                              </td>
                            </tr>
                            {/* Sub-items under this step */}
                            {groupItems.map((si, j) => (
                              <tr key={si.id ?? `sub-${j}`} style={{ borderBottom: '1px solid #f3f4f6', background: rowBg }}>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', width: '36px' }} />
                                <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '28px', color: '#6b7280', fontStyle: 'italic', fontSize: '12px' }}>
                                  - {si.productName ?? '—'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                                  {si.productSku ?? '—'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7280', fontSize: '12px' }}>
                                  {si.quantity ?? '—'}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af', fontSize: '12px' }}>
                                  —
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af', fontSize: '12px' }}>
                                  —
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af', fontSize: '12px' }}>
                                  —
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))
                      ) : (
                        /* Flat bundle: render sub-items without grouping */
                        subItems.map((si, j) => (
                          <tr key={si.id ?? `sub-${j}`} style={{ borderBottom: '1px solid #f3f4f6', background: rowBg }}>
                            <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', width: '36px' }} />
                            <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: '20px', color: '#6b7280', fontStyle: 'italic', fontSize: '12px' }}>
                              {'\u203a'} {si.productName ?? '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', fontSize: '12px' }}>
                              {si.productSku ?? '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#6b7280', fontSize: '12px' }}>
                              {si.quantity ?? '—'}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af', fontSize: '12px' }}>
                              —
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af', fontSize: '12px' }}>
                              —
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: '#9ca3af', fontSize: '12px' }}>
                              —
                            </td>
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  )
                }

                // Regular item row
                const isVoided = item.isVoided === true
                const voidedStyle = isVoided
                  ? { textDecoration: 'line-through', color: '#9ca3af', opacity: 0.7 }
                  : {}
                return (
                  <tr
                    key={item.id ?? index}
                    style={{ borderBottom: '1px solid #e5e7eb', background: isVoided ? '#fff5f5' : rowBg, opacity: isVoided ? 0.8 : 1 }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#9ca3af', width: '36px' }}>
                      {rowNumber}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', fontWeight: 500, ...voidedStyle }}>
                      {item.productName ?? '—'}
                      {isVoided && (
                        <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', textDecoration: 'none', letterSpacing: '0.05em' }}>
                          [VOIDED]
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#6b7280', ...voidedStyle }}>
                      {item.productSku ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', ...voidedStyle }}>
                      {item.quantity ?? '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', ...voidedStyle }}>
                      {Number(item.price ?? 0).toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', ...voidedStyle }}>
                      {Number(item.discount ?? 0).toFixed(2)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 500, ...voidedStyle }}>
                      {Number(item.total ?? item.lineTotal ?? 0).toFixed(2)}
                    </td>
                  </tr>
                )
              })
            })()}

            {/* Filler rows to pad short invoices */}
            {Array.from({ length: fillerCount }).map((_, i) => (
              <tr key={`filler-${i}`} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
              </tr>
            ))}

            {/* ── Money summary rows ── */}

            {/* Spacer before summary */}
            <tr className="summary-row">
              <td colSpan={7} style={{ padding: '8px 0 0 0' }}>
                <div style={{ borderTop: '1px solid #d1d5db' }} />
              </td>
            </tr>

            {/* Sub Total */}
            <tr className="summary-row">
              <td colSpan={5} style={{ padding: '5px 8px' }} />
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 500 }}>
                Sub Total
              </td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#374151' }}>
                {subTotal.toFixed(2)}
              </td>
            </tr>

            {/* Discount — only when > 0 */}
            {discount > 0 && (
              <tr className="summary-row">
                <td colSpan={5} style={{ padding: '5px 8px' }} />
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 500 }}>
                  {order.discountType === DISCOUNT_TYPE.MEMBER ? 'Member Redemption' : 'Discount'}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#dc2626' }}>
                  -{discount.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Rounding — only when non-zero */}
            {roundingAdjustment !== 0 && (
              <tr className="summary-row">
                <td colSpan={5} style={{ padding: '5px 8px' }} />
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 500, fontStyle: 'italic' }}>
                  Rounding
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: roundingAdjustment > 0 ? '#15803d' : '#dc2626' }}>
                  {roundingAdjustment > 0 ? '+' : ''}{roundingAdjustment.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Grand Total */}
            <tr className="summary-row" style={{ background: '#f3f4f6' }}>
              <td colSpan={5} style={{ padding: '7px 8px' }} />
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#111827', fontWeight: 700, fontSize: '14px' }}>
                Grand Total
              </td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#111827', fontWeight: 700, fontSize: '14px' }}>
                {grandTotal.toFixed(2)}
              </td>
            </tr>

            {/* Paid */}
            <tr className="summary-row">
              <td colSpan={5} style={{ padding: '5px 8px' }} />
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#15803d', fontWeight: 500 }}>
                Paid
              </td>
              <td style={{ padding: '5px 8px', textAlign: 'right', color: '#15803d' }}>
                {paid.toFixed(2)}
              </td>
            </tr>

            {/* Payment method breakdown — one row per transaction */}
            {transactions.length > 0 ? (
              <>
                {/* Sub-header */}
                <tr className="summary-row">
                  <td colSpan={5} style={{ padding: '0 8px' }} />
                  <td colSpan={2} style={{ padding: '4px 8px 2px', textAlign: 'right' }}>
                    <div style={{ borderTop: '1px dashed #e5e7eb', marginBottom: '4px' }} />
                    <span style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                      Payment Details
                    </span>
                  </td>
                </tr>
                {transactions.map((txn, i) => (
                  <tr key={txn.id ?? i} className="summary-row">
                    <td colSpan={3} style={{ padding: '2px 8px' }} />
                    {/* Method name + optional txn ref */}
                    <td colSpan={2} style={{ padding: '2px 8px', textAlign: 'right', color: '#6b7280', fontSize: '12px' }}>
                      {txn.transactionId && (
                        <span style={{ marginRight: '6px', color: '#9ca3af' }}>
                          Ref: {txn.transactionId}
                        </span>
                      )}
                      {formatDate(txn.createdAt)}
                    </td>
                    <td style={{ padding: '2px 8px', textAlign: 'right', color: '#374151', fontSize: '12px', fontWeight: 500 }}>
                      {(txn.paymentMethodName ?? txn.paidBy ?? '—').replace(/\b\w/g, c => c.toUpperCase())}
                    </td>
                    <td style={{ padding: '2px 8px', textAlign: 'right', color: '#374151', fontSize: '12px' }}>
                      {Number(txn.amount ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="summary-row">
                  <td colSpan={5} style={{ padding: '0 8px' }} />
                  <td colSpan={2} style={{ padding: '0 8px 4px' }}>
                    <div style={{ borderTop: '1px dashed #e5e7eb' }} />
                  </td>
                </tr>
              </>
            ) : order.discountType === DISCOUNT_TYPE.MEMBER ? (
              <tr className="summary-row">
                <td colSpan={5} style={{ padding: '5px 8px' }} />
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 500 }}>
                  Payment
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#7c3aed', fontWeight: 500 }}>
                  Member
                </td>
              </tr>
            ) : null}

            {/* Due */}
            <tr className="summary-row">
              <td colSpan={5} style={{ padding: '5px 8px' }} />
              <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 500, color: due > 0 ? '#92400e' : '#6b7280' }}>
                Due
              </td>
              <td style={{
                padding: '5px 8px',
                textAlign: 'right',
                fontWeight: due > 0 ? 600 : 400,
                color: due > 0 ? '#d97706' : '#6b7280',
              }}>
                {due.toFixed(2)}
              </td>
            </tr>

            {/* Change — only when > 0 */}
            {change > 0 && (
              <tr className="summary-row">
                <td colSpan={5} style={{ padding: '5px 8px' }} />
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#6b7280', fontWeight: 500 }}>
                  Change
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right', color: '#374151' }}>
                  {change.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Bottom spacer */}
            <tr>
              <td colSpan={7} style={{ height: '16px' }} />
            </tr>

          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Shared cell styles ── */
const thStyle = {
  padding: '9px 8px',
  textAlign: 'center',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderTop: '1px solid #e5e7eb',
  borderBottom: '1px solid #e5e7eb',
}

const tdStyle = {
  padding: '9px 8px',
  color: '#374151',
  verticalAlign: 'middle',
}

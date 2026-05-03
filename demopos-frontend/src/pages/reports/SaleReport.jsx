import { Fragment, useState, useEffect, useRef, useMemo } from 'react'
import { flushSync } from 'react-dom'
import { ChevronDown, ChevronRight, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/utils/currency'
import { getSaleReport } from '../../api/reports'
import { today, thisWeekStart, currentMonthRange, lastMonthRange, sameMonth, formatDate } from '../../lib/utils/dates'
import QuickBtn from '../../components/QuickBtn'

// ── Module-level constants ─────────────────────────────────────────────────────

const quickRangeFactories = {
  day:          () => { const t = today(); return { start: t, end: t } },
  week:         () => ({ start: thisWeekStart(), end: today() }),
  month:        currentMonthRange,
  'last-month': lastMonthRange,
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const isPaid = status === 'Paid'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
    }`}>
      {status}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SaleReport() {
  const { user } = useAuth()
  const { symbol, precision } = useCurrency()
  const fmt     = (v) => formatCurrency(v, symbol, precision)
  const perms   = user?.permissions ?? []
  const canView = perms.includes('reports_sales')

  const [items,       setItems]       = useState([])
  const [totals,      setTotals]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [expanded,    setExpanded]    = useState(new Set())
  const [activeQuick, setActiveQuick] = useState('month')

  const [startDate,    setStartDate]    = useState(() => currentMonthRange().start)
  const [endDate,      setEndDate]      = useState(() => currentMonthRange().end)

  // Pending inputs for custom mode
  const [pendingStart, setPendingStart] = useState(() => currentMonthRange().start)
  const [pendingEnd,   setPendingEnd]   = useState(() => currentMonthRange().end)

  useEffect(() => {
    if (!canView) return

    let cancelled = false
    setLoading(true)
    setExpanded(new Set())

    getSaleReport(startDate, endDate)
      .then((res) => {
        if (cancelled) return
        const d = res.data?.data ?? {}
        setItems(d.items ?? [])
        setTotals({
          totalSubTotal: d.totalSubTotal ?? 0,
          totalDiscount: d.totalDiscount ?? 0,
          grandTotal:    d.grandTotal    ?? 0,
          totalPaid:     d.totalPaid     ?? 0,
          totalDue:      d.totalDue      ?? 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load sale report')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canView, startDate, endDate])

  function applyRange(start, end, quick) {
    setStartDate(start)
    setEndDate(end)
    setActiveQuick(quick)
    setPendingStart(start)
    setPendingEnd(end)
  }

  function handleQuick(type) {
    const factory = quickRangeFactories[type]
    if (factory) {
      const { start, end } = factory()
      applyRange(start, end, type)
    } else {
      setActiveQuick('custom')
    }
  }

  function handleApplyCustom() {
    if (!pendingStart || !pendingEnd) {
      toast.error('Please select both dates')
      return
    }
    if (!sameMonth(pendingStart, pendingEnd)) {
      toast.error('Start and end date must be within the same month')
      return
    }
    if (pendingStart > pendingEnd) {
      toast.error('Start date must be before end date')
      return
    }
    setStartDate(pendingStart)
    setEndDate(pendingEnd)
  }

  function toggleRow(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandableIds = useMemo(
    () => items.filter(i => i.saleItems?.length > 0).map(i => i.id),
    [items]
  )
  const allExpanded = expandableIds.length > 0 && expandableIds.every(id => expanded.has(id))

  function toggleExpandAll() {
    setExpanded(allExpanded ? new Set() : new Set(expandableIds))
  }

  const savedExpandRef       = useRef(null)
  const afterprintHandlerRef = useRef(null)

  // Clean up afterprint listener if component unmounts before print dialog closes
  useEffect(() => () => {
    if (afterprintHandlerRef.current) {
      window.removeEventListener('afterprint', afterprintHandlerRef.current)
    }
  }, [])

  function handlePrint() {
    savedExpandRef.current = new Set(expanded)

    if (afterprintHandlerRef.current) {
      window.removeEventListener('afterprint', afterprintHandlerRef.current)
    }
    const restore = () => {
      if (savedExpandRef.current !== null) {
        setExpanded(savedExpandRef.current)
        savedExpandRef.current = null
      }
      window.removeEventListener('afterprint', restore)
      afterprintHandlerRef.current = null
    }
    afterprintHandlerRef.current = restore
    window.addEventListener('afterprint', restore)

    // flushSync forces React to commit the expanded state to the DOM synchronously
    // before window.print() opens the dialog — guarantees all item rows are rendered
    flushSync(() => setExpanded(new Set(expandableIds)))
    window.print()
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Sales Report</h1>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .sr-no-print { display: none !important; }
          .sr-table { font-size: 10px !important; }
          .sr-table .sr-chevron { display: none !important; }
          .sr-sub-row { page-break-inside: avoid; }
          .sr-totals { page-break-inside: avoid; }
          .sr-overflow { overflow: visible !important; }
          .sr-card { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* Print-only: date range */}
      <p className="hidden print:block text-sm text-gray-600 mb-4">
        {formatDate(startDate)} &ndash; {formatDate(endDate)}
      </p>

      {/* Filter bar */}
      <div className="sr-no-print bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <QuickBtn label="Day"        active={activeQuick === 'day'}        onClick={() => handleQuick('day')} />
          <QuickBtn label="Week"       active={activeQuick === 'week'}       onClick={() => handleQuick('week')} />
          <QuickBtn label="Month"      active={activeQuick === 'month'}      onClick={() => handleQuick('month')} />
          <QuickBtn label="Last Month" active={activeQuick === 'last-month'} onClick={() => handleQuick('last-month')} />
          <QuickBtn label="Custom"     active={activeQuick === 'custom'}     onClick={() => handleQuick('custom')} />
        </div>

        {activeQuick === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Start Date</label>
              <input
                type="date"
                value={pendingStart}
                onChange={(e) => setPendingStart(e.target.value)}
                className="border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">End Date</label>
              <input
                type="date"
                value={pendingEnd}
                onChange={(e) => setPendingEnd(e.target.value)}
                className="border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Apply
            </button>
            <p className="text-xs text-gray-400 dark:text-slate-500 self-end pb-2">
              Start and end must be within the same month
            </p>
          </div>
        )}
      </div>

      {/* Table card */}
      <div className="sr-card bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {!loading && items.length > 0 && (
          <div className="sr-no-print flex items-center justify-end gap-2 mb-3">
            {expandableIds.length > 0 && (
              <button
                onClick={toggleExpandAll}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="sr-overflow overflow-x-auto">
            <table className="sr-table w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="sr-chevron w-8 py-3 px-2" />
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sale ID</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Customer</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sub-Total</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Discount</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Total</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Paid</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Due</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-10 text-center text-gray-400 dark:text-slate-500 text-sm">
                      No sales found for the selected period.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const isOpen   = expanded.has(item.id)
                    const hasItems = item.saleItems?.length > 0
                    return (
                      <Fragment key={item.id}>
                        <tr
                          className={`border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 ${hasItems ? 'cursor-pointer' : ''}`}
                          onClick={() => hasItems && toggleRow(item.id)}
                        >
                          <td className="sr-chevron py-3 px-2 text-gray-400 dark:text-slate-500">
                            {hasItems && (
                              isOpen
                                ? <ChevronDown size={14} />
                                : <ChevronRight size={14} />
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{idx + 1}</td>
                          <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">#{item.id}</td>
                          <td className="py-3 px-4 text-gray-600 dark:text-slate-400">{item.customerName || '—'}</td>
                          <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-right">{fmt(item.subTotal ?? 0)}</td>
                          <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-right">{fmt(item.discount ?? 0)}</td>
                          <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-right font-medium">{fmt(item.roundedTotal ?? item.total ?? 0)}</td>
                          <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-right">{fmt(item.paid ?? 0)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={Number(item.due) > 0 ? 'text-yellow-600 font-medium' : 'text-gray-700 dark:text-slate-300'}>
                              {fmt(item.due ?? 0)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="py-3 px-4 text-gray-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(item.createdAt)}
                          </td>
                        </tr>

                        {isOpen && hasItems && (
                          <tr className="sr-sub-row bg-blue-50/40 dark:bg-slate-700/40">
                            <td colSpan={11} className="px-10 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-gray-200 dark:border-slate-600">
                                    <th className="text-left py-1.5 pr-4 font-medium text-gray-500 dark:text-slate-400">Product</th>
                                    <th className="text-left py-1.5 pr-4 font-medium text-gray-500 dark:text-slate-400">SKU</th>
                                    <th className="text-right py-1.5 pr-4 font-medium text-gray-500 dark:text-slate-400">Qty</th>
                                    <th className="text-right py-1.5 pr-4 font-medium text-gray-500 dark:text-slate-400">Unit Price</th>
                                    <th className="text-right py-1.5 font-medium text-gray-500 dark:text-slate-400">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.saleItems.map((si, i) => (
                                    <tr key={i} className="border-b border-gray-100 dark:border-slate-600 last:border-0">
                                      <td className="py-1.5 pr-4 text-gray-700 dark:text-slate-300">
                                        {si.productName}
                                        {si.modifierNote && (
                                          <span className="block text-gray-400 dark:text-slate-500 italic">{si.modifierNote}</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-4 text-gray-500 dark:text-slate-400">{si.productSku || '—'}</td>
                                      <td className="py-1.5 pr-4 text-gray-700 dark:text-slate-300 text-right">{si.quantity}</td>
                                      <td className="py-1.5 pr-4 text-gray-700 dark:text-slate-300 text-right">{fmt(si.unitPrice)}</td>
                                      <td className="py-1.5 text-gray-700 dark:text-slate-300 text-right font-medium">{fmt(si.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}

                {totals && items.length > 0 && (
                  <tr className="sr-totals border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 font-semibold">
                    <td colSpan={4} className="py-3 px-4 text-gray-700 dark:text-slate-300 text-sm">Totals</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-slate-100 text-right text-sm">{fmt(totals.totalSubTotal)}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-slate-100 text-right text-sm">{fmt(totals.totalDiscount)}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-slate-100 text-right text-sm">{fmt(totals.grandTotal)}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-slate-100 text-right text-sm">{fmt(totals.totalPaid)}</td>
                    <td className="py-3 px-4 text-gray-900 dark:text-slate-100 text-right text-sm">{fmt(totals.totalDue)}</td>
                    <td colSpan={2} />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import {
  DollarSign, Tag, TrendingUp, CreditCard, AlertCircle, ShoppingCart,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { getSaleSummary } from '../../api/reports'
import { today, daysAgo } from '../../lib/utils/dates'

const emptySummary = {
  subTotal: 0, discount: 0, total: 0,
  paid: 0, due: 0, orderCount: 0,
}

export default function SaleSummary() {
  const { user } = useAuth()
  const perms   = user?.permissions ?? []
  const canView = perms.includes('reports_summary')

  const [summary,  setSummary]  = useState(emptySummary)
  const [loading,  setLoading]  = useState(true)

  // Applied date range
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate,   setEndDate]   = useState(today())

  // Pending inputs
  const [pendingStart, setPendingStart] = useState(daysAgo(30))
  const [pendingEnd,   setPendingEnd]   = useState(today())

  useEffect(() => {
    if (!canView) return

    let cancelled = false
    setLoading(true)

    getSaleSummary(startDate, endDate)
      .then((res) => {
        if (cancelled) return
        setSummary(res.data?.data ?? emptySummary)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load sale summary')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [canView, startDate, endDate])

  function handleApply() {
    if (!pendingStart || !pendingEnd) {
      toast.error('Please select both dates')
      return
    }
    if (pendingStart > pendingEnd) {
      toast.error('Start date must be before end date')
      return
    }
    setStartDate(pendingStart)
    setEndDate(pendingEnd)
  }

  function handleReset() {
    const s = daysAgo(30)
    const e = today()
    setPendingStart(s)
    setPendingEnd(e)
    setStartDate(s)
    setEndDate(e)
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

  const cards = [
    {
      label: 'Sub-Total',
      value: Number(summary.subTotal).toFixed(2),
      icon: DollarSign,
      color: 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
      desc: 'Sum of all item prices before discount',
    },
    {
      label: 'Total Discount',
      value: Number(summary.discount).toFixed(2),
      icon: Tag,
      color: 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400',
      desc: 'Discounts applied across all orders',
    },
    {
      label: 'Grand Total',
      value: Number(summary.total).toFixed(2),
      icon: TrendingUp,
      color: 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
      desc: 'Sub-Total minus discounts',
    },
    {
      label: 'Total Paid',
      value: Number(summary.paid).toFixed(2),
      icon: CreditCard,
      color: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
      desc: 'Amount collected from customers',
    },
    {
      label: 'Total Due',
      value: Number(summary.due).toFixed(2),
      icon: AlertCircle,
      color: 'bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',
      desc: 'Outstanding balance across all orders',
    },
    {
      label: 'Total Orders',
      value: summary.orderCount,
      icon: ShoppingCart,
      color: 'bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400',
      desc: 'Number of orders in period',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Sales Summary</h1>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={pendingStart}
              onChange={(e) => setPendingStart(e.target.value)}
              className="border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={pendingEnd}
              onChange={(e) => setPendingEnd(e.target.value)}
              className="border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <button
            onClick={handleApply}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map(({ label, value, icon: Icon, color, desc }) => (
            <div
              key={label}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 flex items-start gap-4"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={26} aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-slate-100 mt-1">{value}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

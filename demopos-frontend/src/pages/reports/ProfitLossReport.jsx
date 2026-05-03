import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/utils/currency'
import { getProfitLossReport } from '../../api/reports'
import { today, daysAgo } from '../../lib/utils/dates'

export default function ProfitLossReport() {
  const { user } = useAuth()
  const { symbol, precision } = useCurrency()
  const perms   = user?.permissions ?? []
  const canView = perms.includes('reports_sales')

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Applied date range
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate,   setEndDate]   = useState(today())

  // Pending (uncommitted) inputs
  const [pendingStart, setPendingStart] = useState(daysAgo(30))
  const [pendingEnd,   setPendingEnd]   = useState(today())

  useEffect(() => {
    if (!canView) return

    let cancelled = false
    setLoading(true)

    getProfitLossReport(startDate, endDate)
      .then((res) => {
        if (cancelled) return
        setData(res.data?.data ?? res.data ?? null)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load profit & loss report')
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

  const revenue    = Number(data?.revenue    ?? data?.totalRevenue    ?? 0)
  const cogs       = Number(data?.cogs       ?? data?.totalCogs       ?? 0)
  const grossProfit = Number(data?.grossProfit ?? 0) || (revenue - cogs)
  const margin     = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">Profit &amp; Loss Report</h1>

      {/* Filter bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-4 mb-4">
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

      {/* Summary cards */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <p className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
            No data available for the selected period.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-2xl p-5">
              <p className="text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wide mb-1">Revenue</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(revenue, symbol, precision)}
              </p>
              <p className="text-xs text-blue-400 dark:text-blue-500 mt-1">Total sales collected</p>
            </div>

            {/* COGS */}
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-2xl p-5">
              <p className="text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wide mb-1">Cost of Goods</p>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(cogs, symbol, precision)}
              </p>
              <p className="text-xs text-red-400 dark:text-red-500 mt-1">Purchase cost of sold items</p>
            </div>

            {/* Gross Profit */}
            <div className={`${grossProfit >= 0 ? 'bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800' : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-100 dark:border-yellow-800'} border rounded-2xl p-5`}>
              <p className={`text-xs font-medium uppercase tracking-wide mb-1 ${grossProfit >= 0 ? 'text-green-500 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                Gross Profit
              </p>
              <p className={`text-2xl font-bold ${grossProfit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
                {formatCurrency(grossProfit, symbol, precision)}
              </p>
              <p className={`text-xs mt-1 ${grossProfit >= 0 ? 'text-green-400 dark:text-green-500' : 'text-yellow-500 dark:text-yellow-500'}`}>
                Revenue minus COGS
              </p>
            </div>

            {/* Margin % */}
            <div className="bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 rounded-2xl p-5">
              <p className="text-xs font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wide mb-1">Gross Margin</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {margin.toFixed(1)}%
              </p>
              <p className="text-xs text-purple-400 dark:text-purple-500 mt-1">Profit as % of revenue</p>
            </div>
          </div>
        )}

        {/* Detail rows if backend returns them */}
        {!loading && data && (data.items ?? data.rows ?? []).length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Product</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Qty Sold</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Revenue</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">COGS</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Gross Profit</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {(data.items ?? data.rows ?? []).map((row, idx) => {
                  const rowRevenue = Number(row.revenue ?? row.total ?? 0)
                  const rowCogs    = Number(row.cogs ?? row.cost ?? 0)
                  const rowProfit  = Number(row.grossProfit ?? 0) || (rowRevenue - rowCogs)
                  const rowMargin  = rowRevenue > 0 ? (rowProfit / rowRevenue) * 100 : 0
                  return (
                    <tr key={row.productId ?? idx} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">
                        {row.productName ?? row.name ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400 text-right">
                        {row.qtySold ?? row.quantity ?? '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-right">
                        {formatCurrency(rowRevenue, symbol, precision)}
                      </td>
                      <td className="py-3 px-4 text-gray-700 dark:text-slate-300 text-right">
                        {formatCurrency(rowCogs, symbol, precision)}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${rowProfit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(rowProfit, symbol, precision)}
                      </td>
                      <td className="py-3 px-4 text-gray-600 dark:text-slate-400 text-right">
                        {rowMargin.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

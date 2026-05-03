import { useState, useEffect } from 'react'
import {
  TrendingUp, ShoppingCart, Package, Users,
  DollarSign, Tag, BarChart2, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'
import { getDashboard } from '../../api/dashboard'
import { today, daysAgo } from '../../lib/utils/dates'
import usePageTitle from '../../hooks/usePageTitle'

const emptyData = {
  saleSubTotal: 0, saleDiscount: 0, saleTotal: 0, saleDue: 0,
  totalCustomers: 0, totalProducts: 0, totalOrders: 0, totalSaleItems: 0,
  dailyChart: [], monthlyChart: [],
}

export default function Dashboard() {
  usePageTitle('Dashboard')
  const [data,    setData]    = useState(emptyData)
  const [loading, setLoading] = useState(true)

  // Date range state — default: last 30 days
  const [dateFrom, setDateFrom] = useState(daysAgo(30))
  const [dateTo,   setDateTo]   = useState(today())

  // Pending inputs (committed to applied only on "Apply")
  const [pendingFrom, setPendingFrom] = useState(daysAgo(30))
  const [pendingTo,   setPendingTo]   = useState(today())

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getDashboard({ dateFrom, dateTo })
      .then((res) => {
        if (cancelled) return
        setData(res.data?.data ?? emptyData)
      })
      .catch(() => {
        if (cancelled) return
        toast.error('Failed to load dashboard data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  function handleApply() {
    if (!pendingFrom || !pendingTo) {
      toast.error('Please select both dates')
      return
    }
    if (pendingFrom > pendingTo) {
      toast.error('Date From must be before Date To')
      return
    }
    setDateFrom(pendingFrom)
    setDateTo(pendingTo)
  }

  function handleReset() {
    const from = daysAgo(30)
    const to   = today()
    setPendingFrom(from)
    setPendingTo(to)
    setDateFrom(from)
    setDateTo(to)
  }

  const monetaryCards = [
    {
      label: 'Sale Sub-Total',
      value: Number(data.saleSubTotal).toFixed(2),
      icon: DollarSign,
      color: 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Sale Discount',
      value: Number(data.saleDiscount).toFixed(2),
      icon: Tag,
      color: 'bg-green-50 dark:bg-green-900/40 text-green-600 dark:text-green-400',
    },
    {
      label: 'Sale Total',
      value: Number(data.saleTotal).toFixed(2),
      icon: TrendingUp,
      color: 'bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400',
    },
    {
      label: 'Sale Due',
      value: Number(data.saleDue).toFixed(2),
      icon: AlertCircle,
      color: 'bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400',
    },
  ]

  const countCards = [
    {
      label: 'Total Customers',
      value: data.totalCustomers,
      icon: Users,
      color: 'bg-sky-50 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400',
    },
    {
      label: 'Total Products',
      value: data.totalProducts,
      icon: Package,
      color: 'bg-violet-50 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Total Orders',
      value: data.totalOrders,
      icon: ShoppingCart,
      color: 'bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Items Sold',
      value: data.totalSaleItems,
      icon: BarChart2,
      color: 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Dashboard</h1>

        {/* Date range picker */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={pendingFrom}
              onChange={(e) => setPendingFrom(e.target.value)}
              className="border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={pendingTo}
              onChange={(e) => setPendingTo(e.target.value)}
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
        <>
          {/* Row 1 — monetary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
            {monetaryCards.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 — count stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {countCards.map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 flex items-center gap-4"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon size={22} aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Daily sales line chart */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Daily Sales
              </h2>
              {data.dailyChart.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-500 text-sm">
                  No data for the selected period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart
                    data={data.dailyChart}
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={(val) => {
                        // Parse YYYY-MM-DD directly to avoid UTC→local timezone shift
                        const [, m, d] = val.split('-')
                        return `${Number(m)}/${Number(d)}`
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={(val) => Number(val).toFixed(0)}
                      width={60}
                    />
                    <Tooltip
                      formatter={(val) => [Number(val).toFixed(2), 'Total']}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Monthly sales bar chart */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Monthly Sales
              </h2>
              {data.monthlyChart.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 dark:text-slate-500 text-sm">
                  No data available.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.monthlyChart}
                    margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickFormatter={(val) => Number(val).toFixed(0)}
                      width={60}
                    />
                    <Tooltip
                      formatter={(val) => [Number(val).toFixed(2), 'Total']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                    />
                    <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

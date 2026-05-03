import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCustomerOrders, getCustomerById } from '../../api/customers'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils/dates'

export default function CustomerSales() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const perms    = user?.permissions ?? []
  const canSales = perms.includes('customer_sales')

  const [customerName, setCustomerName] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!canSales) {
      setLoading(false)
      return
    }

    Promise.all([
      getCustomerById(id),
      getCustomerOrders(id),
    ]).then(([customerRes, ordersRes]) => {
      setCustomerName(customerRes.data?.data?.name ?? `Customer #${id}`)
      setOrders(ordersRes.data?.data ?? [])
    }).catch(() => {
      toast.error('Failed to load sales history')
      setOrders([])
    }).finally(() => setLoading(false))
  }, [id, canSales])

  if (!canSales) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/customers')}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back to Customers"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Sales History</h1>
          {customerName && (
            <p className="text-sm text-gray-500 mt-0.5">{customerName}</p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <ShoppingBag size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No sales found.</p>
            <p className="text-sm text-gray-400 mt-1">
              This customer has not placed any sales yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Sale #</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Total</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr key={order.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">#{order.id}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-slate-400">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300">{Number(order.total ?? 0).toFixed(2)}</td>
                    <td className="py-3 px-4">
                      {order.status === 1 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Paid
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                          Due
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

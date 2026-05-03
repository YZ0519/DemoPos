import { useState, useEffect } from 'react'
import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, Receipt, Trash2, Pencil, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} from '../../api/sales'
import { useAuth } from '../../context/AuthContext'
import { useCurrency } from '../../context/CurrencyContext'
import { formatCurrency } from '../../lib/utils/currency'
import { formatDate } from '../../lib/utils/dates'
import StatusBadge from './components/StatusBadge'
import { groupSubItemsByStep } from '../../lib/utils/bundles'

export default function OrderDetail() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const { symbol, precision } = useCurrency()
  const perms     = user?.permissions ?? []
  const canEdit   = perms.includes('sale_update')
  const canDelete = perms.includes('sale_delete')

  const [order, setOrder]                   = useState(null)
  const [loading, setLoading]               = useState(true)
  const [confirmDelete, setConfirmDelete]       = useState(false)
  const [deletingOrder, setDeletingOrder]       = useState(false)
  const [updatingStatus, setUpdatingStatus]     = useState(false)
  const [confirmVoidPayment, setConfirmVoidPayment] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getOrderById(id)
      .then((res) => {
        if (!cancelled) setOrder(res.data?.data ?? res.data)
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load sale')
          navigate('/sales')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  async function handleDeleteOrder() {
    setDeletingOrder(true)
    try {
      await deleteOrder(id)
      toast.success('Sale deleted successfully')
      navigate('/sales')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete sale')
      setDeletingOrder(false)
      setConfirmDelete(false)
    }
  }

  async function handleStatusUpdate(newStatus) {
    setUpdatingStatus(true)
    try {
      await updateOrderStatus(id, newStatus)
      toast.success(newStatus === 0 ? 'Payment voided. Order is now Due.' : 'Order status updated')
      // Reload the order after status update
      const res = await getOrderById(id)
      setOrder(res.data?.data ?? res.data)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  function handlePrintInvoice() {
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!order) return null

  const items        = order.items        ?? order.orderItems        ?? []
  const transactions = order.transactions ?? order.orderTransactions ?? []
  const due          = Number(order.due ?? 0)

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/sales')}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back to Sales"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
            Sale #{order.id}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => navigate(`/sales/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors cursor-pointer"
              aria-label="Edit Sale"
            >
              <Pencil size={15} />
              Edit
            </button>
          )}

          <button
            onClick={() => navigate(`/pos/invoice/${id}`, { state: { backTo: `/sales/${id}` } })}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
            aria-label="Print Receipt"
          >
            <Receipt size={15} />
            Print Receipt
          </button>
          <button
            onClick={() => navigate(`/sales/${id}/invoice`)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors cursor-pointer"
            aria-label="A4 Invoice"
          >
            <FileText size={15} />
            Print Invoice
          </button>
          {canDelete && (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-gray-600 dark:text-slate-400">Delete this sale?</span>
                <button
                  onClick={handleDeleteOrder}
                  disabled={deletingOrder}
                  className="text-red-600 font-medium hover:underline disabled:opacity-60 cursor-pointer"
                >
                  {deletingOrder ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletingOrder}
                  className="text-gray-500 hover:underline cursor-pointer"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                aria-label="Delete Sale"
              >
                <Trash2 size={15} />
                Delete
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Order Info card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Sale Information</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Customer</dt>
              <dd className="text-gray-800 dark:text-slate-200 font-medium mt-0.5">
                {order.customerName ?? order.customer?.name ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Date</dt>
              <dd className="text-gray-800 dark:text-slate-200 mt-0.5">
                {formatDate(order.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Status</dt>
              <dd className="mt-0.5">
                <StatusBadge status={order.status} />
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Note</dt>
              <dd className="text-gray-800 dark:text-slate-200 mt-0.5">{order.note || '—'}</dd>
            </div>
          </dl>

        </div>

        {/* Financial summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-slate-400">
              <span>Sub Total</span>
              <span>{formatCurrency(order.subTotal ?? order.subtotal ?? 0, symbol, precision)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-slate-400">
              <span>Discount</span>
              <span>- {formatCurrency(order.discount ?? 0, symbol, precision)}</span>
            </div>
            {Number(order.roundingAdjustment ?? 0) !== 0 && (
              <div className="flex justify-between text-gray-500 dark:text-slate-400 italic text-sm">
                <span>Rounding</span>
                <span className={Number(order.roundingAdjustment) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}>
                  {Number(order.roundingAdjustment) > 0 ? '+' : ''}
                  {formatCurrency(Math.abs(Number(order.roundingAdjustment)), symbol, precision)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 dark:text-slate-200 pt-2 border-t border-gray-100 dark:border-slate-700">
              <span>Total</span>
              <span>{formatCurrency(Number(order.roundedTotal ?? 0) > 0 ? Number(order.roundedTotal) : Number(order.total ?? 0), symbol, precision)}</span>
            </div>
            <div className="flex justify-between text-green-700 dark:text-green-400">
              <span>Paid</span>
              <span>{formatCurrency(order.paid ?? 0, symbol, precision)}</span>
            </div>
            <div className="flex justify-between text-yellow-700 dark:text-yellow-400 font-medium">
              <span>Due</span>
              <span>{formatCurrency(due, symbol, precision)}</span>
            </div>
            {Number(order.change ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-slate-400">Change</span>
                <span className="font-medium text-gray-800 dark:text-slate-200">{formatCurrency(order.change, symbol, precision)}</span>
              </div>
            )}
          </div>

          {/* Void Payment — shown when order is paid; allows correcting a wrong payment method */}
          {order.status === 1 && canEdit && (
            confirmVoidPayment ? (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-slate-400 flex-1">Void this payment?</span>
                <button
                  onClick={async () => {
                    await handleStatusUpdate(0)
                    setConfirmVoidPayment(false)
                  }}
                  disabled={updatingStatus}
                  className="text-xs text-red-600 font-medium hover:underline disabled:opacity-60 cursor-pointer"
                >
                  {updatingStatus ? 'Voiding...' : 'Yes, Void'}
                </button>
                <button
                  onClick={() => setConfirmVoidPayment(false)}
                  disabled={updatingStatus}
                  className="text-xs text-gray-500 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmVoidPayment(true)}
                className="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 rounded-xl transition-colors cursor-pointer"
              >
                Void Payment
              </button>
            )
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Product</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">SKU</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Qty</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Unit Price</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Discount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No items found.</td>
                </tr>
              ) : (
                (() => {
                  const rendered = new Set()
                  let rowNumber = 0

                  return items.map((item, index) => {
                    if (rendered.has(item.id)) return null
                    // Sub-items are rendered inline under their bundle header
                    if (item.bundleHeaderSaleItemId != null) return null

                    rowNumber++

                    if (item.isBundleHeader) {
                      const subItems = items.filter(si => si.bundleHeaderSaleItemId === item.id)
                      subItems.forEach(si => rendered.add(si.id))

                      const stepGroups = groupSubItemsByStep(subItems)

                      return (
                        <React.Fragment key={item.id ?? index}>
                          {/* Bundle header row — bold indigo styling */}
                          <tr className="border-b border-indigo-100 dark:border-indigo-800/50 bg-indigo-50/40 dark:bg-indigo-900/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                            <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{rowNumber}</td>
                            <td className="py-3 px-4 text-indigo-700 dark:text-indigo-300 font-bold">
                              {item.productName ?? item.product?.name ?? '—'}
                            </td>
                            <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{item.productSku ?? '—'}</td>
                            <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400">{item.quantity ?? '—'}</td>
                            <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-semibold">
                              {formatCurrency(item.price ?? 0, symbol, precision)}
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-slate-400">
                              {formatCurrency(item.discount ?? 0, symbol, precision)}
                            </td>
                            <td className="py-3 px-4 text-indigo-700 dark:text-indigo-300 font-bold">
                              {formatCurrency(item.total ?? item.lineTotal ?? 0, symbol, precision)}
                            </td>
                          </tr>
                          {stepGroups ? (
                            /* Multi-step bundle: group sub-items under step label headers */
                            stepGroups.map(([label, groupItems]) => (
                              <React.Fragment key={label}>
                                {/* Step label header row */}
                                <tr className="border-b border-gray-50 dark:border-slate-700/50">
                                  <td className="py-1 px-4" />
                                  <td colSpan={6} className="py-1 px-4 pl-8 text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">
                                    {label}:
                                  </td>
                                </tr>
                                {/* Sub-items under this step */}
                                {groupItems.map((si, j) => (
                                  <tr key={si.id ?? `sub-${j}`} className="border-b border-gray-50 dark:border-slate-700/50">
                                    <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs" />
                                    <td className="py-2 px-4 pl-10 text-gray-500 dark:text-slate-400 text-xs italic">
                                      - {si.productName ?? si.product?.name ?? '—'}
                                    </td>
                                    <td className="py-2 px-4 text-gray-400 dark:text-slate-500 text-xs">{si.productSku ?? '—'}</td>
                                    <td className="py-2 px-4 text-gray-400 dark:text-slate-500 text-xs">{si.quantity ?? '—'}</td>
                                    <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs">—</td>
                                    <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs">—</td>
                                    <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs">—</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))
                          ) : (
                            /* Flat bundle: render sub-items without grouping */
                            subItems.map((si, j) => (
                              <tr key={si.id ?? `sub-${j}`} className="border-b border-gray-50 dark:border-slate-700/50">
                                <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs" />
                                <td className="py-2 px-4 pl-8 text-gray-500 dark:text-slate-400 text-xs italic">
                                  <span className="text-indigo-400 mr-1" aria-hidden="true">{'\u203a'}</span>
                                  {si.productName ?? si.product?.name ?? '—'}
                                </td>
                                <td className="py-2 px-4 text-gray-400 dark:text-slate-500 text-xs">{si.productSku ?? '—'}</td>
                                <td className="py-2 px-4 text-gray-400 dark:text-slate-500 text-xs">{si.quantity ?? '—'}</td>
                                <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs">—</td>
                                <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs">—</td>
                                <td className="py-2 px-4 text-gray-300 dark:text-slate-600 text-xs">—</td>
                              </tr>
                            ))
                          )}
                        </React.Fragment>
                      )
                    }

                    // Regular item row
                    const isVoided = item.isVoided === true
                    return (
                      <tr key={item.id ?? index} className={`border-b border-gray-50 dark:border-slate-700 ${
                        isVoided
                          ? 'bg-red-50/40 dark:bg-red-900/10 opacity-70'
                          : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}>
                        <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{rowNumber}</td>
                        <td className="py-3 px-4 font-medium">
                          <span className={isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'}>
                            {item.productName ?? item.product?.name ?? '—'}
                          </span>
                          {isVoided && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 uppercase tracking-wide">
                              Voided
                            </span>
                          )}
                          {item.modifierNote && (
                            <p className={`text-xs mt-0.5 ${isVoided ? 'line-through text-gray-300 dark:text-slate-600' : 'text-gray-400 dark:text-slate-500 italic'}`}>
                              {item.modifierNote}
                            </p>
                          )}
                        </td>
                        <td className={`py-3 px-4 ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-500 dark:text-slate-400'}`}>{item.productSku ?? '—'}</td>
                        <td className={`py-3 px-4 ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-600 dark:text-slate-400'}`}>{item.quantity ?? '—'}</td>
                        <td className={`py-3 px-4 ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-600 dark:text-slate-400'}`}>{formatCurrency(item.price ?? 0, symbol, precision)}</td>
                        <td className={`py-3 px-4 ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-600 dark:text-slate-400'}`}>{formatCurrency(item.discount ?? 0, symbol, precision)}</td>
                        <td className={`py-3 px-4 font-medium ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'}`}>{formatCurrency(item.total ?? item.lineTotal ?? 0, symbol, precision)}</td>
                      </tr>
                    )
                  })
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transactions table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Payment Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide w-12">#</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Amount</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Method</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Txn ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Recorded By</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400 dark:text-slate-500 text-sm">No transactions found.</td>
                </tr>
              ) : (
                transactions.map((txn, index) => (
                  <tr key={txn.id ?? index} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-slate-300 font-medium">{formatCurrency(txn.amount ?? 0, symbol, precision)}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-slate-400 capitalize">
                      {txn.paymentMethodName ?? txn.paidBy ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{txn.transactionId ?? txn.txnId ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-slate-400">{txn.userName ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-slate-400">
                      {formatDate(txn.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

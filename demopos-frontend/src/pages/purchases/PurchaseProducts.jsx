import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getPurchaseProducts, deletePurchase } from '../../api/purchases'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../lib/utils/dates'
import { DISCOUNT_TYPE } from '../../constants/discountTypes'

export default function PurchaseProducts() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const perms = user?.permissions ?? []
  const canView = perms.includes('purchase_view')
  const canDelete = perms.includes('purchase_delete')
  const canUpdate = perms.includes('purchase_update')

  const [purchase, setPurchase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletingPurchase, setDeletingPurchase] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPurchaseProducts(id)
      .then(res => {
        if (!cancelled) setPurchase(res.data?.data ?? null)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load purchase products')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  async function handleDeletePurchase() {
    setDeletingPurchase(true)
    try {
      await deletePurchase(id)
      toast.success('Purchase deleted successfully')
      navigate('/purchases')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to delete purchase')
      setDeletingPurchase(false)
      setConfirmDelete(false)
    }
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to view this page.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!purchase) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700">Purchase not found</p>
          <button
            onClick={() => navigate('/purchases')}
            className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer"
          >
            Back to Purchases
          </button>
        </div>
      </div>
    )
  }

  const items = purchase.items ?? []
  const resolvedDiscount =
    purchase.discountType === DISCOUNT_TYPE.PERCENT
      ? ((purchase.subTotal ?? 0) * (purchase.discount ?? 0)) / 100
      : purchase.discount ?? 0

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/purchases')}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back to Purchases"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Purchase #{purchase.id}</h1>
        </div>
        <div className="flex items-center gap-2">
          {canUpdate && (
            <button
              onClick={() => navigate(`/purchases/${id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors cursor-pointer"
              aria-label="Edit Purchase"
            >
              <Pencil size={15} />
              Edit
            </button>
          )}
          {canDelete && (
            confirmDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Delete this purchase?</span>
                <button
                  onClick={handleDeletePurchase}
                  disabled={deletingPurchase}
                  className="text-red-600 font-medium hover:underline disabled:opacity-60 cursor-pointer"
                >
                  {deletingPurchase ? 'Deleting...' : 'Yes'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletingPurchase}
                  className="text-gray-500 hover:underline cursor-pointer"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors cursor-pointer"
                aria-label="Delete Purchase"
              >
                <Trash2 size={15} />
                Delete
              </button>
            )
          )}
        </div>
      </div>

      {/* Two-card grid: Info (left) + Summary (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Purchase Information card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Purchase Information</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Supplier</dt>
              <dd className="text-gray-800 font-medium mt-0.5">{purchase.supplierName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Date</dt>
              <dd className="text-gray-800 mt-0.5">
                {formatDate(purchase.date)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400 text-xs uppercase tracking-wide">Payment Method</dt>
              <dd className="text-gray-800 font-medium mt-0.5">{purchase.paymentMethodName ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {/* Summary card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Sub Total</span>
              <span>{Number(purchase.subTotal ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>+ {Number(purchase.tax ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span>
                - {Number(resolvedDiscount).toFixed(2)}
                {purchase.discountType === DISCOUNT_TYPE.PERCENT && ` (${purchase.discount}%)`}
              </span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span>+ {Number(purchase.shipping ?? 0).toFixed(2)}</span>
            </div>
            {Number(purchase.roundingAdjustment ?? 0) !== 0 && (
              <div className="flex justify-between text-sm text-gray-500 dark:text-slate-400 italic">
                <span>Rounding</span>
                <span className={Number(purchase.roundingAdjustment) > 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-500 dark:text-red-400'}>
                  {Number(purchase.roundingAdjustment) > 0 ? '+' : ''}
                  {Number(purchase.roundingAdjustment).toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 pt-2 border-t border-gray-100 dark:border-slate-700">
              <span>Grand Total</span>
              <span className="text-blue-600 font-bold">
                {Number(purchase.roundedTotal ?? purchase.grandTotal ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No items in this purchase.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">#</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Product Name</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Purchase Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Selling Price</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Quantity</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wide">Row Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id ?? index} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                    <td className="py-3 px-4 text-gray-400 dark:text-slate-500 text-xs">{index + 1}</td>
                    <td className="py-3 px-4 text-gray-700 text-sm font-medium">{item.productName}</td>
                    <td className="py-3 px-4 text-gray-700 text-sm">{Number(item.purchasePrice ?? 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-700 text-sm">{Number(item.price ?? 0).toFixed(2)}</td>
                    <td className="py-3 px-4 text-gray-700 text-sm">{item.quantity}</td>
                    <td className="py-3 px-4 text-gray-700 text-sm font-medium">
                      {(Number(item.purchasePrice ?? 0) * Number(item.quantity ?? 0)).toFixed(2)}
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

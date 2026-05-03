import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { getCollectionReceipt } from '../../api/sales'
import { getAll as getSettings } from '../../api/settings'
import { formatDate } from '../../lib/utils/dates'

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

export default function CollectionReceipt() {
  const { id, txnId } = useParams()
  const navigate      = useNavigate()

  // receipt = { order: OrderDetailDto, txn: OrderTransactionDto }
  const [receipt, setReceipt]   = useState(null)
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      getCollectionReceipt(id, txnId),
      getSettings().catch(() => null), // settings failure must not block receipt
    ])
      .then(([receiptRes, settingsRes]) => {
        const order = receiptRes.data?.data ?? receiptRes.data
        const txn   = order?.transactions?.find((t) => String(t.id) === String(txnId))
        if (!txn) throw new Error('Transaction not found in receipt')
        setReceipt({ order, txn })

        if (settingsRes?.data?.data) {
          setSettings({ ...SETTINGS_DEFAULTS, ...settingsRes.data.data })
        }
      })
      .catch(() => {
        toast.error('Failed to load receipt')
        navigate(`/sales/${id}`)
      })
      .finally(() => setLoading(false))
  }, [id, txnId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!receipt) return null

  const { order, txn } = receipt
  const receiptWidth   = widthMap[settings.receipt_maxwidth] ?? '448px'

  return (
    <div>
      {/* Screen-only controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6 print:hidden">
        <button
          onClick={() => navigate(`/sales/${id}`)}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Back to Sale"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Collection Receipt</h1>
        <div className="ml-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors cursor-pointer"
            aria-label="Print receipt"
          >
            <Printer size={15} />
            Print
          </button>
        </div>
      </div>

      {/* Receipt card — visible on screen and in print */}
      <div
        className="bg-white text-gray-900 rounded-2xl shadow-sm border border-gray-100 p-8 mx-auto"
        style={{ maxWidth: receiptWidth }}
      >
        <div className="text-center mb-6">
          {bool(settings.is_show_logo) && (
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow mx-auto mb-3">
              <span className="text-white font-bold text-xl">P</span>
            </div>
          )}
          {bool(settings.is_show_site_name) && (
            <h2 className="text-lg font-bold text-gray-900">{settings.site_name}</h2>
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
          <p className="text-xs text-gray-400 mt-0.5">Payment Collection Receipt</p>
        </div>

        <div className="space-y-3 text-sm border-t border-dashed border-gray-200 pt-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Sale</span>
            <span className="font-medium text-gray-800">#{order.id ?? id}</span>
          </div>
          {bool(settings.is_show_customer) && (
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium text-gray-800">
                {order.customerName ?? '—'}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-dashed border-gray-200 pt-3 mt-3">
            <span className="text-gray-500">Amount Paid</span>
            <span className="font-bold text-gray-900 text-base">
              {Number(txn.amount ?? 0).toFixed(2)}
            </span>
          </div>
          {Number(order.change ?? txn.change ?? 0) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Change</span>
              <span className="font-medium text-gray-800">
                {Number(order.change ?? txn.change).toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Method</span>
            <span className="font-medium text-gray-800 capitalize">
              {txn.paidBy ?? txn.paymentMethodName ?? '—'}
            </span>
          </div>
          {txn.transactionId && (
            <div className="flex justify-between">
              <span className="text-gray-500">Txn ID</span>
              <span className="font-medium text-gray-800">{txn.transactionId}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-dashed border-gray-200 pt-3 mt-3">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-800">
              {formatDate(txn.createdAt)}
            </span>
          </div>
        </div>

        {bool(settings.is_show_note) && (
          <p className="text-center text-xs text-gray-400 mt-6 border-t border-dashed border-gray-200 pt-4">
            {settings.note_to_customer || 'Thank you!'}
          </p>
        )}
      </div>
    </div>
  )
}

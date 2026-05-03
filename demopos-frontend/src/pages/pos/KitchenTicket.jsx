import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { getAll as getSettings } from '../../api/settings'
import { ORDER_TYPE } from '../../constants/orderTypes'

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

export default function KitchenTicket() {
  const { saleId } = useParams()
  const [searchParams] = useSearchParams()
  const isVoid = searchParams.get('type') === 'void'

  const [ticket, setTicket]     = useState(null)
  const [settings, setSettings] = useState(SETTINGS_DEFAULTS)
  const [loading, setLoading]   = useState(true)

  // Load ticket from sessionStorage and settings from API
  useEffect(() => {
    window.onafterprint = () => window.close()

    let ticketData = null
    try {
      const raw = sessionStorage.getItem('kitchen_ticket_pending')
      if (raw) {
        ticketData = JSON.parse(raw)
        sessionStorage.removeItem('kitchen_ticket_pending')
      }
    } catch {
      // fall through — ticketData stays null
    }

    if (ticketData) {
      setTicket(ticketData)
    }

    // Load settings; failure must not block the ticket
    getSettings()
      .then((res) => {
        if (res?.data?.data) {
          setSettings((prev) => ({ ...prev, ...res.data.data }))
        }
      })
      .catch(() => {
        // settings failure is non-fatal — keep defaults
      })
      .finally(() => {
        setLoading(false)
      })
  }, [saleId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-print once both ticket and settings are ready (loading finished)
  useEffect(() => {
    if (!ticket || loading) return
    const t = setTimeout(() => window.print(), 500)
    return () => clearTimeout(t)
  }, [ticket, loading])

  if (loading) return <LoadingSpinner />
  if (!ticket) return null

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
          onClick={() => window.close()}
          className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {isVoid ? 'VOID Notification' : 'Kitchen Order'} #{saleId}
        </h1>
        <button
          onClick={() => window.print()}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
          aria-label="Print kitchen ticket"
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
            {new Date(ticket.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <hr className="border-dashed border-gray-300 my-2" />

        {/* Kitchen-specific content */}
        <div className="text-xs">
          {isVoid && (
            <p className="text-center font-bold text-lg mb-1">*** VOID ***</p>
          )}
          <p className="text-center font-bold text-sm">
            {isVoid ? 'VOID NOTIFICATION' : 'KITCHEN ORDER'}
          </p>
          {ticket.orderType === ORDER_TYPE.TAKEAWAY ? (
            <p className="text-center font-bold text-sm tracking-wide">TAKEAWAY</p>
          ) : ticket.tableNumber ? (
            <p className="text-center text-xs">
              Table: {ticket.tableNumber}{ticket.tableLabel ? ` (${ticket.tableLabel})` : ''}
            </p>
          ) : null}
        </div>

        <hr className="border-dashed border-gray-300 my-2" />

        {/* Items */}
        <div className="text-xs space-y-1 mb-2">
          {ticket.ticketItems?.map((item, i) => (
            <div key={i}>
              <p>
                {item.isVoid && <span className="font-bold">VOID: </span>}
                <span className="font-bold">{item.quantity}x </span>
                {item.productName}
              </p>
              {item.modifierNote && (
                <p className="pl-4 italic text-gray-500">* {item.modifierNote}</p>
              )}
            </div>
          ))}
        </div>

        <hr className="border-dashed border-gray-300 my-3" />

        {/* Footer */}
        <p className="text-center text-xs text-gray-400">Order #{ticket.saleId}</p>
      </div>
    </div>
  )
}

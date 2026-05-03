import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'
import toast from 'react-hot-toast'
import * as settingsApi from '../../api/settings'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import PriceInput from '../../components/PriceInput'

/** Parse a backend boolean string ("true"/"false"/true/false) into a JS boolean. */
function parseBool(value) {
  if (typeof value === 'boolean') return value
  return value === 'true'
}

/** Initial settings shape — all fields falsy/empty so form is always controlled. */
const defaultSettings = {
  site_name:         '',
  site_url:          '',
  meta_description:  '',
  contact_phone:     '',
  contact_email:     '',
  contact_address:   '',
  contact_fax:       '',
  contact_mobile:    '',
  working_hour:      '',
  note_to_customer:  '',
  receipt_maxwidth:  'medium',
  is_show_logo:      false,
  is_show_site_name: false,
  is_show_phone:     false,
  is_show_email:     false,
  is_show_address:   false,
  is_show_customer:  false,
  is_show_note:      false,
  rounding_enabled:  false,
  rounding_quantum:  '0.05',
  purchase_rounding_enabled: false,
  purchase_rounding_quantum: '0.05',
  restaurant_mode:            false,
  takeaway_charge_enabled:    false,
  takeaway_charge_amount:     '0',
}

export default function Settings() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const perms = user?.permissions ?? []

  const canGeneral  = perms.includes('website_settings')
  const canContacts = perms.includes('contact_settings')
  const canInvoice  = perms.includes('invoice_settings')

  /** Derive visible tabs and the first one as the default active tab. */
  const tabs = [
    canGeneral  && { key: 'general',    label: 'General'    },
    canContacts && { key: 'contacts',   label: 'Contacts'   },
    canInvoice  && { key: 'invoice',    label: 'Invoice'    },
    canGeneral  && { key: 'restaurant', label: 'Restaurant' },
  ].filter(Boolean)

  const [activeTab, setActiveTab]   = useState(tabs[0]?.key ?? null)
  const [settings, setSettings]     = useState(defaultSettings)
  const [loading, setLoading]       = useState(true)
  const [savingTab, setSavingTab]   = useState(null) // which tab is currently saving

  useEffect(() => {
    if (tabs.length === 0) return
    loadSettings()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function loadSettings() {
    setLoading(true)
    settingsApi.getAll()
      .then((res) => {
        const data = res.data?.data ?? {}
        setSettings({
          site_name:         data.site_name         ?? '',
          site_url:          data.site_url           ?? '',
          meta_description:  data.meta_description  ?? '',
          contact_phone:     data.contact_phone      ?? '',
          contact_email:     data.contact_email      ?? '',
          contact_address:   data.contact_address    ?? '',
          contact_fax:       data.contact_fax        ?? '',
          contact_mobile:    data.contact_mobile     ?? '',
          working_hour:      data.working_hour       ?? '',
          note_to_customer:  data.note_to_customer   ?? '',
          receipt_maxwidth:  data.receipt_maxwidth   ?? 'medium',
          is_show_logo:      parseBool(data.is_show_logo),
          is_show_site_name: parseBool(data.is_show_site_name),
          is_show_phone:     parseBool(data.is_show_phone),
          is_show_email:     parseBool(data.is_show_email),
          is_show_address:   parseBool(data.is_show_address),
          is_show_customer:  parseBool(data.is_show_customer),
          is_show_note:      parseBool(data.is_show_note),
          rounding_enabled:  parseBool(data.rounding_enabled),
          rounding_quantum:  data.rounding_quantum ?? '0.05',
          purchase_rounding_enabled: parseBool(data.purchase_rounding_enabled),
          purchase_rounding_quantum: data.purchase_rounding_quantum ?? '0.05',
          restaurant_mode:            parseBool(data.restaurant_mode),
          takeaway_charge_enabled:    parseBool(data.takeaway_charge_enabled),
          takeaway_charge_amount:     data.takeaway_charge_amount ?? '0',
        })
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }

  /** Generic field updater used by all tabs. */
  function setField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  async function saveGeneral(e) {
    e.preventDefault()
    if (!settings.site_name.trim()) {
      toast.error('Business Name is required.')
      return
    }
    setSavingTab('general')
    try {
      await settingsApi.updateGeneral({
        siteName:        settings.site_name.trim(),
        siteUrl:         settings.site_url.trim(),
        metaDescription: settings.meta_description.trim(),
        roundingEnabled: settings.rounding_enabled,
        roundingQuantum: settings.rounding_quantum,
        purchaseRoundingEnabled: settings.purchase_rounding_enabled,
        purchaseRoundingQuantum: settings.purchase_rounding_quantum,
      })
      toast.success('General settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save general settings')
    } finally {
      setSavingTab(null)
    }
  }

  async function saveContacts(e) {
    e.preventDefault()
    setSavingTab('contacts')
    try {
      await settingsApi.updateContacts({
        contactPhone:   settings.contact_phone.trim(),
        contactEmail:   settings.contact_email.trim(),
        contactAddress: settings.contact_address.trim(),
        contactFax:     settings.contact_fax.trim(),
        contactMobile:  settings.contact_mobile.trim(),
        workingHour:    settings.working_hour.trim(),
      })
      toast.success('Contact settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save contact settings')
    } finally {
      setSavingTab(null)
    }
  }

  async function saveInvoice(e) {
    e.preventDefault()
    setSavingTab('invoice')
    try {
      await settingsApi.updateInvoice({
        noteToCustomer: settings.note_to_customer.trim(),
        receiptMaxWidth: settings.receipt_maxwidth,
        isShowLogo:     settings.is_show_logo,
        isShowSiteName: settings.is_show_site_name,
        isShowPhone:    settings.is_show_phone,
        isShowEmail:    settings.is_show_email,
        isShowAddress:  settings.is_show_address,
        isShowCustomer: settings.is_show_customer,
        isShowNote:     settings.is_show_note,
      })
      toast.success('Invoice settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save invoice settings')
    } finally {
      setSavingTab(null)
    }
  }

  async function saveRestaurant(e) {
    e.preventDefault()
    setSavingTab('restaurant')
    try {
      await settingsApi.updateGeneral({
        siteName:                  settings.site_name.trim(),
        siteUrl:                   settings.site_url.trim(),
        metaDescription:           settings.meta_description.trim(),
        roundingEnabled:           settings.rounding_enabled,
        roundingQuantum:           settings.rounding_quantum,
        purchaseRoundingEnabled:   settings.purchase_rounding_enabled,
        purchaseRoundingQuantum:   settings.purchase_rounding_quantum,
        restaurantMode:            settings.restaurant_mode,
        takeawayChargeEnabled:     settings.takeaway_charge_enabled,
        takeawayChargeAmount:      settings.takeaway_charge_amount,
      })
      toast.success('Restaurant settings saved')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to save restaurant settings')
    } finally {
      setSavingTab(null)
    }
  }

  /** Appearance card — rendered for all authenticated users regardless of other perms. */
  const AppearanceCard = (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
      <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Appearance</h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Dark Mode</p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Switch between light and dark themes
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer ${
            theme === 'dark' ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
          }`}
          role="switch"
          aria-checked={theme === 'dark'}
        >
          <span className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow transition-transform ${
            theme === 'dark' ? 'translate-x-8' : 'translate-x-1'
          }`}>
            {theme === 'dark'
              ? <Moon size={11} className="text-blue-600" />
              : <Sun size={11} className="text-gray-400" />
            }
          </span>
        </button>
      </div>
    </div>
  )

  /**
   * Rounding card — shown to users with website_settings permission.
   * Fields are still persisted via saveGeneral (backend group: general).
   */
  const RoundingCard = canGeneral ? (
    <form onSubmit={saveGeneral}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Rounding</h2>
        <div className="space-y-4">

          {/* Sales Rounding Adjustment */}
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Sales Rounding Adjustment
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
              Rounds cash sale totals to the nearest quantum. Applies to cash payments only.
              Card and bank transfer payments are not rounded.
            </p>

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-700 dark:text-slate-300">Enable Cash Rounding</p>
              <button
                type="button"
                onClick={() => setField('rounding_enabled', !settings.rounding_enabled)}
                disabled={savingTab === 'general'}
                aria-label={settings.rounding_enabled ? 'Disable cash rounding' : 'Enable cash rounding'}
                role="switch"
                aria-checked={settings.rounding_enabled}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer disabled:opacity-50 ${
                  settings.rounding_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  settings.rounding_enabled ? 'translate-x-8' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {settings.rounding_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Rounding Quantum
                </label>
                <select
                  value={settings.rounding_quantum}
                  onChange={(e) => setField('rounding_quantum', e.target.value)}
                  disabled={savingTab === 'general'}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="0.05">0.05 (nearest 5 cents)</option>
                  <option value="0.10">0.10 (nearest 10 cents)</option>
                </select>
              </div>
            )}
          </div>

          {/* Purchase Rounding Adjustment */}
          <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
            <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Purchase Rounding Adjustment
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
              Rounds cash purchase totals paid to suppliers. Applies only to cash-type payment methods.
              Independent of sales rounding above.
            </p>

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-700 dark:text-slate-300">Enable Purchase Rounding</p>
              <button
                type="button"
                onClick={() => setField('purchase_rounding_enabled', !settings.purchase_rounding_enabled)}
                disabled={savingTab === 'general'}
                aria-label={settings.purchase_rounding_enabled ? 'Disable purchase rounding' : 'Enable purchase rounding'}
                role="switch"
                aria-checked={settings.purchase_rounding_enabled}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer disabled:opacity-50 ${
                  settings.purchase_rounding_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  settings.purchase_rounding_enabled ? 'translate-x-8' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {settings.purchase_rounding_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Rounding Quantum
                </label>
                <select
                  value={settings.purchase_rounding_quantum}
                  onChange={(e) => setField('purchase_rounding_quantum', e.target.value)}
                  disabled={savingTab === 'general'}
                  className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="0.05">0.05 (nearest 5 cents)</option>
                  <option value="0.10">0.10 (nearest 10 cents)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingTab === 'general'}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              {savingTab === 'general' ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </form>
  ) : null

  // All tabs hidden — show only Appearance and Rounding cards
  if (tabs.length === 0) {
    return (
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Settings</h1>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            {AppearanceCard}
            {RoundingCard}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Appearance + Rounding */}
        <div className="space-y-6">
          {/* Appearance — visible to all authenticated users */}
          {AppearanceCard}

          {/* Rounding — visible to users with website_settings permission */}
          {RoundingCard}
        </div>

        {/* Right column: tabbed settings (General / Contacts / Invoice) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 dark:border-slate-700 px-6 pt-4 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border-b-2 border-blue-600'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* General Tab */}
                {activeTab === 'general' && canGeneral && (
                  <form onSubmit={saveGeneral} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Business Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={settings.site_name}
                        onChange={(e) => setField('site_name', e.target.value)}
                        placeholder="My Business"
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'general'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Site URL</label>
                      <input
                        type="text"
                        value={settings.site_url}
                        onChange={(e) => setField('site_url', e.target.value)}
                        placeholder="https://example.com"
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'general'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Meta Description</label>
                      <textarea
                        value={settings.meta_description}
                        onChange={(e) => setField('meta_description', e.target.value)}
                        placeholder="Brief description of your business"
                        rows={3}
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'general'}
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingTab === 'general'}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        {savingTab === 'general' ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Contacts Tab */}
                {activeTab === 'contacts' && canContacts && (
                  <form onSubmit={saveContacts} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
                      <input
                        type="text"
                        value={settings.contact_phone}
                        onChange={(e) => setField('contact_phone', e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'contacts'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                      <input
                        type="text"
                        value={settings.contact_email}
                        onChange={(e) => setField('contact_email', e.target.value)}
                        placeholder="info@example.com"
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'contacts'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Address</label>
                      <textarea
                        value={settings.contact_address}
                        onChange={(e) => setField('contact_address', e.target.value)}
                        placeholder="123 Main St, City, Country"
                        rows={2}
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'contacts'}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Fax</label>
                        <input
                          type="text"
                          value={settings.contact_fax}
                          onChange={(e) => setField('contact_fax', e.target.value)}
                          placeholder="+1 234 567 8901"
                          className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                          disabled={savingTab === 'contacts'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Mobile</label>
                        <input
                          type="text"
                          value={settings.contact_mobile}
                          onChange={(e) => setField('contact_mobile', e.target.value)}
                          placeholder="+1 234 567 8902"
                          className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                          disabled={savingTab === 'contacts'}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Working Hours</label>
                      <input
                        type="text"
                        value={settings.working_hour}
                        onChange={(e) => setField('working_hour', e.target.value)}
                        placeholder="Mon-Fri 9am-6pm"
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'contacts'}
                      />
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingTab === 'contacts'}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        {savingTab === 'contacts' ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Restaurant Tab */}
                {activeTab === 'restaurant' && canGeneral && (
                  <form onSubmit={saveRestaurant} className="space-y-5">
                    {/* Restaurant Mode toggle */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Restaurant Mode
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
                        Enable table-based ordering at the POS terminal. When enabled, cashiers select
                        a table or takeaway before adding items.
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-700 dark:text-slate-300">
                          Enable Restaurant Mode (table-based ordering)
                        </p>
                        <button
                          type="button"
                          onClick={() => setField('restaurant_mode', !settings.restaurant_mode)}
                          disabled={savingTab === 'restaurant'}
                          aria-label={settings.restaurant_mode ? 'Disable restaurant mode' : 'Enable restaurant mode'}
                          role="switch"
                          aria-checked={settings.restaurant_mode}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer disabled:opacity-50 ${
                            settings.restaurant_mode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            settings.restaurant_mode ? 'translate-x-8' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>
                    </div>

                    {/* Takeaway Surcharge */}
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-700">
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Takeaway Surcharge
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
                        Add a fixed surcharge to takeaway orders.
                      </p>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm text-gray-700 dark:text-slate-300">Enable Takeaway Surcharge</p>
                        <button
                          type="button"
                          onClick={() => setField('takeaway_charge_enabled', !settings.takeaway_charge_enabled)}
                          disabled={savingTab === 'restaurant'}
                          aria-label={settings.takeaway_charge_enabled ? 'Disable takeaway surcharge' : 'Enable takeaway surcharge'}
                          role="switch"
                          aria-checked={settings.takeaway_charge_enabled}
                          className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer disabled:opacity-50 ${
                            settings.takeaway_charge_enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-600'
                          }`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            settings.takeaway_charge_enabled ? 'translate-x-8' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {settings.takeaway_charge_enabled && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Takeaway Charge Amount
                          </label>
                          <PriceInput
                            value={settings.takeaway_charge_amount}
                            onChange={val => setField('takeaway_charge_amount', val)}
                            disabled={savingTab === 'restaurant'}
                            placeholder="0.00"
                            className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 disabled:opacity-50"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingTab === 'restaurant'}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        {savingTab === 'restaurant' ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Invoice Tab */}
                {activeTab === 'invoice' && canInvoice && (
                  <form onSubmit={saveInvoice} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Note to Customer</label>
                      <textarea
                        value={settings.note_to_customer}
                        onChange={(e) => setField('note_to_customer', e.target.value)}
                        placeholder="Thank you for your purchase!"
                        rows={3}
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                        disabled={savingTab === 'invoice'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Receipt Width</label>
                      <select
                        value={settings.receipt_maxwidth}
                        onChange={(e) => setField('receipt_maxwidth', e.target.value)}
                        className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                        disabled={savingTab === 'invoice'}
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">Receipt Display Options</p>
                      <div className="space-y-2">
                        {[
                          { key: 'is_show_logo',      label: 'Show Logo'          },
                          { key: 'is_show_site_name', label: 'Show Business Name' },
                          { key: 'is_show_phone',     label: 'Show Phone'         },
                          { key: 'is_show_email',     label: 'Show Email'         },
                          { key: 'is_show_address',   label: 'Show Address'       },
                          { key: 'is_show_customer',  label: 'Show Customer Info' },
                          { key: 'is_show_note',      label: 'Show Note'          },
                        ].map(({ key, label }) => (
                          <label
                            key={key}
                            className="flex items-center gap-3 cursor-pointer select-none dark:text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={settings[key]}
                              onChange={(e) => setField(key, e.target.checked)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              disabled={savingTab === 'invoice'}
                            />
                            <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={savingTab === 'invoice'}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors cursor-pointer"
                      >
                        {savingTab === 'invoice' ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

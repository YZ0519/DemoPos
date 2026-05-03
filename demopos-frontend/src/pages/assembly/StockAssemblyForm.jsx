import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, AlertTriangle, ArrowLeft, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { getTemplates, getTemplateById, createAssembly, getAssemblyProducts } from '../../api/assembly'
import { useAuth } from '../../context/AuthContext'
import { today } from '../../lib/utils/dates'
import SearchableSelect from '../../components/SearchableSelect'
import PriceInput from '../../components/PriceInput'

// ─── Empty ingredient row ────────────────────────────────────────────────────

function emptyIngredient() {
  return { productId: '', quantityUsed: '', wasteQuantity: '0' }
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function StockAssemblyForm() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const perms     = user?.permissions ?? []
  const canCreate = perms.includes('assembly_create')

  // ─── Reference data ──────────────────────────────────────────────────────

  const [templates, setTemplates] = useState([])
  const [products, setProducts]   = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (!canCreate) return
    Promise.all([
      getTemplates(1, 200),
      getAssemblyProducts(),
    ])
      .then(([tplRes, prodRes]) => {
        const tplData = tplRes.data?.data
        setTemplates(Array.isArray(tplData) ? tplData.filter((t) => t.isActive) : (tplData?.items ?? []).filter((t) => t.isActive))
        setProducts(prodRes.data?.data ?? [])
      })
      .catch(() => toast.error('Failed to load form data'))
      .finally(() => setDataLoading(false))
  }, [canCreate])

  // ─── Form state ───────────────────────────────────────────────────────────

  const [templateId, setTemplateId]         = useState('')
  const [assemblyType, setAssemblyType]     = useState('split')
  const [outputProductId, setOutputProductId] = useState('')
  const [outputQuantity, setOutputQuantity] = useState('')
  const [assemblyDate, setAssemblyDate]     = useState(today())
  const [note, setNote]                     = useState('')
  const [ingredients, setIngredients]       = useState([emptyIngredient()])
  const [submitting, setSubmitting]         = useState(false)
  const [formError, setFormError]           = useState('')

  // ─── Template pre-fill ────────────────────────────────────────────────────

  /**
   * When a template is selected, fetch the full detail (which includes items)
   * then pre-fill output product, output quantity, assembly type, and
   * ingredient rows. The user can still adjust all values before submitting.
   */
  async function handleTemplateChange(id) {
    setTemplateId(id)
    if (!id) return

    try {
      const res = await getTemplateById(id)
      const tpl = res.data?.data
      if (!tpl) return

      setAssemblyType(tpl.assemblyType)
      setOutputProductId(tpl.outputProductId ?? '')
      setOutputQuantity(tpl.defaultYield?.toString() ?? '')

      if (tpl.items && tpl.items.length > 0) {
        setIngredients(
          tpl.items.map((item) => ({
            productId:     item.productId?.toString() ?? '',
            quantityUsed:  item.defaultQuantity?.toString() ?? '',
            wasteQuantity: '0',
          }))
        )
      }
    } catch {
      toast.error('Failed to load template details')
    }
  }

  // ─── Ingredient helpers ───────────────────────────────────────────────────

  function addIngredient() {
    setIngredients((prev) => [...prev, emptyIngredient()])
  }

  function removeIngredient(idx) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateIngredient(idx, field, value) {
    setIngredients((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    )
  }

  // ─── Product lookup helpers ───────────────────────────────────────────────

  /** Get a product object by id (string or number safe). */
  function getProduct(id) {
    return products.find((p) => String(p.id) === String(id)) ?? null
  }

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name })),
    [products]
  )

  // ─── Live cost preview ────────────────────────────────────────────────────

  /**
   * Compute per-row cost data and totals.
   * Memoised so it only recalculates when ingredients or products change.
   */
  const costPreview = useMemo(() => {
    const rows = ingredients.map((row) => {
      const product = getProduct(row.productId)
      const used    = parseFloat(row.quantityUsed)  || 0
      const waste   = parseFloat(row.wasteQuantity) || 0
      const total   = used + waste
      const unitCost = parseFloat(product?.purchasePrice) || 0
      const lineCost = total * unitCost
      const stock    = parseFloat(product?.quantity) || 0
      const isShort  = total > 0 && total > stock

      return {
        productName: product?.name ?? '—',
        quantityUsed: used,
        wasteQuantity: waste,
        totalDeducted: total,
        unitCost,
        lineCost,
        stock,
        isShort,
      }
    })

    const totalInputCost = rows.reduce((sum, r) => sum + r.lineCost, 0)
    const outQty         = parseFloat(outputQuantity) || 0
    const costPerUnit    = outQty > 0 ? totalInputCost / outQty : 0
    const hasShortage    = rows.some((r) => r.isShort)

    return { rows, totalInputCost, costPerUnit, hasShortage }
  }, [ingredients, products, outputQuantity])

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    if (!outputProductId) { setFormError('Output product is required.'); return }
    if (!outputQuantity || parseFloat(outputQuantity) <= 0) {
      setFormError('Output quantity must be greater than zero.')
      return
    }

    const validIngredients = ingredients.filter((i) => i.productId && i.quantityUsed)
    if (validIngredients.length === 0) {
      setFormError('At least one ingredient with product and quantity used is required.')
      return
    }
    const zeroQty = validIngredients.some((i) => parseFloat(i.quantityUsed) <= 0)
    if (zeroQty) { setFormError('Ingredient quantity used must be greater than zero.'); return }

    const circular = validIngredients.some((i) => String(i.productId) === String(outputProductId))
    if (circular) {
      setFormError('A product cannot be both an input and the output of the same assembly.')
      return
    }

    const payload = {
      assemblyTemplateId: templateId ? Number(templateId) : null,
      assemblyType,
      outputProductId:    Number(outputProductId),
      outputQuantity:     parseFloat(outputQuantity),
      note:               note.trim() || null,
      assembledAt:        assemblyDate ? new Date(assemblyDate).toISOString() : new Date().toISOString(),
      items: validIngredients.map((row) => ({
        productId:     Number(row.productId),
        quantityUsed:  parseFloat(row.quantityUsed),
        wasteQuantity: parseFloat(row.wasteQuantity) || 0,
      })),
    }

    setSubmitting(true)
    try {
      const res = await createAssembly(payload)
      const created = res.data?.data
      toast.success('Assembly run recorded successfully')
      navigate(`/stock-assemblies/${created?.id ?? ''}`)
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Access denied ────────────────────────────────────────────────────────

  if (!canCreate) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to create assemblies.</p>
        </div>
      </div>
    )
  }

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/stock-assemblies')}
          className="text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
          aria-label="Back to stock assemblies"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">New Assembly Run</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/stock-assemblies')}
            disabled={submitting}
            className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="assembly-form"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 sm:px-5 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? 'Running...' : 'Run Assembly'}
          </button>
        </div>
      </div>

      <form id="assembly-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Template selector */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">
                Template (Optional)
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Assembly Template
                </label>
                <SearchableSelect
                  options={templates.map((t) => ({ id: t.id, name: `${t.name} (${t.assemblyType})` }))}
                  value={templateId}
                  onChange={handleTemplateChange}
                  placeholder="Select a template to pre-fill fields, or leave blank for ad-hoc..."
                  disabled={submitting}
                />
                {templateId && (
                  <button
                    type="button"
                    onClick={() => setTemplateId('')}
                    className="mt-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    Clear template
                  </button>
                )}
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
                  <Info size={11} />
                  Selecting a template pre-fills the fields below. You can still edit them before submitting.
                </p>
              </div>
            </div>

            {/* Assembly details */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Assembly Details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Assembly type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Assembly Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={assemblyType}
                    onChange={(e) => setAssemblyType(e.target.value)}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                    disabled={submitting}
                  >
                    <option value="split">Split</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                {/* Assembly date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Assembly Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={assemblyDate}
                    onChange={(e) => setAssemblyDate(e.target.value)}
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting}
                  />
                </div>

                {/* Output product */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Output Product <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={productOptions}
                    value={outputProductId}
                    onChange={setOutputProductId}
                    placeholder="Select output product..."
                    disabled={submitting}
                  />
                </div>

                {/* Output quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Output Quantity <span className="text-red-500">*</span>
                  </label>
                  <PriceInput
                    value={outputQuantity}
                    onChange={setOutputQuantity}
                    placeholder="0.00"
                    className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                    disabled={submitting}
                  />
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Units of output product produced</p>
                </div>
              </div>

            </div>

            {/* Ingredients */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">
                Ingredients <span className="text-red-500">*</span>
              </h2>

              {/* Insufficient stock warning banner */}
              {costPreview.hasShortage && (
                <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-800 dark:text-yellow-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-500" />
                  <span>
                    <strong>Warning:</strong> Some ingredients have insufficient stock. You may still proceed — the assembly will be recorded and stock may go negative.
                  </span>
                </div>
              )}

              {/* ── Desktop column headers (sm and above) ── */}
              <div className="hidden sm:grid grid-cols-[1fr_130px_130px_100px_36px] gap-2 px-1 mb-1">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Product</span>
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Qty Used</span>
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Waste</span>
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Total Deducted</span>
                <span />
              </div>

              {/* Ingredient rows */}
              <div className="space-y-2">
                {ingredients.map((row, idx) => {
                  const preview   = costPreview.rows[idx]
                  const product   = getProduct(row.productId)
                  const isShort   = preview?.isShort ?? false

                  return (
                    <div key={idx}>
                      {/* ── Desktop row (sm and above) ── */}
                      <div className={`hidden sm:grid grid-cols-[1fr_130px_130px_100px_36px] gap-2 items-center p-2 rounded-xl transition-colors ${isShort ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
                        {/* Product select */}
                        <div>
                          <SearchableSelect
                            options={productOptions}
                            value={row.productId}
                            onChange={(id) => updateIngredient(idx, 'productId', id)}
                            placeholder="Select product..."
                            disabled={submitting}
                          />
                          {isShort && (
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 flex items-center gap-1">
                              <AlertTriangle size={11} />
                              Requires {preview.totalDeducted.toFixed(2)}, only {preview.stock.toFixed(2)} available
                            </p>
                          )}
                        </div>

                        {/* Quantity Used */}
                        <PriceInput
                          value={row.quantityUsed}
                          onChange={(v) => updateIngredient(idx, 'quantityUsed', v)}
                          placeholder="0.00"
                          className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                          disabled={submitting}
                        />

                        {/* Waste */}
                        <div>
                          <PriceInput
                            value={row.wasteQuantity}
                            onChange={(v) => updateIngredient(idx, 'wasteQuantity', v)}
                            placeholder="0.00"
                            className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                            disabled={submitting}
                          />
                        </div>

                        {/* Total deducted (read-only) */}
                        <div className="text-sm text-gray-600 dark:text-slate-400 font-medium text-center">
                          {preview ? preview.totalDeducted.toFixed(2) : '—'}
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => removeIngredient(idx)}
                          disabled={ingredients.length === 1 || submitting}
                          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          aria-label="Remove ingredient"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* ── Mobile card (sm and below) ── */}
                      <div className={`sm:hidden p-3 rounded-xl transition-colors space-y-3 ${isShort ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
                        {/* Product select + remove button */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Product</label>
                            <SearchableSelect
                              options={productOptions}
                              value={row.productId}
                              onChange={(id) => updateIngredient(idx, 'productId', id)}
                              placeholder="Select product..."
                              disabled={submitting}
                            />
                            {isShort && (
                              <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 flex items-center gap-1">
                                <AlertTriangle size={11} />
                                Requires {preview.totalDeducted.toFixed(2)}, only {preview.stock.toFixed(2)} available
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeIngredient(idx)}
                            disabled={ingredients.length === 1 || submitting}
                            className="mt-6 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                            aria-label="Remove ingredient"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        {/* Qty Used + Waste side by side */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Qty Used</label>
                            <PriceInput
                              value={row.quantityUsed}
                              onChange={(v) => updateIngredient(idx, 'quantityUsed', v)}
                              placeholder="0.00"
                              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                              disabled={submitting}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Waste</label>
                            <PriceInput
                              value={row.wasteQuantity}
                              onChange={(v) => updateIngredient(idx, 'wasteQuantity', v)}
                              placeholder="0.00"
                              className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
                              disabled={submitting}
                            />
                          </div>
                        </div>
                        {/* Total deducted + cost hint */}
                        <div className="flex items-center justify-between text-sm px-1">
                          <span className="text-gray-500 dark:text-slate-400">Total Deducted</span>
                          <span className="text-gray-600 dark:text-slate-400 font-medium">{preview ? preview.totalDeducted.toFixed(2) : '—'}</span>
                        </div>
                      </div>

                      {/* Waste tooltip note (both desktop and mobile) */}
                      {row.productId && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 ml-2">
                          {product?.name} — cost: {Number(product?.purchasePrice ?? 0).toFixed(2)}/unit
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Add row */}
              <button
                type="button"
                onClick={addIngredient}
                disabled={submitting}
                className="mt-3 flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} />
                Add Ingredient
              </button>
            </div>

            {/* Notes */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Notes</h2>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional remarks about this assembly run"
                rows={3}
                className="w-full border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
                disabled={submitting}
              />
            </div>

            {/* Form error */}
            {formError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {formError}
              </div>
            )}

            {/* Bottom action bar */}
            <div className="flex items-center justify-end gap-3 pb-4">
              <button
                type="button"
                onClick={() => navigate('/stock-assemblies')}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? 'Running Assembly...' : 'Run Assembly'}
              </button>
            </div>
          </div>

          {/* ── Right column: Cost preview ── */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-6 sticky top-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide mb-4">Cost Preview</h2>

              {/* Ingredient cost table */}
              <div className="space-y-1 mb-4">
                {costPreview.rows.map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 dark:border-slate-700 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 dark:text-slate-300 truncate text-xs font-medium">{row.productName}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {row.totalDeducted.toFixed(2)} × {row.unitCost.toFixed(2)}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ml-2 ${row.isShort ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-600 dark:text-slate-400'}`}>
                      {row.lineCost.toFixed(2)}
                    </span>
                  </div>
                ))}

                {costPreview.rows.length === 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 italic">Add ingredients to see cost preview</p>
                )}
              </div>

              {/* Summary */}
              <div className="space-y-2 pt-3 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Total Input Cost</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">
                    {costPreview.totalInputCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-slate-400">Output Quantity</span>
                  <span className="font-semibold text-gray-800 dark:text-slate-200">
                    {parseFloat(outputQuantity) > 0 ? parseFloat(outputQuantity).toFixed(2) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-gray-700 dark:text-slate-300 font-medium">Est. Cost/Unit</span>
                  <span className="text-lg font-bold text-blue-700">
                    {parseFloat(outputQuantity) > 0 ? costPreview.costPerUnit.toFixed(4) : '—'}
                  </span>
                </div>
              </div>

              {/* Info note */}
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-3 leading-relaxed">
                Cost includes waste quantities. After submitting, the output product's purchase price will be updated to this value.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

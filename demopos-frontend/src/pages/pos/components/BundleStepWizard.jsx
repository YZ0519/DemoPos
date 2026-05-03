import { useState, useMemo, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Check, SkipForward, Package, Plus, Minus } from 'lucide-react'
import { formatCurrency } from '../../../lib/utils/currency'
import { useCurrency } from '../../../context/CurrencyContext'
import { MEDIA_HOST } from '../../../api/axios'

/**
 * BundleStepWizard — multi-step wizard for selecting products into a bundle
 * that has defined steps (hasSteps=true).
 *
 * Props:
 *   bundleDef    — the bundle object from API, including `steps[]` with nested `products[]`
 *   onComplete   — (selectedItems: Array<{ productId, productName, quantity, bundleStepId }>) => void
 *   onCancel     — () => void
 */
export default function BundleStepWizard({ bundleDef, onComplete, onCancel }) {
  const { symbol, precision } = useCurrency()

  // Steps sorted by sortOrder
  const steps = useMemo(
    () => [...(bundleDef.steps ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [bundleDef.steps]
  )

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  // stepSelections: { [stepId]: [{ productId, productName, quantity, image, stockQuantity }] }
  const [stepSelections, setStepSelections] = useState({})

  const currentStep = steps[currentStepIndex]
  const totalSteps = steps.length
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === totalSteps - 1

  // Current step's selections
  const currentSelections = stepSelections[currentStep?.id] ?? []
  const currentTotalQty = currentSelections.reduce((sum, s) => sum + s.quantity, 0)

  // Constraint checks for current step
  const meetsMin = currentTotalQty >= (currentStep?.minQuantity ?? 0)
  const atMax = currentTotalQty >= (currentStep?.maxQuantity ?? 1)
  const isSingleSelect = (currentStep?.maxQuantity ?? 1) === 1

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  /** Build instruction text for current step constraints */
  function getInstructionText() {
    if (!currentStep) return ''
    const { minQuantity, maxQuantity, isOptional } = currentStep
    if (isOptional && minQuantity === 0) {
      return `Pick up to ${maxQuantity} item${maxQuantity !== 1 ? 's' : ''} (optional)`
    }
    if (minQuantity === maxQuantity) {
      return `Pick exactly ${minQuantity} item${minQuantity !== 1 ? 's' : ''}`
    }
    return `Pick ${minQuantity} to ${maxQuantity} item${maxQuantity !== 1 ? 's' : ''}`
  }

  /** Add or select a product in the current step */
  function handleProductSelect(product) {
    const stepId = currentStep.id
    const outOfStock = (product.stockQuantity ?? 0) <= 0

    if (outOfStock) return

    setStepSelections(prev => {
      const existing = [...(prev[stepId] ?? [])]

      if (isSingleSelect) {
        // Radio behaviour: replace selection
        return {
          ...prev,
          [stepId]: [{
            productId: product.productId,
            productName: product.productName,
            quantity: 1,
            image: product.productImage,
            stockQuantity: product.stockQuantity,
          }],
        }
      }

      // Multi-select behaviour
      const idx = existing.findIndex(s => s.productId === product.productId)
      if (idx >= 0) {
        // Already selected — increment if not at max
        if (atMax) return prev
        const updated = [...existing]
        const newQty = updated[idx].quantity + 1
        if (newQty > (product.stockQuantity ?? 999)) return prev
        updated[idx] = { ...updated[idx], quantity: newQty }
        return { ...prev, [stepId]: updated }
      }

      // New selection — add if not at max
      if (atMax) return prev
      return {
        ...prev,
        [stepId]: [
          ...existing,
          {
            productId: product.productId,
            productName: product.productName,
            quantity: 1,
            image: product.productImage,
            stockQuantity: product.stockQuantity,
          },
        ],
      }
    })
  }

  /** Increment a selected product's quantity */
  function handleIncrement(productId) {
    const stepId = currentStep.id
    setStepSelections(prev => {
      const existing = [...(prev[stepId] ?? [])]
      const totalQty = existing.reduce((sum, s) => sum + s.quantity, 0)
      if (totalQty >= (currentStep?.maxQuantity ?? 1)) return prev

      const idx = existing.findIndex(s => s.productId === productId)
      if (idx < 0) return prev
      const item = existing[idx]
      if (item.quantity >= (item.stockQuantity ?? 999)) return prev

      const updated = [...existing]
      updated[idx] = { ...item, quantity: item.quantity + 1 }
      return { ...prev, [stepId]: updated }
    })
  }

  /** Decrement a selected product's quantity (remove if qty reaches 0) */
  function handleDecrement(productId) {
    const stepId = currentStep.id
    setStepSelections(prev => {
      const existing = [...(prev[stepId] ?? [])]
      const idx = existing.findIndex(s => s.productId === productId)
      if (idx < 0) return prev

      const item = existing[idx]
      if (item.quantity <= 1) {
        return { ...prev, [stepId]: existing.filter(s => s.productId !== productId) }
      }
      const updated = [...existing]
      updated[idx] = { ...item, quantity: item.quantity - 1 }
      return { ...prev, [stepId]: updated }
    })
  }

  /** Remove a product chip */
  function handleRemoveChip(productId) {
    const stepId = currentStep.id
    setStepSelections(prev => ({
      ...prev,
      [stepId]: (prev[stepId] ?? []).filter(s => s.productId !== productId),
    }))
  }

  /** Navigate to next step */
  function handleNext() {
    if (!meetsMin && !currentStep?.isOptional) return
    if (isLastStep) {
      handleAddBundle()
      return
    }
    setCurrentStepIndex(i => i + 1)
  }

  /** Navigate back */
  function handleBack() {
    if (isFirstStep) return
    setCurrentStepIndex(i => i - 1)
  }

  /** Skip optional step (clear selections, advance) */
  function handleSkip() {
    const stepId = currentStep.id
    setStepSelections(prev => ({ ...prev, [stepId]: [] }))
    if (isLastStep) {
      // Flatten and complete, skipping this step
      handleAddBundle({ skipCurrentStep: true })
      return
    }
    setCurrentStepIndex(i => i + 1)
  }

  /** Flatten all step selections and call onComplete */
  function handleAddBundle({ skipCurrentStep = false } = {}) {
    const selectedItems = Object.entries(stepSelections).flatMap(
      ([stepId, items]) => {
        if (skipCurrentStep && Number(stepId) === currentStep?.id) return []
        return items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          bundleStepId: Number(stepId),
        }))
      }
    )
    onComplete(selectedItems)
  }

  // Products for the current step
  const stepProducts = currentStep?.products ?? []

  // Determine if the next/add button should be enabled
  const canProceed = meetsMin || (currentStep?.isOptional && currentTotalQty === 0)

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bundle-wizard-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div>
            <h2 id="bundle-wizard-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {bundleDef.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {formatCurrency(bundleDef.price, symbol, precision)}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors cursor-pointer ml-4 mt-0.5"
            aria-label="Close bundle wizard"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Step indicator + progress bar ─────────────────────────────── */}
        <div className="px-5 pt-4 shrink-0">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
              Step {currentStepIndex + 1} of {totalSteps}: {currentStep?.label}
            </h3>
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {currentTotalQty} / {currentStep?.maxQuantity ?? 0} selected
            </span>
          </div>

          {/* Segmented progress bar */}
          <div className="flex gap-1 mb-2">
            {steps.map((step, idx) => {
              let colour
              if (idx < currentStepIndex) {
                // Completed step
                colour = 'bg-green-500'
              } else if (idx === currentStepIndex) {
                // Current step
                colour = 'bg-blue-500'
              } else {
                // Upcoming step
                colour = 'bg-gray-200 dark:bg-slate-600'
              }
              return (
                <div
                  key={step.id}
                  className={`h-1.5 rounded-full flex-1 transition-colors duration-200 ${colour}`}
                  title={step.label}
                />
              )
            })}
          </div>

          <p className="text-xs text-gray-500 dark:text-slate-400">
            {getInstructionText()}
          </p>
        </div>

        {/* ── Selected chips ────────────────────────────────────────────── */}
        {currentSelections.length > 0 && (
          <div className="px-5 pt-3 shrink-0">
            <div className="flex flex-wrap gap-2">
              {currentSelections.map(sel => (
                <span
                  key={sel.productId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                >
                  {sel.productName}
                  {sel.quantity > 1 && ` x${sel.quantity}`}
                  <button
                    onClick={() => handleRemoveChip(sel.productId)}
                    className="ml-0.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 cursor-pointer"
                    aria-label={`Remove ${sel.productName}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Product grid (scrollable body) ────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {stepProducts.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400 dark:text-slate-500 text-sm">
              No products available for this step
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {stepProducts.map(product => {
                const imageUrl = product.productImage ? `${MEDIA_HOST}/${product.productImage}` : null
                const outOfStock = (product.stockQuantity ?? 0) <= 0
                const selectedEntry = currentSelections.find(s => s.productId === product.productId)
                const isSelected = !!selectedEntry
                const isDisabled = outOfStock || (atMax && !isSelected)

                return (
                  <div
                    key={product.productId}
                    className={`rounded-2xl p-3 text-left w-full transition-shadow border-2 relative ${
                      outOfStock
                        ? 'bg-gray-50 dark:bg-slate-700/50 border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 shadow-md'
                          : isDisabled
                            ? 'bg-gray-50 dark:bg-slate-700/50 border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
                            : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:shadow-md cursor-pointer'
                    }`}
                  >
                    {/* Clickable area (selects product) */}
                    <button
                      onClick={() => handleProductSelect(product)}
                      disabled={isDisabled && !isSelected}
                      className="w-full text-left cursor-pointer disabled:cursor-not-allowed"
                      aria-label={outOfStock ? `${product.productName} (out of stock)` : `Select ${product.productName}`}
                      aria-pressed={isSelected}
                    >
                      <div className="aspect-square bg-gray-50 dark:bg-slate-700 rounded-xl mb-2 flex items-center justify-center overflow-hidden relative">
                        {imageUrl
                          ? <img src={imageUrl} alt={product.productName} className="w-full h-full object-cover" />
                          : <Package size={28} className="text-gray-300 dark:text-slate-500" />
                        }
                        {/* Selected check badge */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                        {/* Out of stock overlay */}
                        {outOfStock && (
                          <div className="absolute inset-0 bg-gray-900/30 rounded-xl flex items-center justify-center">
                            <span className="text-xs font-semibold text-white bg-gray-800/80 px-2 py-0.5 rounded">
                              Out of stock
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-800 dark:text-slate-200 leading-tight line-clamp-2">
                        {product.productName}
                      </p>
                      {!outOfStock && (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                          {product.stockQuantity} in stock
                        </p>
                      )}
                    </button>

                    {/* +/- controls for multi-select when item is selected */}
                    {isSelected && !isSingleSelect && (
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDecrement(product.productId) }}
                          className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-700 flex items-center justify-center text-indigo-600 dark:text-indigo-300 cursor-pointer transition-colors"
                          aria-label={`Decrease quantity of ${product.productName}`}
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 w-4 text-center">
                          {selectedEntry.quantity}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleIncrement(product.productId) }}
                          disabled={atMax || selectedEntry.quantity >= (product.stockQuantity ?? 999)}
                          className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-800 hover:bg-indigo-200 dark:hover:bg-indigo-700 flex items-center justify-center text-indigo-600 dark:text-indigo-300 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={`Increase quantity of ${product.productName}`}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    )}

                    {/* Single-select selected indicator */}
                    {isSelected && isSingleSelect && (
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-1.5 text-center">
                        Selected
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Footer navigation ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 p-5 border-t border-gray-100 dark:border-slate-700 shrink-0">
          {/* Back button */}
          {!isFirstStep && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              aria-label="Go to previous step"
            >
              <ChevronLeft size={16} />
              Back
            </button>
          )}

          {/* Cancel button (only on first step, replaces Back) */}
          {isFirstStep && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Skip button (only for optional steps) */}
          {currentStep?.isOptional && (
            <button
              onClick={handleSkip}
              className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer px-3 py-2.5"
              aria-label="Skip this optional step"
            >
              <SkipForward size={14} />
              Skip
            </button>
          )}

          {/* Next / Add Bundle button */}
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors cursor-pointer"
            aria-label={isLastStep ? 'Add bundle to cart' : 'Go to next step'}
          >
            {isLastStep ? (
              <>
                <Check size={16} />
                Add Bundle
              </>
            ) : (
              <>
                Next Step
                <ChevronRight size={16} />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}

import { useState } from 'react'
import { X } from 'lucide-react'
import { useCurrency } from '../../../context/CurrencyContext'
import { formatCurrency } from '../../../lib/utils/currency'

/**
 * POS modal shown when a product has required modifier groups.
 *
 * Props:
 *   product        — { id, name, price, discountedPrice, ... }
 *   modifierGroups — [ { id, name, isRequired, isActive, maxSelections, options: [...] } ]
 *   onConfirm      — ({ modifierNote, priceAdjustment }) => void
 *   onCancel       — () => void
 */
export default function ModifierModal({ product, modifierGroups, onConfirm, onCancel }) {
  const { symbol, precision } = useCurrency()

  // selections: { [groupId]: Set<optionId> }
  const [selections, setSelections] = useState(() => {
    const init = {}
    modifierGroups.forEach(g => { init[g.id] = new Set() })
    return init
  })

  // Only active groups are shown
  const activeGroups = modifierGroups.filter(g => g.isActive !== false)

  // Is every required group satisfied?
  const allRequiredSatisfied = activeGroups
    .filter(g => g.isRequired)
    .every(g => (selections[g.id]?.size ?? 0) > 0)

  // Compute totals
  const allSelected = activeGroups.flatMap(g => {
    const group = g
    return [...(selections[g.id] ?? [])]
      .map(optId => (group.options ?? []).find(o => o.id === optId))
      .filter(Boolean)
  })
  const totalPriceAdj = allSelected.reduce((s, o) => s + Number(o.priceAdjustment ?? 0), 0)
  const basePrice     = Number(product.discountedPrice ?? product.price ?? 0)

  function handleSelect(group, option) {
    setSelections(prev => {
      const next      = { ...prev }
      const groupSel  = new Set(prev[group.id] ?? [])

      if (group.maxSelections === 1) {
        // Radio behaviour: replace selection
        groupSel.clear()
        groupSel.add(option.id)
      } else {
        // Checkbox: toggle with max cap
        if (groupSel.has(option.id)) {
          groupSel.delete(option.id)
        } else if (groupSel.size < group.maxSelections) {
          groupSel.add(option.id)
        }
        // If at max, do nothing (option tap is a no-op)
      }
      next[group.id] = groupSel
      return next
    })
  }

  function handleConfirm() {
    // Build modifier note string
    const noteParts = activeGroups
      .map(g => {
        const chosenIds = [...(selections[g.id] ?? [])]
        if (chosenIds.length === 0) return null
        const names = chosenIds
          .map(id => (g.options ?? []).find(o => o.id === id)?.name)
          .filter(Boolean)
          .join(' / ')
        return `${g.name}: ${names}`
      })
      .filter(Boolean)
    const modifierNote = noteParts.join(', ')
    onConfirm({ modifierNote, priceAdjustment: totalPriceAdj })
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-end sm:items-center justify-center z-50 overflow-y-auto py-0 sm:py-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Customise ${product.name}`}
    >
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md sm:mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 leading-tight">
              {product.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Base price: {formatCurrency(basePrice, symbol, precision)}
              {totalPriceAdj > 0 && (
                <span className="text-green-600 dark:text-green-400 font-medium ml-1">
                  + {formatCurrency(totalPriceAdj, symbol, precision)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors cursor-pointer ml-3 flex-shrink-0"
            aria-label="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Groups */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {activeGroups.map(group => {
            const activeOptions = (group.options ?? []).filter(o => o.isActive !== false)
            const groupSel      = selections[group.id] ?? new Set()
            const atMax         = group.maxSelections > 1 && groupSel.size >= group.maxSelections
            const isRadio       = group.maxSelections === 1

            return (
              <div key={group.id}>
                {/* Group label */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                    {group.name}
                  </span>
                  {group.isRequired ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400">
                      Required
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                      Optional
                    </span>
                  )}
                  {!isRadio && (
                    <span className="text-xs text-gray-400 dark:text-slate-500">
                      (Choose up to {group.maxSelections})
                    </span>
                  )}
                </div>

                {/* Options */}
                <div className="space-y-1.5">
                  {activeOptions.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-slate-500 italic">No options available</p>
                  ) : (
                    activeOptions.map(opt => {
                      const isSelected  = groupSel.has(opt.id)
                      const isDisabled  = !isSelected && atMax
                      const priceAdj    = Number(opt.priceAdjustment ?? 0)

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => !isDisabled && handleSelect(group, opt)}
                          disabled={isDisabled}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-300'
                              : isDisabled
                                ? 'bg-gray-50 dark:bg-slate-700/50 border-gray-200 dark:border-slate-600 text-gray-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
                          }`}
                          aria-pressed={isSelected}
                          aria-label={`${opt.name}${priceAdj > 0 ? ` +${formatCurrency(priceAdj, symbol, precision)}` : ' Free'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Indicator: circle for radio, square for checkbox */}
                            <span className={`flex-shrink-0 w-4 h-4 rounded-${isRadio ? 'full' : 'sm'} border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300 dark:border-slate-500 bg-white dark:bg-slate-600'
                            }`}>
                              {isSelected && (
                                <span className="w-2 h-2 rounded-full bg-white block" />
                              )}
                            </span>
                            <span className="font-medium">{opt.name}</span>
                          </div>
                          <span className={`text-xs font-medium ${priceAdj > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-slate-500'}`}>
                            {priceAdj > 0 ? `+${formatCurrency(priceAdj, symbol, precision)}` : 'Free'}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 dark:border-slate-700 flex-shrink-0 space-y-3">
          {totalPriceAdj > 0 && (
            <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-200">
              <span>Total</span>
              <span>{formatCurrency(basePrice + totalPriceAdj, symbol, precision)}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!allRequiredSatisfied}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Add to Order
            </button>
          </div>
          {!allRequiredSatisfied && (
            <p className="text-xs text-center text-gray-400 dark:text-slate-500">
              Please select from all required groups to continue
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

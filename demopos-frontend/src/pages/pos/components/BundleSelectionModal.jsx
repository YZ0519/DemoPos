import { useState, useMemo } from 'react'
import { Search, X, Package } from 'lucide-react'
import { formatCurrency } from '../../../lib/utils/currency'
import { useCurrency } from '../../../context/CurrencyContext'
import { MEDIA_HOST } from '../../../api/axios'

/**
 * BundleSelectionModal — full-panel overlay for selecting products into a bundle.
 *
 * Props:
 *   bundleDef    — { id, name, price, minItems, maxItems }
 *   products     — already-loaded POS products array from Pos.jsx
 *   onComplete   — (selectedItems: Array<{ productId, productName, quantity }>) => void
 *   onCancel     — () => void
 */
export default function BundleSelectionModal({ bundleDef, products, onComplete, onCancel }) {
  const { symbol, precision } = useCurrency()

  // selectedItems is an array of { productId, productName, quantity }
  const [selectedItems, setSelectedItems] = useState([])
  const [search, setSearch] = useState('')

  // Total items selected (sum of quantities)
  const totalSelected = selectedItems.reduce((s, si) => s + si.quantity, 0)

  const atMax = totalSelected >= bundleDef.maxItems
  const meetsMin = totalSelected >= bundleDef.minItems

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q))
  }, [products, search])

  function addProduct(product) {
    if (atMax) return

    setSelectedItems(prev => {
      const existing = prev.find(si => si.productId === product.id)
      if (existing) {
        return prev.map(si =>
          si.productId === product.id
            ? { ...si, quantity: si.quantity + 1 }
            : si
        )
      }
      return [...prev, { productId: product.id, productName: product.name, quantity: 1 }]
    })
  }

  function removeSelectedItem(productId) {
    setSelectedItems(prev => {
      const existing = prev.find(si => si.productId === productId)
      if (!existing) return prev
      if (existing.quantity <= 1) {
        return prev.filter(si => si.productId !== productId)
      }
      return prev.map(si =>
        si.productId === productId
          ? { ...si, quantity: si.quantity - 1 }
          : si
      )
    })
  }

  function handleComplete() {
    if (!meetsMin) return
    onComplete(selectedItems)
  }

  // Counter bar colour logic
  const counterColour = meetsMin
    ? 'text-green-600 dark:text-green-400'
    : 'text-gray-600 dark:text-slate-400'

  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bundle-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 dark:border-slate-700 shrink-0">
          <div>
            <h2 id="bundle-modal-title" className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              {bundleDef.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {formatCurrency(bundleDef.price, symbol, precision)}
              {' — '}
              Select {bundleDef.minItems}
              {bundleDef.maxItems !== bundleDef.minItems ? `–${bundleDef.maxItems}` : ''}
              {' '}item{bundleDef.maxItems !== 1 ? 's' : ''} from stock
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors cursor-pointer ml-4 mt-0.5"
            aria-label="Close bundle modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Counter bar */}
        <div className="px-5 pt-3 shrink-0">
          <div className={`flex items-center justify-between text-sm font-medium ${counterColour}`}>
            <span>
              Selected: {totalSelected} / {bundleDef.maxItems}
            </span>
            {meetsMin && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Ready to complete
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-1.5 h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${meetsMin ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (totalSelected / bundleDef.maxItems) * 100)}%` }}
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedItems.length > 0 && (
          <div className="px-5 pt-3 shrink-0">
            <div className="flex flex-wrap gap-2">
              {selectedItems.map(si => (
                <span
                  key={si.productId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                >
                  {si.productName} x{si.quantity}
                  <button
                    onClick={() => removeSelectedItem(si.productId)}
                    className="ml-0.5 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 cursor-pointer"
                    aria-label={`Remove ${si.productName}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-5 pt-3 shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-slate-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
              aria-label="Search bundle products"
            />
          </div>
        </div>

        {/* Product grid — scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {filteredProducts.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-400 dark:text-slate-500 text-sm">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map(product => {
                const imageUrl = product.image ? `${MEDIA_HOST}/${product.image}` : null
                const selectedEntry = selectedItems.find(si => si.productId === product.id)
                const isDisabled = atMax && !selectedEntry

                return (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    disabled={isDisabled}
                    className={`rounded-2xl p-3 text-left w-full transition-shadow cursor-pointer border-2 ${
                      isDisabled
                        ? 'bg-gray-50 dark:bg-slate-700/50 border-gray-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
                        : selectedEntry
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 hover:shadow-md'
                          : 'bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:shadow-md'
                    }`}
                    aria-label={`Add ${product.name} to bundle`}
                    aria-pressed={!!selectedEntry}
                  >
                    <div className="aspect-square bg-gray-50 dark:bg-slate-700 rounded-xl mb-2 flex items-center justify-center overflow-hidden">
                      {imageUrl
                        ? <img src={imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        : <Package size={28} className="text-gray-300 dark:text-slate-500" />
                      }
                    </div>
                    <p className="text-xs font-medium text-gray-800 dark:text-slate-200 leading-tight line-clamp-2">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      {product.quantity} in stock
                    </p>
                    {selectedEntry && (
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mt-0.5">
                        In bundle x{selectedEntry.quantity}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100 dark:border-slate-700 shrink-0">
          <button
            onClick={onCancel}
            className="flex-1 border border-gray-200 dark:border-slate-600 rounded-xl py-2.5 text-sm text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={!meetsMin}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-2.5 text-sm font-medium transition-colors cursor-pointer"
            aria-label={`Complete bundle selection (${totalSelected} of ${bundleDef.minItems} minimum selected)`}
          >
            {meetsMin
              ? `Add Bundle (${totalSelected} item${totalSelected !== 1 ? 's' : ''})`
              : `Select ${bundleDef.minItems - totalSelected} more`}
          </button>
        </div>

      </div>
    </div>
  )
}

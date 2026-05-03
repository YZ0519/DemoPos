import React, { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { usePos, bundleParentId } from '../../context/PosContext'
import { POS_ROUTES } from '../../constants/posRoutes'
import Spinner from '../../components/Spinner'
import TableGrid from './components/TableGrid'

/**
 * Table selection screen for restaurant mode (route: /pos/tables).
 * 50/50 split — TableGrid on left, selected table preview on right.
 * Non-restaurant mode redirects to /pos (which renders the ordering screen).
 */
export default function PosTableSelect() {
  const {
    canCreate, fmt, cart,
    restaurantMode, tables, loadingTables,
    selectedTable,
    openOrderId,
    stagedItems,
    handleSelectTable, handleTakeaway, handleWalkIn,
    navigateToTableOrdering,
    setPendingSettle,
    loadingCart,
  } = usePos()

  // Non-restaurant mode should not show table select — redirect to /pos
  if (!restaurantMode && !loadingCart) return <Navigate to={POS_ROUTES.BASE} replace />

  // Permission guard
  if (!canCreate) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-700 dark:text-slate-300">Access Denied</p>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">You do not have permission to access the POS terminal.</p>
        </div>
      </div>
    )
  }

  if (loadingCart) return <Spinner />

  // Derived values for the selected-table preview panel — memoized to avoid
  // rebuilding on every render when cart is large (50+ items).
  const panelActiveItems = useMemo(
    () => cart.filter(i => !i.isVoided && !bundleParentId(i)),
    [cart],
  )
  const panelSubTotal     = useMemo(
    () => Math.round(panelActiveItems.reduce((s, i) => s + Number(i.rowTotal ?? i.total ?? 0), 0) * 100) / 100,
    [panelActiveItems],
  )
  const panelTotal        = panelSubTotal
  const hasNonVoidedItems = panelActiveItems.length > 0
  const displayOccupied   = hasNonVoidedItems

  const bundleChildrenMap = useMemo(() => cart.reduce((map, si) => {
    const pid = bundleParentId(si)
    if (pid != null) {
      if (!map.has(pid)) map.set(pid, [])
      map.get(pid).push(si)
    }
    return map
  }, new Map()), [cart])

  return (
    <div className="flex flex-col sm:flex-row h-full gap-4">
      {/* pb-80 on mobile so bottom sheet doesn't cover table cards when open */}
      <div className={`w-full sm:w-1/2 overflow-y-auto sm:pb-0 ${selectedTable ? 'pb-80' : 'pb-4'}`}>
        <TableGrid
          tables={tables}
          onSelectTable={handleSelectTable}
          onTakeaway={handleTakeaway}
          onWalkIn={handleWalkIn}
          loadingTables={loadingTables}
        />
      </div>

      {/* Mobile bottom sheet: shown when a table is selected */}
      {selectedTable && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 flex flex-col max-h-72 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-xl rounded-t-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 shrink-0">
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                  Table T{selectedTable.number}{selectedTable.label ? ` \u2014 ${selectedTable.label}` : ''}
                </p>
                <span className={`text-xs font-medium ${displayOccupied ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {displayOccupied ? 'Occupied' : 'Available'}
                </span>
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
              {cart.length === 0 ? (
                <p className="text-xs text-center text-gray-400 dark:text-slate-500 py-3">No items yet</p>
              ) : (
                cart.map(item => {
                  if (bundleParentId(item)) return null
                  const isVoided    = item.isVoided === true
                  const kitchenSent = !!item.kitchenSentAt
                  const bundleSubItems = bundleChildrenMap.get(item.id) ?? []
                  return (
                    <React.Fragment key={item.id}>
                      <div className={`flex items-center gap-2 text-xs ${isVoided ? 'opacity-40' : ''}`}>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isVoided    ? 'bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400'
                          : kitchenSent ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                          : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                        }`}>
                          {isVoided ? 'VOID' : kitchenSent ? 'SENT' : 'NEW'}
                        </span>
                        <span className={`flex-1 leading-tight ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'}`}>
                          {item.productName}{item.isBundleHeader ? '' : ` \u00d7${item.quantity}`}
                          {item.modifierNote && (
                            <span className="text-gray-400 italic ml-1">({item.modifierNote})</span>
                          )}
                        </span>
                        {!item.isBundleHeader && (
                          <span className="shrink-0 text-gray-500 dark:text-slate-400">
                            {fmt(Number(item.rowTotal ?? item.total ?? 0))}
                          </span>
                        )}
                      </div>
                      {bundleSubItems.map(si => (
                        <div key={si.id} className="flex items-center gap-1 ml-5 text-[10px] text-gray-400 dark:text-slate-500">
                          <span className="text-indigo-400" aria-hidden="true">{'\u203a'}</span>
                          <span>{si.productName}{si.quantity > 1 ? ` \u00d7${si.quantity}` : ''}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  )
                })
              )}
            </div>

            {/* Totals */}
            {panelActiveItems.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 shrink-0 space-y-0.5">
                <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                  <span>Sub Total</span><span>{fmt(panelSubTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-100">
                  <span>Total</span><span>{fmt(panelTotal)}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 flex gap-2 shrink-0">
              {hasNonVoidedItems && (
                <button
                  onClick={() => { setPendingSettle(true); navigateToTableOrdering(selectedTable.id) }}
                  className="flex-1 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Settle Bill
                </button>
              )}
              <button
                onClick={() => navigateToTableOrdering(selectedTable.id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Add Items
              </button>
            </div>
        </div>
      )}

      {/* Desktop: right panel — selected table preview */}
      <div className="hidden sm:flex sm:w-1/2 border border-gray-200 dark:border-slate-700 rounded-2xl flex-col overflow-hidden">
        {!selectedTable ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400 dark:text-slate-500">Select a table to see its order</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 shrink-0">
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">
                  Table T{selectedTable.number}{selectedTable.label ? ` \u2014 ${selectedTable.label}` : ''}
                </h2>
                <span className={`text-xs font-medium ${displayOccupied ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                  {displayOccupied ? 'Occupied' : 'Available'}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
              {cart.length === 0 ? (
                <p className="text-sm text-center text-gray-400 dark:text-slate-500 py-6">No items yet</p>
              ) : (
                cart.map(item => {
                  if (bundleParentId(item)) return null
                  const isVoided    = item.isVoided === true
                  const kitchenSent = !!item.kitchenSentAt
                  const bundleSubItems = bundleChildrenMap.get(item.id) ?? []
                  return (
                    <React.Fragment key={item.id}>
                      <div className={`flex items-center gap-2 text-sm ${isVoided ? 'opacity-40' : ''}`}>
                        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isVoided ? 'bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400'
                            : kitchenSent ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                            : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                        }`}>
                          {isVoided ? 'VOID' : kitchenSent ? 'SENT' : 'NEW'}
                        </span>
                        <span title={item.productName}
                          className={`flex-1 break-words leading-tight ${isVoided ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-700 dark:text-slate-300'}`}>
                          {item.productName}{item.isBundleHeader ? '' : ` \u00d7${item.quantity}`}
                          {item.modifierNote && (
                            <span className="text-gray-400 dark:text-slate-500 italic text-xs ml-1">({item.modifierNote})</span>
                          )}
                        </span>
                      </div>
                      {bundleSubItems.map(si => (
                        <div key={si.id} className="flex items-center gap-1 ml-5 text-xs text-gray-400 dark:text-slate-500">
                          <span className="text-indigo-400" aria-hidden="true">{'\u203a'}</span>
                          <span>{si.productName}{si.quantity > 1 ? ` \u00d7${si.quantity}` : ''}</span>
                        </div>
                      ))}
                    </React.Fragment>
                  )
                })
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 shrink-0 space-y-1">
                <div className="flex justify-between text-sm text-gray-600 dark:text-slate-400">
                  <span>Sub Total</span><span>{fmt(panelSubTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold text-gray-800 dark:text-slate-200">
                  <span>Total</span><span>{fmt(panelTotal)}</span>
                </div>
              </div>
            )}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-700 space-y-2 shrink-0">
              <button onClick={() => navigateToTableOrdering(selectedTable.id)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer">
                Add Items
              </button>
              {hasNonVoidedItems && (
                <button onClick={() => { setPendingSettle(true); navigateToTableOrdering(selectedTable.id) }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer">
                  Settle Bill
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

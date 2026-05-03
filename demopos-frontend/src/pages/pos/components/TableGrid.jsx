import { ShoppingBag, UserCheck } from 'lucide-react'
import { TABLE_STATUS } from '../../../constants/tableStatuses'

/**
 * Table selection grid for restaurant mode.
 * Walk-In, Takeaway, and all table cards share one unified grid-cols-3 grid.
 */
export default function TableGrid({ tables, onSelectTable, onTakeaway, onWalkIn, loadingTables }) {
  if (loadingTables) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const activeTables  = tables.filter(t => t.isActive)
  const availableCount = activeTables.filter(t => t.status !== TABLE_STATUS.OCCUPIED).length
  const occupiedCount  = activeTables.length - availableCount

  return (
    <div className="px-3 py-4 sm:px-5 sm:py-5 space-y-4 bg-gray-50 dark:bg-slate-900">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
          Select Table
          <span className="ml-2 text-sm font-normal text-gray-400 dark:text-slate-500">
            ({activeTables.length} {activeTables.length === 1 ? 'table' : 'tables'})
          </span>
        </h2>
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden="true" />
            Available ({availableCount})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden="true" />
            Occupied ({occupiedCount})
          </span>
        </div>
      </div>

      {/* ── Walk-In + Takeaway (full-width stacked) ──────────────────────── */}
      <button
        onClick={onWalkIn}
        className="w-full flex items-center justify-center gap-3 min-h-[56px] border-2 border-dashed border-green-300 dark:border-green-700 rounded-xl px-4 py-3 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 active:bg-green-100 transition-colors cursor-pointer"
      >
        <UserCheck size={20} strokeWidth={2} className="shrink-0" />
        <span className="text-sm font-medium">Walk-In Customer</span>
      </button>

      <button
        onClick={onTakeaway}
        className="w-full flex items-center justify-center gap-3 min-h-[56px] border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl px-4 py-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 transition-colors cursor-pointer"
      >
        <ShoppingBag size={20} strokeWidth={2} className="shrink-0" />
        <span className="text-sm font-medium">Takeaway Order</span>
      </button>

      {/* ── Table cards grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {activeTables.map(table => {
          const isOccupied = table.status === TABLE_STATUS.OCCUPIED
          return (
            <button
              key={table.id}
              onClick={() => onSelectTable(table)}
              className={`flex flex-col rounded-xl border-2 min-h-[80px] px-2.5 py-3 text-left transition-all active:scale-95 cursor-pointer ${
                isOccupied
                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                  : 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600 hover:bg-green-100 dark:hover:bg-green-900/40'
              }`}
            >
              <p className={`text-xl sm:text-2xl font-bold leading-tight ${
                isOccupied ? 'text-amber-700 dark:text-amber-400' : 'text-green-700 dark:text-green-400'
              }`}>
                T{table.number}
              </p>
              {table.label && (
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate w-full">
                  {table.label}
                </p>
              )}
              <div className="mt-1.5 flex items-center justify-between gap-1 w-full">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                  isOccupied
                    ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200'
                    : 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                }`}>
                  {isOccupied ? 'Occupied' : 'Available'}
                </span>
                <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap">
                  {table.capacity}s
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {activeTables.length === 0 && (
        <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">
          No tables configured. Add tables in Restaurant {'\u2192'} Tables.
        </p>
      )}
    </div>
  )
}

import { Outlet } from 'react-router-dom'
import { PosProvider } from '../../context/PosContext'

/**
 * Shared layout for all POS sub-routes.
 * Wraps children in PosProvider so cart / table / restaurant-mode state
 * persists across route transitions (e.g. /pos/tables → /pos/table/3).
 *
 * PosInvoice and KitchenTicket are NOT nested under this layout — they
 * are independent routes that do not use PosProvider.
 */
export default function PosLayout() {
  return (
    <PosProvider>
      <Outlet />
    </PosProvider>
  )
}

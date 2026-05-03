import { Navigate } from 'react-router-dom'
import { usePos } from '../../context/PosContext'
import Spinner from '../../components/Spinner'
import PosOrdering from './PosOrdering'

/**
 * Index route for /pos.
 * - Restaurant mode: redirect to /pos/tables (table selection screen).
 *   PosContext.init() also navigates there as soon as restaurant_mode resolves;
 *   this Navigate is a defensive fallback.
 * - Non-restaurant mode: render PosOrdering directly (walk-in ordering).
 */
export default function PosIndex() {
  const { restaurantMode, loadingCart } = usePos()

  if (loadingCart) return <Spinner />
  if (restaurantMode) return <Navigate to="/pos/tables" replace />
  return <PosOrdering />
}

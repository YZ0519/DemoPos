import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute() {
  const { user } = useAuth()
  // Token is now an httpOnly cookie — not readable by JS.
  // We rely on the user object in localStorage as the client-side auth signal.
  // AuthContext initialises from localStorage synchronously, so this check is
  // reliable on first render without any async round-trip.
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

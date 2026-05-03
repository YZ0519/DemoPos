import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PublicRoute() {
  const { user } = useAuth()
  // Token is now an httpOnly cookie — not readable by JS.
  // Use the user object from AuthContext (seeded from localStorage) as the
  // client-side "is logged in" signal. Mirrors the PrivateRoute approach.
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />
}

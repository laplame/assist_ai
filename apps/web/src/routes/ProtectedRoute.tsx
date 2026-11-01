import { Navigate, Outlet } from 'react-router-dom'
import { useSesion } from '../app/sesion.ts'

export function ProtectedRoute() {
  const { sesion } = useSesion()
  if (!sesion) return <Navigate to="/login" replace />
  return <Outlet />
}

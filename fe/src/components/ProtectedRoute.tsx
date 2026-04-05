import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user, accessToken } = useAuthStore()

  console.log('ProtectedRoute check:', { isAuthenticated, hasUser: !!user, hasToken: !!accessToken })

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}


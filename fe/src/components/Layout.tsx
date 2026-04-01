import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Briefcase, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { authService } from '../services/authService'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { isAuthenticated } = useAuthStore()

  const handleLogout = async () => {
    await authService.logout()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Briefcase className="w-8 h-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Job Portal</span>
            </Link>

            <div className="flex items-center space-x-4">
              <Link
                to="/jobs"
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  location.pathname === '/jobs'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Tim viec
              </Link>

              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      location.pathname === '/dashboard'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/employer/jobs"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      location.pathname === '/employer/jobs'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Tin tuyen dung
                  </Link>
                  <Link
                    to="/employer/jobs/create"
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      location.pathname === '/employer/jobs/create'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Dang tin
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Dang xuat</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    location.pathname === '/login'
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Dang nhap
                </Link>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-2">
            <Briefcase className="w-6 h-6 text-primary-600" />
            <span className="text-lg font-bold text-gray-900">Job Portal</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

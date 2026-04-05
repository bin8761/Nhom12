import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, RotateCcw } from 'lucide-react'
import Button from '../components/Button'
import Input from '../components/Input'
import { authService } from '../services/authService'

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || ''
  
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (!email) {
      navigate('/register')
    }
  }, [email, navigate])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await authService.verifyEmail({ email, code })
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Mã xác minh không đúng. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setIsResending(true)
    setCountdown(60)

    try {
      await authService.resendVerification(email)
      // Thông báo thành công
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại email. Vui lòng thử lại.')
      setCountdown(0)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Mail className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Xác Minh Email</h2>
          <p className="mt-2 text-sm text-gray-600">
            Chúng tôi đã gửi mã xác minh 6 số đến
          </p>
          <p className="font-medium text-gray-900">{email}</p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <Input
                label="Mã xác minh"
                type="text"
                placeholder="123456"
                value={code}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setCode(value)
                }}
                maxLength={6}
                required
                className="text-center text-2xl tracking-widest"
              />
            </div>

            <div>
              <Button type="submit" isLoading={isLoading} className="w-full">
                Xác Minh
              </Button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || isResending}
                className="inline-flex items-center text-primary-600 hover:text-primary-700 disabled:text-gray-400"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {countdown > 0 ? `Gửi lại sau ${countdown}s` : 'Gửi lại mã'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


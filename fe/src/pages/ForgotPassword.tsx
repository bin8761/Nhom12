import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import Button from '../components/Button'
import Input from '../components/Input'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/forgot-password', { email })
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Gửi yêu cầu thất bại')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-8 rounded-lg">
            <h2 className="text-2xl font-bold mb-4">Kiểm tra email của bạn</h2>
            <p className="mb-6">
              Chúng tôi đã gửi mã đặt lại mật khẩu đến email {email}
            </p>
            <Link to="/reset-password" className="text-primary-600 hover:text-primary-700 font-medium">
              Nhập mã đặt lại mật khẩu →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Quên Mật Khẩu</h2>
          <p className="mt-2 text-sm text-gray-600">
            Nhập email để nhận mã đặt lại mật khẩu
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" isLoading={loading} className="w-full">
              Gửi mã
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-primary-600 hover:text-primary-700">
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

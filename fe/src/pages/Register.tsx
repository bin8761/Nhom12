import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import Button from '../components/Button'
import Input from '../components/Input'
import { authService } from '../services/authService'

export default function Register() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'candidate' as 'candidate' | 'employer',
    fullName: '',
    dateOfBirth: '',
    address: '',
    phoneNumber: '',
    companyName: '',
    companyAddress: '',
    companyWebsite: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }

    if (formData.password.length < 10) {
      setError('Mật khẩu phải có ít nhất 10 ký tự')
      return
    }

    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(formData.password)) {
      setError('Mật khẩu phải chứa cả chữ và số')
      return
    }

    if (!/^(\+?84|0)(\d{9})$/.test(formData.phoneNumber)) {
      setError('Số điện thoại không hợp lệ (VD: 0912345678)')
      return
    }

    setIsLoading(true)

    try {
      const registerData: any = {
        email: formData.email,
        password: formData.password,
        role: formData.role,
        fullName: formData.role === 'candidate' ? formData.fullName : formData.companyName,
        phoneNumber: formData.phoneNumber,
        address: formData.role === 'candidate' ? formData.address : formData.companyAddress,
      }

      // Add dateOfBirth only for candidate
      if (formData.role === 'candidate' && formData.dateOfBirth) {
        const [year, month, day] = formData.dateOfBirth.split('-')
        registerData.dateOfBirth = `${day}/${month}/${year}`
      } else if (formData.role === 'employer') {
        // Employer doesn't need dateOfBirth, use a default value
        registerData.dateOfBirth = '01/01/2000'
      }

      // Add company info for employer
      if (formData.role === 'employer') {
        registerData.companyName = formData.companyName
        if (formData.companyWebsite) {
          registerData.companyWebsite = formData.companyWebsite
        }
      }

      await authService.register(registerData)
      navigate('/verify-email', { state: { email: formData.email } })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <UserPlus className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Tạo Tài Khoản</h2>
          <p className="mt-2 text-sm text-gray-600">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
              Đăng nhập ngay
            </Link>
          </p>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bạn muốn đăng ký với vai trò:
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'candidate' })}
                  className={`flex-1 px-4 py-3 border rounded-lg font-medium transition-colors ${
                    formData.role === 'candidate'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Ứng viên
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, role: 'employer' })}
                  className={`flex-1 px-4 py-3 border rounded-lg font-medium transition-colors ${
                    formData.role === 'employer'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Nhà tuyển dụng
                </button>
              </div>
            </div>

            {formData.role === 'candidate' && (
              <Input
                label="Họ và tên"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />
            )}

            {formData.role === 'employer' && (
              <Input
                label="Tên công ty"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />
            )}

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label="Số điện thoại"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              required
            />

            <Input
              label={formData.role === 'candidate' ? 'Địa chỉ' : 'Địa chỉ công ty'}
              value={formData.role === 'candidate' ? formData.address : formData.companyAddress}
              onChange={(e) => setFormData({ 
                ...formData, 
                [formData.role === 'candidate' ? 'address' : 'companyAddress']: e.target.value 
              })}
              required
            />

            {formData.role === 'employer' && (
              <Input
                label="Website công ty (không bắt buộc)"
                type="url"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
              />
            )}

            {formData.role === 'candidate' && (
              <Input
                label="Ngày sinh"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                required
              />
            )}

            <Input
              label="Mật khẩu (ít nhất 10 ký tự, có chữ và số)"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />

            <Input
              label="Xác nhận mật khẩu"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
            />

            <div>
              <Button type="submit" isLoading={isLoading} className="w-full">
                Đăng Ký
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}


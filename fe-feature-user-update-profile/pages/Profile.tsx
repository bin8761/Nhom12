/**
 * BRANCH: feature/user-update-profile
 * Feature: Cập nhật hồ sơ người dùng
 * Cho phép candidate và employer cập nhật thông tin cá nhân
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { profileService } from '../services/profileService'
import type { UserProfile } from '../services/profileService'
import { jobService } from '../services/jobService'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'
import Input from '../components/Input'

export default function Profile() {
  const { user } = useAuthStore()
  const [, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    location: '',
    companyName: '',
    companyIndustry: '',
    companyLocation: '',
    companyWebsite: '',
  })

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const response = await profileService.getMyProfile()
      const profileData = response.data.profile || response.data
      setProfile(profileData)
      
      let dateOfBirthValue = ''
      if (profileData.dateOfBirth) {
        try {
          if (/^\d{4}-\d{2}-\d{2}$/.test(profileData.dateOfBirth)) {
            dateOfBirthValue = profileData.dateOfBirth
          } else {
            const date = new Date(profileData.dateOfBirth)
            const year = date.getUTCFullYear()
            const month = String(date.getUTCMonth() + 1).padStart(2, '0')
            const day = String(date.getUTCDate()).padStart(2, '0')
            dateOfBirthValue = `${year}-${month}-${day}`
          }
        } catch (e) {
          console.error('Error parsing dateOfBirth:', e)
        }
      }
      
      setFormData({
        fullName: profileData.fullName || '',
        phoneNumber: profileData.phoneNumber || profileData.contactPhone || '',
        dateOfBirth: dateOfBirthValue,
        location: profileData.location || profileData.headquartersLocation || '',
        companyName: profileData.companyName || '',
        companyIndustry: profileData.industry || '',
        companyLocation: profileData.headquartersLocation || '',
        companyWebsite: profileData.companyWebsite || '',
      })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải thông tin profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const updateData: any = {}

      let dateOfBirthISO = undefined
      if (formData.dateOfBirth) {
        const [year, month, day] = formData.dateOfBirth.split('-')
        dateOfBirthISO = `${year}-${month}-${day}T12:00:00.000Z`
      }

      if (user?.role === 'candidate') {
        if (formData.fullName) updateData.fullName = formData.fullName
        if (formData.phoneNumber) updateData.phoneNumber = formData.phoneNumber
        if (dateOfBirthISO) updateData.dateOfBirth = dateOfBirthISO
        if (formData.location) updateData.location = formData.location
      } else if (user?.role === 'employer') {
        if (formData.fullName) updateData.fullName = formData.fullName
        if (formData.companyName) updateData.companyName = formData.companyName
        if (formData.phoneNumber) updateData.contactPhone = formData.phoneNumber
        if (formData.companyIndustry) updateData.industry = formData.companyIndustry
        if (formData.companyLocation) updateData.headquartersLocation = formData.companyLocation
        if (formData.companyWebsite) updateData.companyWebsite = formData.companyWebsite
      }

      await profileService.updateMyProfile(updateData)
      
      if (user?.role === 'candidate' && formData.location) {
        try {
          await jobService.updateMyLocation({
            addressLine: formData.location
          })
        } catch (err: any) {
          console.error('Failed to sync location:', err)
        }
      }
      
      setSuccess('Cập nhật profile thành công!')
      setTimeout(() => setSuccess(''), 5000)
      loadProfile()
    } catch (err: any) {
      console.error('Update error:', err)
      setError(err.response?.data?.message || 'Cập nhật profile thất bại')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'candidate':
        return 'Ứng viên'
      case 'employer':
        return 'Nhà tuyển dụng'
      case 'admin':
        return 'Quản trị viên'
      default:
        return role
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Thông Tin Cá Nhân</h1>
        <Link
          to="/change-password"
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          Đổi mật khẩu
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500">Vai trò</p>
            <p className="text-lg font-semibold text-gray-900 truncate">{user ? getRoleLabel(user.role) : '-'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">Email</p>
            <p className="text-base font-semibold text-gray-900 whitespace-nowrap overflow-x-auto">{user?.email || '-'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500">Trạng thái</p>
            <p className="text-lg font-semibold text-green-600">Đã xác minh</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {success}
            </div>
          )}

          {user?.role === 'candidate' && (
            <>
              <Input
                label="Họ và tên"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                required
              />

              <Input
                label="Số điện thoại"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />

              <Input
                label="Ngày sinh"
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />

              <Input
                label="Địa chỉ"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="VD: Quận 1, TP. Hồ Chí Minh"
              />
            </>
          )}

          {user?.role === 'employer' && (
            <>
              <Input
                label="Tên công ty"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                required
              />

              <Input
                label="Số điện thoại"
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />

              <Input
                label="Lĩnh vực"
                value={formData.companyIndustry}
                onChange={(e) => setFormData({ ...formData, companyIndustry: e.target.value })}
              />

              <Input
                label="Địa chỉ công ty"
                value={formData.companyLocation}
                onChange={(e) => setFormData({ ...formData, companyLocation: e.target.value })}
              />

              <Input
                label="Website"
                type="url"
                value={formData.companyWebsite}
                onChange={(e) => setFormData({ ...formData, companyWebsite: e.target.value })}
              />
            </>
          )}

          <Button type="submit" isLoading={saving} className="w-full">
            Cập nhật
          </Button>
        </form>
      </div>
    </div>
  )
}

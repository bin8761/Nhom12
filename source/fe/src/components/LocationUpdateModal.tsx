import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Button from './Button'
import { locationService } from '../services/locationService'
import { jobService } from '../services/jobService'

interface LocationUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function LocationUpdateModal({ isOpen, onClose, onSuccess }: LocationUpdateModalProps) {
  const [provinces, setProvinces] = useState<any[]>([])
  const [selectedProvince, setSelectedProvince] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadProvinces()
    }
  }, [isOpen])

  const loadProvinces = async () => {
    try {
      const response = await locationService.getProvinces()
      setProvinces(response.data || [])
    } catch (err) {
      console.error('Failed to load provinces:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedProvince) {
      setError('Vui lòng chọn tỉnh/thành phố')
      return
    }

    try {
      setLoading(true)
      const province = provinces.find(p => p.code === selectedProvince)
      const addressLine = province?.name || ''
      
      await jobService.updateMyLocation({
        addressLine,
        provinceCode: selectedProvince,
      })
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Cập nhật địa chỉ thất bại')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Cập Nhật Địa Chỉ Ưa Thích</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tỉnh/Thành phố <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">-- Chọn tỉnh/thành --</option>
              {provinces.map((province) => (
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>



          <div className="pt-4 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              isLoading={loading}
              className="flex-1"
            >
              Cập nhật
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

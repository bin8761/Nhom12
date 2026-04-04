/**
 * BRANCH: feature/job-update-delete
 * Location Select Component
 */

import { useEffect, useState } from 'react'
import { locationService } from '../services/locationService'

interface LocationSelectSimpleProps {
  provinceCode: string
  onProvinceChange: (code: string, name: string) => void
  required?: boolean
}

export default function LocationSelectSimple({
  provinceCode,
  onProvinceChange,
  required = false,
}: LocationSelectSimpleProps) {
  const [provinces, setProvinces] = useState<any[]>([])

  useEffect(() => {
    locationService.getProvinces().then((res) => {
      setProvinces(res.data)
    })
  }, [])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Tỉnh/Thành phố {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={provinceCode}
        onChange={(e) => {
          const code = e.target.value
          const prov = provinces.find((p) => p.code === code)
          onProvinceChange(code, prov?.name || '')
        }}
        required={required}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
      >
        <option value="">-- Chọn tỉnh/thành phố --</option>
        {provinces.map((p) => (
          <option key={p.code} value={p.code}>{p.name}</option>
        ))}
      </select>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { locationService } from '../services/locationService'

interface Province {
  code: string
  name: string
}

interface LocationSelectSimpleProps {
  provinceCode: string
  onProvinceChange: (code: string, name: string) => void
  required?: boolean
  label?: string
  hideLabel?: boolean
  className?: string
}

export default function LocationSelectSimple({
  provinceCode,
  onProvinceChange,
  required = false,
  label = 'Tinh/Thanh pho',
  hideLabel = false,
  className = '',
}: LocationSelectSimpleProps) {
  const [provinces, setProvinces] = useState<Province[]>([])

  useEffect(() => {
    locationService.getProvinces().then((res) => {
      setProvinces(res.data)
    })
  }, [])

  return (
    <div>
      {!hideLabel && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <select
        value={provinceCode}
        onChange={(e) => {
          const code = e.target.value
          const province = provinces.find((item) => item.code === code)
          onProvinceChange(code, province?.name || '')
        }}
        required={required}
        className={`w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${className}`}
      >
        <option value="">-- Chon tinh/thanh pho --</option>
        {provinces.map((province) => (
          <option key={province.code} value={province.code}>
            {province.name}
          </option>
        ))}
      </select>
    </div>
  )
}

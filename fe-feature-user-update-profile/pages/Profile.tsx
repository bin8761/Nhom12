/**
 * BRANCH: feature/user-update-profile
 * Feature: Cap nhat ho so nguoi dung
 * Cho phep candidate va employer cap nhat thong tin ca nhan
 */

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/Button'
import Input from '../components/Input'
import { profileService } from '../services/profileService'
import type { UserProfile } from '../services/profileService'
import { jobService } from '../services/jobService'
import { useAuthStore } from '../store/authStore'

const initialFormState = {
  fullName: '',
  phoneNumber: '',
  dateOfBirth: '',
  location: '',
  companyName: '',
  companyIndustry: '',
  companyLocation: '',
  companyWebsite: '',
}

type ProfileField = {
  name: keyof typeof initialFormState
  label: string
  type?: string
  placeholder?: string
  required?: boolean
}

const candidateFields: ProfileField[] = [
  { name: 'fullName', label: 'Ho va ten', required: true },
  { name: 'phoneNumber', label: 'So dien thoai', type: 'tel' },
  { name: 'dateOfBirth', label: 'Ngay sinh', type: 'date' },
  {
    name: 'location',
    label: 'Dia chi',
    placeholder: 'VD: Quan 1, TP. Ho Chi Minh',
  },
]

const employerFields: ProfileField[] = [
  { name: 'companyName', label: 'Ten cong ty', required: true },
  { name: 'phoneNumber', label: 'So dien thoai', type: 'tel' },
  { name: 'companyIndustry', label: 'Linh vuc' },
  { name: 'companyLocation', label: 'Dia chi cong ty' },
  { name: 'companyWebsite', label: 'Website', type: 'url' },
]

function UserIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5a7.5 7.5 0 0115 0" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 7.5v9A2.25 2.25 0 0119.5 18.75h-15A2.25 2.25 0 012.25 16.5v-9A2.25 2.25 0 014.5 5.25h15A2.25 2.25 0 0121.75 7.5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 6.75 7.928 5.285a2 2 0 002.144 0L21 6.75" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V7.875a4.5 4.5 0 10-9 0V10.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 10.5h13.5v8.25a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5V10.5Z" />
    </svg>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  valueClassName = '',
}: {
  label: string
  value: string
  icon: ReactNode
  accent: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-[28px] border border-sky-100 bg-white/92 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-2 break-words text-lg font-semibold text-slate-900 ${valueClassName}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuthStore()
  const [, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState(initialFormState)

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
        } catch (parseError) {
          console.error('Error parsing dateOfBirth:', parseError)
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
      setError(err.response?.data?.message || 'Khong the tai thong tin profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (name: keyof typeof initialFormState, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      const updateData: Record<string, string> = {}

      let dateOfBirthISO: string | undefined
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
            addressLine: formData.location,
          })
        } catch (syncError) {
          console.error('Failed to sync location:', syncError)
        }
      }

      setSuccess('Cap nhat profile thanh cong!')
      setTimeout(() => setSuccess(''), 5000)
      loadProfile()
    } catch (err: any) {
      console.error('Update error:', err)
      setError(err.response?.data?.message || 'Cap nhat profile that bai')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'candidate':
        return 'Ung vien'
      case 'employer':
        return 'Nha tuyen dung'
      case 'admin':
        return 'Quan tri vien'
      default:
        return role
    }
  }

  const activeFields = user?.role === 'employer' ? employerFields : candidateFields

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[radial-gradient(circle_at_top,#dff5ff_0%,#f7fbff_45%,#eef2ff_100%)] px-4">
        <div className="rounded-[32px] border border-white/70 bg-white/85 px-10 py-12 text-center shadow-[0_24px_80px_rgba(14,116,144,0.18)] backdrop-blur">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-sky-100 border-t-sky-500" />
          <p className="mt-4 text-base font-medium text-slate-600">Dang tai thong tin ho so...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e0f7ff_0%,#f8fbff_42%,#eef4ff_100%)] pb-10">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[34px] border border-white/60 bg-white/70 shadow-[0_28px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="border-b border-sky-100 bg-gradient-to-r from-cyan-200 via-sky-100 to-blue-50 px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-200">
                  <span className="text-lg font-semibold">J</span>
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
                    Job Finder
                  </p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                    Cap Nhat Ho So
                  </h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-700">
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Tim viec</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Goi y viec lam</span>
                <span className="rounded-full bg-white/80 px-4 py-2 shadow-sm">Dashboard</span>
                <span className="rounded-full bg-slate-900 px-4 py-2 text-white shadow-sm">Quan ly CV</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Vai tro"
                value={user ? getRoleLabel(user.role) : '-'}
                icon={<UserIcon />}
                accent="bg-sky-100 text-sky-700"
              />
              <SummaryCard
                label="Email"
                value={user?.email || '-'}
                icon={<MailIcon />}
                accent="bg-cyan-100 text-cyan-700"
                valueClassName="text-base"
              />
              <SummaryCard
                label="Trang thai"
                value="Da xac minh"
                icon={<CheckIcon />}
                accent="bg-emerald-100 text-emerald-700"
                valueClassName="text-emerald-600"
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="border-b border-slate-200 bg-gradient-to-r from-sky-600 via-blue-500 to-cyan-400 px-5 py-4 sm:px-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.18em] text-sky-100">
                      Ho so tai khoan
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-white">Thong tin ca nhan</h2>
                  </div>

                  <Link
                    to="/change-password"
                    className="inline-flex items-center gap-2 self-start rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-white"
                  >
                    <LockIcon />
                    Doi mat khau
                  </Link>
                </div>
              </div>

              <div className="grid gap-8 px-5 py-6 sm:px-8 lg:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="rounded-[26px] border border-sky-100 bg-[linear-gradient(180deg,#f8fdff_0%,#eef7ff_100%)] p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-slate-900 text-white shadow-[0_18px_35px_rgba(15,23,42,0.25)]">
                      <span className="text-3xl font-semibold">
                        {(user?.email?.[0] || 'U').toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-semibold text-slate-900">
                        {user?.role === 'employer'
                          ? formData.companyName || 'Ten cong ty'
                          : formData.fullName || 'Ho va ten'}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-500">{user?.email || 'email@example.com'}</p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Vai tro</p>
                      <p className="mt-2 text-base font-medium text-slate-900">
                        {user ? getRoleLabel(user.role) : '-'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Email</p>
                      <p className="mt-2 break-all text-base font-medium text-slate-900">{user?.email || '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
                        Trang thai
                      </p>
                      <p className="mt-2 text-base font-semibold text-emerald-600">Da xac minh</p>
                    </div>
                  </div>
                </aside>

                <div>
                  {(error || success) && (
                    <div className="mb-6 space-y-3">
                      {error && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                          {error}
                        </div>
                      )}
                      {success && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                          {success}
                        </div>
                      )}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-5 md:grid-cols-2">
                      {activeFields.map((field) => (
                        <Input
                          key={field.name}
                          label={field.label}
                          type={field.type}
                          required={field.required}
                          placeholder={field.placeholder}
                          value={formData[field.name]}
                          onChange={(e) => handleChange(field.name, e.target.value)}
                          className="rounded-2xl border-slate-200 bg-slate-50/80 px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                        />
                      ))}
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-500">
                        Kiem tra ky thong tin truoc khi luu de tranh sai lech du lieu.
                      </p>
                      <Button
                        type="submit"
                        isLoading={saving}
                        className="w-full rounded-full bg-slate-900 px-8 py-3.5 text-white hover:bg-slate-800 sm:w-auto"
                      >
                        Cap nhat
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

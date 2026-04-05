import type { ChangeEvent, FormEvent, ReactNode, SelectHTMLAttributes } from 'react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import Input from '../components/Input'
import LocationSelectSimple from '../components/LocationSelectSimple'
import { jobService } from '../services/jobService'

type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT'
type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR'

const jobTypeOptions: Array<{ value: JobType; label: string }> = [
  { value: 'FULL_TIME', label: 'Toan thoi gian' },
  { value: 'PART_TIME', label: 'Ban thoi gian' },
  { value: 'CONTRACT', label: 'Hop dong' },
]

const experienceOptions: Array<{ value: ExperienceLevel; label: string }> = [
  { value: 'ENTRY', label: 'Moi vao nghe' },
  { value: 'MID', label: 'Trung cap' },
  { value: 'SENIOR', label: 'Cap cao' },
]

const currencyOptions = ['VND', 'USD', 'EUR']

function SectionLabel({
  children,
  required = false,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="mb-3 block text-sm font-semibold uppercase tracking-[0.18em] text-slate-600">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )
}

function SelectField(
  props: SelectHTMLAttributes<HTMLSelectElement> & {
    options: Array<{ value: string; label: string }>
  }
) {
  const { className = '', options, ...rest } = props

  return (
    <select
      className={[
        'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition',
        'focus:border-sky-400 focus:ring-4 focus:ring-sky-100',
        className,
      ].join(' ')}
      {...rest}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export default function CreateJob() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skills: [] as string[],
    salary: '',
    currency: 'VND',
    location: '',
    provinceCode: '',
    addressLine: '',
    jobType: 'FULL_TIME' as JobType,
    experienceLevel: 'ENTRY' as ExperienceLevel,
  })
  const [skillInput, setSkillInput] = useState('')

  const pageSubtitle = useMemo(
    () =>
      'Tao bai dang tuyen dung voi day du thong tin ve vi tri, muc luong, dia diem va ky nang yeu cau.',
    []
  )

  const handlePdfUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (e.target.files && e.target.files.length > 1) {
      setError('Chi duoc tai len 1 tai lieu PDF.')
      e.target.value = ''
      return
    }

    if (file.type !== 'application/pdf') {
      setError('Chi chap nhan file PDF.')
      e.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Tai lieu khong duoc vuot qua 10MB.')
      e.target.value = ''
      return
    }

    setPdfFile(file)
    setError('')
  }

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])

    if (selectedImages.length + files.length > 5) {
      setError('Toi da 5 anh cho moi tin tuyen dung.')
      return
    }

    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setError('Chi chap nhan file anh.')
        return false
      }

      if (file.size > 25 * 1024 * 1024) {
        setError('Moi anh khong duoc vuot qua 25MB.')
        return false
      }

      return true
    })

    setSelectedImages((prev) => [...prev, ...validFiles])
    setError('')
    e.target.value = ''
  }

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddSkill = () => {
    const nextSkill = skillInput.trim()

    if (!nextSkill) return

    if (formData.skills.length >= 20) {
      setError('Toi da 20 ky nang.')
      return
    }

    if (formData.skills.some((skill) => skill.toLowerCase() === nextSkill.toLowerCase())) {
      setError('Ky nang nay da ton tai.')
      return
    }

    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, nextSkill],
    }))
    setSkillInput('')
    setError('')
  }

  const handleRemoveSkill = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('skills', JSON.stringify(formData.skills))
      formDataToSend.append('salary', formData.salary)
      formDataToSend.append('currency', formData.currency)
      formDataToSend.append('location', formData.location)
      formDataToSend.append('provinceCode', formData.provinceCode)
      formDataToSend.append('addressLine', formData.addressLine)
      formDataToSend.append('jobType', formData.jobType)
      formDataToSend.append('experienceLevel', formData.experienceLevel)

      selectedImages.forEach((image) => {
        formDataToSend.append('images', image)
      })

      if (pdfFile) {
        formDataToSend.append('document', pdfFile)
      }

      await jobService.createJob(formDataToSend)
      navigate('/employer/jobs')
    } catch (err: any) {
      console.error('Create job error:', err)

      if (err.response?.data?.details && Array.isArray(err.response.data.details)) {
        const errorMessages = err.response.data.details
          .map((detail: any) => `${detail.path}: ${detail.message}`)
          .join('\n')
        setError(errorMessages || 'Dang tin that bai.')
      } else {
        setError(err.response?.data?.message || 'Dang tin that bai.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,242,255,0.45),_transparent_28%),linear-gradient(180deg,_#eef6ff_0%,_#f8fbff_48%,_#eef4ff_100%)] text-slate-900">
      <header className="border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5"
              aria-label="Quay lai"
            >
              <span className="text-xl leading-none">&#8592;</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-lg font-bold text-sky-700 shadow-inner shadow-sky-200">
                JF
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-slate-800">Job Finder</p>
                <p className="text-sm text-slate-500">Employer workspace</p>
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
            <span className="transition hover:text-slate-950">Tim viec</span>
            <span className="transition hover:text-slate-950">Goi y viec lam</span>
            <span className="rounded-full bg-sky-100 px-4 py-2 text-sky-700">Dashboard</span>
            <span className="transition hover:text-slate-950">Quan ly CV</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-[32px] border border-sky-100 bg-white/75 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                Dang tuyen dung
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight">Dang Tin Tuyen Dung</h1>
              <p className="mt-3 text-sm leading-6 text-white/90">{pageSubtitle}</p>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-semibold text-slate-800">Huong dan nhanh</p>
                <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
                  <li>Hoan thanh tieu de, mo ta va dia diem de bai dang de duoc duyet.</li>
                  <li>Them tai lieu PDF va toi da 5 hinh anh de ho so tin tuyen dung day du hon.</li>
                  <li>Su dung ky nang cu the de tang do chinh xac khi goi y ung vien.</li>
                </ul>
              </div>

              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-sm font-semibold">Trang thai</p>
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span className="text-sm text-white/80">So ky nang</span>
                  <span className="text-lg font-semibold">{formData.skills.length}/20</span>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span className="text-sm text-white/80">So hinh anh</span>
                  <span className="text-lg font-semibold">{selectedImages.length}/5</span>
                </div>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-[36px] border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-100 bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-2 text-white sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-white/75">Form employer</p>
                  <h2 className="text-2xl font-semibold">Tao bai dang moi</h2>
                </div>
                <p className="text-sm text-white/85">Bo cuc da toi uu theo Figma va responsive cho frontend.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8 px-6 py-6 sm:px-8 sm:py-8">
              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm whitespace-pre-line text-rose-700">
                  {error}
                </div>
              )}

              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6">
                  <div>
                    <SectionLabel required>Tieu de cong viec</SectionLabel>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      placeholder="Vi du: Senior Frontend Developer"
                      className="rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:ring-sky-100"
                    />
                  </div>

                  <div>
                    <SectionLabel required>Mo ta cong viec</SectionLabel>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                      rows={6}
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      placeholder="Mo ta chi tiet ve nhiem vu, yeu cau va quyen loi..."
                    />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <SectionLabel required>Moc luong</SectionLabel>
                      <Input
                        type="number"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                        required
                        placeholder="15000000"
                        className="rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:ring-sky-100"
                      />
                    </div>

                    <div>
                      <SectionLabel required>Don vi tien te</SectionLabel>
                      <SelectField
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        options={currencyOptions.map((currency) => ({
                          value: currency,
                          label: currency,
                        }))}
                      />
                    </div>

                    <div>
                      <SectionLabel required>Loai hinh cong viec</SectionLabel>
                      <SelectField
                        value={formData.jobType}
                        onChange={(e) =>
                          setFormData({ ...formData, jobType: e.target.value as JobType })
                        }
                        options={jobTypeOptions}
                      />
                    </div>

                    <div>
                      <SectionLabel required>Cap do kinh nghiem</SectionLabel>
                      <SelectField
                        value={formData.experienceLevel}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            experienceLevel: e.target.value as ExperienceLevel,
                          })
                        }
                        options={experienceOptions}
                      />
                    </div>
                  </div>

                  <div className="grid gap-6">
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                      <SectionLabel required>Dia diem lam viec</SectionLabel>
                      <LocationSelectSimple
                        provinceCode={formData.provinceCode}
                        onProvinceChange={(code, name) => {
                          setFormData({ ...formData, provinceCode: code, location: name })
                        }}
                        required
                        hideLabel
                      />
                    </div>

                    <div>
                      <SectionLabel required>Dia chi cu the</SectionLabel>
                      <Input
                        value={formData.addressLine}
                        onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                        required
                        placeholder="Vi du: Tang 5, toa nha ABC, Quan 1"
                        className="rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:ring-sky-100"
                      />
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Ky nang yeu cau</SectionLabel>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddSkill()
                          }
                        }}
                        placeholder="VD: React, TypeScript, Node.js"
                        className="rounded-2xl border-slate-200 bg-slate-50 px-4 py-3 text-sm shadow-sm focus:ring-sky-100"
                      />
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        className="rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Them ky nang
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {formData.skills.length === 0 && (
                        <span className="rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-500">
                          Chua co ky nang nao duoc them
                        </span>
                      )}

                      {formData.skills.map((skill, index) => (
                        <span
                          key={`${skill}-${index}`}
                          className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-2 text-sm font-medium text-sky-800"
                        >
                          {skill}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(index)}
                            className="text-base leading-none text-sky-700 transition hover:text-sky-950"
                            aria-label={`Xoa ky nang ${skill}`}
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <SectionLabel>Tai lieu</SectionLabel>
                    <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-sky-400 hover:bg-sky-50/60">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-2xl text-sky-700">
                        PDF
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-800">
                        Tai len mo ta chi tiet hoac JD
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        1 file PDF, dung luong toi da 10MB
                      </p>
                      <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
                    </label>

                    {pdfFile && (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        Da chon: <span className="font-semibold">{pdfFile.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <SectionLabel>Hinh anh</SectionLabel>
                    <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-slate-300 bg-white px-6 py-8 text-center transition hover:border-sky-400 hover:bg-sky-50/60">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-2xl text-white">
                        +
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-800">Them anh van phong / du an</p>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Toi da 5 anh, moi anh khong qua 25MB
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>

                    {selectedImages.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {selectedImages.map((image, index) => (
                          <div
                            key={`${image.name}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {image.name}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {(image.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
                              >
                                Xoa
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center justify-center rounded-[22px] border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Huy
                </button>
                <Button
                  type="submit"
                  isLoading={loading}
                  className="rounded-[22px] bg-gradient-to-r from-sky-500 to-blue-600 px-10 py-4 text-base font-semibold text-white shadow-lg shadow-sky-500/20 hover:from-sky-600 hover:to-blue-700"
                >
                  Dang tin
                </Button>
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}

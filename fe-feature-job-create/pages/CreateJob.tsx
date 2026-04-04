/**
 * BRANCH: feature/job-create
 * Feature: Tạo tin tuyển dụng mới
 * Cho phép employer đăng tin việc làm
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jobService } from '../services/jobService'
import Button from '../components/Button'
import Input from '../components/Input'
import LocationSelectSimple from '../components/LocationSelectSimple'

export default function CreateJob() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    skills: [] as string[],
    salary: '',
    currency: 'VND',
    location: '',
    provinceCode: '',
    addressLine: '',
    jobType: 'FULL_TIME',
    experienceLevel: 'ENTRY',
  })
  const [skillInput, setSkillInput] = useState('')

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (e.target.files && e.target.files.length > 1) {
      setError('Chỉ được upload 1 file PDF')
      e.target.value = ''
      return
    }

    if (file.type !== 'application/pdf') {
      setError('Chỉ chấp nhận file PDF')
      e.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File không được vượt quá 10MB')
      e.target.value = ''
      return
    }

    setPdfFile(file)
    setError('')
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (selectedImages.length + files.length > 5) {
      setError('Tối đa 5 ảnh')
      return
    }

    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        setError('Chỉ chấp nhận file ảnh')
        return false
      }
      if (file.size > 25 * 1024 * 1024) {
        setError('Mỗi ảnh không được vượt quá 25MB')
        return false
      }
      return true
    })

    setSelectedImages([...selectedImages, ...validFiles])
    setError('')
  }

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index))
  }

  const handleAddSkill = () => {
    if (skillInput.trim() && formData.skills.length < 20) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      })
      setSkillInput('')
    }
  }

  const handleRemoveSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index),
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
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
        setError(errorMessages || 'Đăng tin thất bại')
      } else {
        setError(err.response?.data?.message || 'Đăng tin thất bại')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Đăng Tin Tuyển Dụng</h1>

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tiêu đề công việc <span className="text-red-600">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="VD: Senior Frontend Developer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô tả công việc <span className="text-red-600">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Mô tả chi tiết về công việc..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kỹ năng yêu cầu (Tùy chọn)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="VD: React, Node.js..."
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Thêm
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(index)}
                      className="hover:text-primary-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mức lương <span className="text-red-600">*</span>
                </label>
                <Input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  required
                  placeholder="VD: 15000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loại công việc <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.jobType}
                  onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="FULL_TIME">Toàn thời gian</option>
                  <option value="PART_TIME">Bán thời gian</option>
                  <option value="CONTRACT">Hợp đồng</option>
                </select>
              </div>
            </div>

            <LocationSelectSimple
              provinceCode={formData.provinceCode}
              onProvinceChange={(code, name) => {
                setFormData({ ...formData, provinceCode: code, location: name })
              }}
              required
            />

            <Input
              label="Địa chỉ cụ thể"
              value={formData.addressLine}
              onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
              required
              placeholder="VD: Tầng 5, Tòa nhà ABC"
            />

            <div className="flex gap-4">
              <Button type="submit" isLoading={loading} className="flex-1">
                Đăng tin
              </Button>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

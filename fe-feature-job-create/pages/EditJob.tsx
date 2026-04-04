/**
 * BRANCH: feature/job-create
 * Feature: Chỉnh sửa tin tuyển dụng
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { jobService } from '../services/jobService'
import Button from '../components/Button'
import Input from '../components/Input'
import LocationSelectSimple from '../components/LocationSelectSimple'

export default function EditJob() {
  const navigate = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()
  const [loading, setLoading] = useState(false)
  const [loadingJob, setLoadingJob] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
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

  useEffect(() => {
    if (jobId) {
      loadJob()
    }
  }, [jobId])

  const loadJob = async () => {
    try {
      setLoadingJob(true)
      const response = await jobService.getJobDetail(jobId!)
      const job = response.data
      
      setFormData({
        title: job.title || '',
        description: job.description || '',
        skills: Array.isArray(job.skills) ? job.skills : [],
        salary: job.salary?.toString() || '',
        currency: job.currency || 'VND',
        location: job.location || '',
        provinceCode: job.provinceCode || '',
        addressLine: job.addressLine || '',
        jobType: job.jobType || 'FULL_TIME',
        experienceLevel: job.experienceLevel || 'ENTRY',
      })
    } catch (err: any) {
      console.error('Load job error:', err)
      setError(err.response?.data?.message || 'Không thể tải thông tin công việc')
    } finally {
      setLoadingJob(false)
    }
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
    setSuccessMessage('')
    setLoading(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('skills', JSON.stringify(formData.skills))
      formDataToSend.append('salary', formData.salary)
      formDataToSend.append('currency', formData.currency)
      formDataToSend.append('location', formData.location)
      formDataToSend.append('provinceCode', formData.provinceCode.trim())
      formDataToSend.append('addressLine', formData.addressLine.trim())
      formDataToSend.append('jobType', formData.jobType)
      formDataToSend.append('experienceLevel', formData.experienceLevel)

      await jobService.updateJob(jobId!, formDataToSend)
      
      const response = await jobService.getJobDetail(jobId!)
      const job = response.data
      setFormData({
        title: job.title,
        description: job.description,
        skills: job.skills,
        salary: job.salary,
        currency: job.currency,
        location: job.location,
        provinceCode: job.provinceCode || '',
        addressLine: job.addressLine || '',
        jobType: job.jobType,
        experienceLevel: job.experienceLevel,
      })
      
      setSuccessMessage('Cập nhật tin tuyển dụng thành công!')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err: any) {
      console.error('Update job error:', err)
      setError(err.response?.data?.message || 'Cập nhật thất bại')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  if (loadingJob) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Chỉnh Sửa Tin Tuyển Dụng</h1>

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          <Input
            label="Tiêu đề công việc"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả công việc</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Mức lương"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Loại công việc</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="FULL_TIME">Toàn thời gian</option>
                <option value="PART_TIME">Bán thời gian</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" isLoading={loading} className="flex-1">
              Cập nhật
            </Button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

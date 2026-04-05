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

    // Only allow 1 PDF file
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

      // Append images
      selectedImages.forEach((image) => {
        formDataToSend.append('images', image)
      })

      // Append PDF document
      if (pdfFile) {
        formDataToSend.append('document', pdfFile)
      }

      await jobService.createJob(formDataToSend)
      navigate('/employer/jobs')
    } catch (err: any) {
      console.error('Create job error:', err)
      
      // Handle validation errors with details
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Quay lại
      </button>

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
              <p className="mt-1 text-sm text-gray-500">Tối thiểu 10 ký tự, tối đa 160 ký tự</p>
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
              <p className="mt-1 text-sm text-gray-500">Tối thiểu 50 ký tự, tối đa 10,000 ký tự. Mô tả chi tiết về trách nhiệm, yêu cầu công việc.</p>
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
              <p className="mb-2 text-sm text-gray-500">Nhập kỹ năng và nhấn "Thêm" hoặc Enter. Tối đa 20 kỹ năng, mỗi kỹ năng tối đa 60 ký tự.</p>
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
                <p className="mt-1 text-sm text-gray-500">Nhập số tiền (VD: 15000000 = 15 triệu)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Đơn vị tiền tệ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  maxLength={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="VND"
                />
                <p className="mt-1 text-sm text-gray-500">Mã tiền tệ 3 ký tự (VND, USD...)</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Địa điểm làm việc <span className="text-red-600">*</span>
              </label>
              <LocationSelectSimple
                provinceCode={formData.provinceCode}
                onProvinceChange={(code, name) => {
                  setFormData({ ...formData, provinceCode: code, location: name })
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Địa chỉ cụ thể <span className="text-red-600">*</span>
              </label>
              <Input
                value={formData.addressLine}
                onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
                required
                placeholder="VD: Tầng 5, Tòa nhà ABC, Số 123 Đường XYZ"
              />
              <p className="mt-1 text-sm text-gray-500">Địa chỉ chi tiết nơi làm việc (đường, quận/huyện...)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loại hình công việc <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.jobType}
                  onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="FULL_TIME">Toàn thời gian</option>
                  <option value="PART_TIME">Bán thời gian</option>
                  <option value="CONTRACT">Hợp đồng</option>
                  <option value="INTERN">Thực tập</option>
                  <option value="REMOTE">Từ xa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cấp độ kinh nghiệm
                </label>
                <select
                  value={formData.experienceLevel}
                  onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="ENTRY">Không yêu cầu kinh nghiệm</option>
                  <option value="JUNIOR">Junior</option>
                  <option value="MIDDLE">Middle</option>
                  <option value="SENIOR">Senior</option>
                  <option value="LEAD">Lead</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Tài liệu đính kèm (Tùy chọn)</h3>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">📄 Tải lên Job Description (Tùy chọn)</h3>
              <p className="text-sm text-blue-700 mb-3">
                Bạn có thể tải lên file PDF mô tả công việc thay vì nhập thủ công
              </p>
              <label className="block">
                <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center hover:border-blue-500 cursor-pointer transition-colors bg-white">
                  {pdfFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900">{pdfFile.name}</p>
                        <p className="text-sm text-gray-600">{(pdfFile.size / 1024).toFixed(2)} KB</p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            window.open(URL.createObjectURL(pdfFile), '_blank')
                          }}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Xem
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            setPdfFile(null)
                          }}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <svg className="mx-auto h-12 w-12 text-blue-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600">
                        Click để chọn file PDF (tối đa 10MB)
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </div>
              </label>
            </div>

            {/* Upload Images */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">🖼️ Tải lên Ảnh minh họa (Tùy chọn)</h3>
              <p className="text-sm text-green-700 mb-3">
                Tải lên tối đa 5 ảnh để minh họa cho tin tuyển dụng (mỗi ảnh tối đa 25MB)
              </p>
              <label className="block">
                <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center hover:border-green-500 cursor-pointer transition-colors bg-white">
                  <svg className="mx-auto h-12 w-12 text-green-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    Click để chọn ảnh ({selectedImages.length}/5)
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </label>
              
              {selectedImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedImageIndex(index)}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Image Lightbox */}
            {selectedImageIndex !== null && (
              <div 
                className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
                onClick={() => setSelectedImageIndex(null)}
              >
                <button
                  onClick={() => setSelectedImageIndex(null)}
                  className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
                >
                  ×
                </button>
                
                {selectedImageIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex(selectedImageIndex - 1)
                    }}
                    className="absolute left-4 text-white text-4xl hover:text-gray-300 z-10"
                  >
                    ‹
                  </button>
                )}
                
                {selectedImageIndex < selectedImages.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedImageIndex(selectedImageIndex + 1)
                    }}
                    className="absolute right-4 text-white text-4xl hover:text-gray-300 z-10"
                  >
                    ›
                  </button>
                )}
                
                <img
                  src={URL.createObjectURL(selectedImages[selectedImageIndex])}
                  alt={`Preview ${selectedImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
                  {selectedImageIndex + 1} / {selectedImages.length}
                </div>
              </div>
            )}

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

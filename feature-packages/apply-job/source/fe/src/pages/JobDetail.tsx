import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jobService } from '../services/jobService'
import type { Job } from '../services/jobService'
import { cvService } from '../services/cvService'
import { chatService } from '../services/chatService'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'
import { getJobTypeLabel } from '../utils/jobTypeLabels'
import { getExperienceLevelLabel } from '../utils/experienceLevelLabels'
import { MessageCircle } from 'lucide-react'

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [myCv, setMyCv] = useState<any>(null)
  const [hasCV, setHasCV] = useState(false)
  const [alreadyApplied, setAlreadyApplied] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [creatingChat, setCreatingChat] = useState(false)

  useEffect(() => {
    loadJobDetail()
    if (isAuthenticated && user?.role === 'candidate') {
      loadMyCv()
      checkAlreadyApplied()
    }
  }, [jobId])

  const loadJobDetail = async () => {
    if (!jobId) {
      setError('Không tìm thấy công việc')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await jobService.getPublicJobDetail(jobId)
      console.log('📋 Job detail data:', data.data)
      console.log('🖼️ Images:', data.data?.images)
      console.log('🖼️ Images length:', data.data?.images?.length)
      console.log('🖼️ Images array:', JSON.stringify(data.data?.images, null, 2))
      console.log('📄 Document:', data.data?.document)
      setJob(data.data)
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Không tìm thấy công việc')
      } else {
        setError(err.response?.data?.message || 'Không thể tải thông tin công việc')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadMyCv = async () => {
    try {
      const response = await cvService.getMyCv()
      setMyCv(response.data || null)
      setHasCV(!!response.data)
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to load CV:', err)
      }
      setHasCV(false)
    }
  }

  const checkAlreadyApplied = async () => {
    if (!jobId) return
    
    try {
      const response = await jobService.getMyApplications()
      const applications = response.data || []
      const existingApp = applications.find(
        (app: any) => app.jobId === jobId && app.status !== 'WITHDRAWN'
      )
      
      if (existingApp) {
        setAlreadyApplied(true)
      }
    } catch (err: any) {
      console.error('Failed to check applications:', err)
    }
  }

  const handleApply = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (!jobId) return

    setError('')
    setSuccess('')
    setApplying(true)

    try {
      await jobService.applyToJob(jobId, {
        cvFileId: myCv?.id || undefined,
      })
      setSuccess('Ứng tuyển thành công!')
      
      // Tự động tạo conversation với employer sau khi ứng tuyển thành công
      if (job?.employerId) {
        try {
          await chatService.createConversation({
            participantId: job.employerId,
            jobId: jobId,
          })
          console.log('✅ Conversation created automatically after application')
        } catch (chatErr) {
          // Không hiển thị lỗi cho user, chỉ log
          console.error('Failed to create conversation:', chatErr)
        }
      }
      
      // Reload để check already applied
      await checkAlreadyApplied()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ứng tuyển thất bại')
    } finally {
      setApplying(false)
    }
  }

  const handleStartChat = async () => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }

    if (!jobId || !job) return

    setCreatingChat(true)
    try {
      // Tạo conversation với employer
      const response = await chatService.createConversation({
        participantId: job.employerId,
        jobId: jobId,
      })
      
      // Navigate to specific conversation
      navigate('/chat', { state: { conversationId: response.conversationId } })
    } catch (err: any) {
      console.error('Failed to create conversation:', err)
      alert('Không thể tạo cuộc trò chuyện. Vui lòng thử lại.')
    } finally {
      setCreatingChat(false)
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

  if (!job) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">{error || 'Không tìm thấy công việc'}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Quay lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="text-primary-600 hover:text-primary-700 mb-6 flex items-center"
      >
        ← Quay lại
      </button>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{job.title}</h1>

        {/* Job Images */}
        {job.images && job.images.length > 0 && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {job.images.map((image, index) => {
                const imageUrl = `http://localhost:3002${image.filePath}`
                console.log('🖼️ Image URL:', imageUrl)
                return (
                  <div 
                    key={image.id} 
                    className="rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <img
                      src={imageUrl}
                      alt={`${job.title} - Hình ${image.slot}`}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        console.error('❌ Image load failed:', imageUrl)
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E'
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Image Lightbox */}
        {selectedImageIndex !== null && job.images && (
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
            
            {selectedImageIndex < job.images.length - 1 && (
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
              src={`http://localhost:3002${job.images[selectedImageIndex].filePath}`}
              alt={`${job.title} - Hình ${job.images[selectedImageIndex].slot}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
              {selectedImageIndex + 1} / {job.images.length}
            </div>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Thông tin cơ bản</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">📍 Địa điểm:</span>
              <span className="ml-2 font-medium">
                {job.provinceNameSnapshot || job.location}
              </span>
            </div>
            <div>
              <span className="text-gray-600">💰 Mức lương:</span>
              <span className="ml-2 font-medium">
                {typeof job.salary === 'number' 
                  ? `${job.salary.toLocaleString()} ${job.currency || 'VND'}`
                  : job.salary}
              </span>
            </div>
            {job.jobType && (
              <div>
                <span className="text-gray-600">💼 Loại hình:</span>
                <span className="ml-2 font-medium">{getJobTypeLabel(job.jobType)}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">📊 Kinh nghiệm:</span>
              <span className="ml-2 font-medium">
                {job.experienceLevel ? getExperienceLevelLabel(job.experienceLevel) : 'Không yêu cầu'}
              </span>
            </div>
            {job.addressLine && (
              <div className="col-span-2">
                <span className="text-gray-600">📍 Địa chỉ cụ thể:</span>
                <span className="ml-2 font-medium">{job.addressLine}</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Mô tả công việc</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{job.description}</p>
          </div>

          {job.skills && job.skills.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Kỹ năng yêu cầu</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill: string, index: number) => (
                  <span key={index} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Employer Information */}
          {job.employer && (
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Thông tin nhà tuyển dụng
              </h2>
              <div className="space-y-3">
                <div className="flex items-start">
                  <span className="text-gray-600 font-medium w-32">🏢 Công ty:</span>
                  <span className="text-gray-900 font-semibold">{job.employer.companyName}</span>
                </div>
                {job.employer.email && (
                  <div className="flex items-start">
                    <span className="text-gray-600 font-medium w-32">📧 Email:</span>
                    <span className="text-gray-900">{job.employer.email}</span>
                  </div>
                )}
                {job.employer.phone && (
                  <div className="flex items-start">
                    <span className="text-gray-600 font-medium w-32">📞 Điện thoại:</span>
                    <span className="text-gray-900">{job.employer.phone}</span>
                  </div>
                )}
                {job.employer.address && (
                  <div className="flex items-start">
                    <span className="text-gray-600 font-medium w-32">📍 Địa chỉ:</span>
                    <span className="text-gray-900">{job.employer.address}</span>
                  </div>
                )}
                {job.employer.website && (
                  <div className="flex items-start">
                    <span className="text-gray-600 font-medium w-32">🌐 Website:</span>
                    <a 
                      href={job.employer.website.startsWith('http') ? job.employer.website : `https://${job.employer.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {job.employer.website}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Job Document (PDF) */}
        {job.document && (
          <div className="mt-6 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h10l4 4v16H2v-1z"/>
                </svg>
                <div>
                  <p className="font-medium text-gray-900">{job.document.originalName}</p>
                  <p className="text-sm text-gray-600">
                    {(job.document.fileSize / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <a
                href={`http://localhost:3002${job.document.filePath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Xem PDF
              </a>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        {isAuthenticated && user?.role === 'candidate' && !success && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Ứng tuyển ngay</h3>
            
            {alreadyApplied && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  ✓ Bạn đã ứng tuyển công việc này rồi.
                </p>
              </div>
            )}
            
            {!hasCV && !alreadyApplied && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  Bạn chưa có CV. Hãy <a href="/profile" className="underline font-medium">tạo CV</a> để ứng tuyển.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                onClick={handleApply} 
                isLoading={applying} 
                className="flex-1"
                disabled={!hasCV || alreadyApplied}
              >
                {alreadyApplied ? 'Đã ứng tuyển' : hasCV ? 'Ứng tuyển' : 'Cần có CV để ứng tuyển'}
              </Button>
              <Button
                onClick={handleStartChat}
                isLoading={creatingChat}
                variant="outline"
                className="flex items-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Chat với NTD
              </Button>
            </div>
          </div>
        )}

        {!isAuthenticated && (
          <div className="mt-8 border-t pt-6 text-center">
            <p className="text-gray-600 mb-4">Vui lòng đăng nhập để ứng tuyển</p>
            <Button onClick={() => navigate('/login')}>Đăng nhập</Button>
          </div>
        )}
      </div>
    </div>
  )
}

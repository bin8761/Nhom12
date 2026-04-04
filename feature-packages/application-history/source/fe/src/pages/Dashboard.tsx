import { useState, useEffect } from 'react'
import { User, Briefcase, CheckCircle, FileText, Send, Clock, MessageCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { jobService } from '../services/jobService'
import type { Application } from '../services/jobService'
import { cvService } from '../services/cvService'
import { chatService } from '../services/chatService'
import Button from '../components/Button'
import LocationUpdateModal from '../components/LocationUpdateModal'
import { getJobTypeLabel } from '../utils/jobTypeLabels'
import { getExperienceLevelLabel } from '../utils/experienceLevelLabels'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalApplications: 0,
    pendingApplications: 0,
    hasCV: false,
    cvDownloadUrl: '',
    loading: true,
  })
  const [applications, setApplications] = useState<Application[]>([])
  const [withdrawing, setWithdrawing] = useState<string | null>(null)
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [loadingJobDetail, setLoadingJobDetail] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadStats()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadStats()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [user?.role])
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await loadStats()
    setRefreshing(false)
  }

  const handleWithdraw = async (applicationId: string) => {
    if (!confirm('Bạn có chắc muốn hủy ứng tuyển này?')) {
      return
    }

    try {
      setWithdrawing(applicationId)
      await jobService.withdrawApplication(applicationId)
      // Reload stats and applications
      await loadStats()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể hủy ứng tuyển')
    } finally {
      setWithdrawing(null)
    }
  }

  const handleEmployerChatWithAdmin = async () => {
    if (!user?.id) return

    try {
      // Employer chat với Admin (không liên quan job cụ thể)
      const response = await chatService.createConversation({
        participantId: 'admin', // Magic string
      })
      // Navigate to specific conversation
      navigate('/chat', { state: { conversationId: response.conversationId } })
    } catch (err: any) {
      console.error('Failed to create conversation:', err)
      alert('Không thể tạo cuộc trò chuyện với Admin. Vui lòng thử lại.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      SUBMITTED: { label: 'Đã gửi', className: 'bg-blue-100 text-blue-800' },
      UNDER_REVIEW: { label: 'Đang xem xét', className: 'bg-yellow-100 text-yellow-800' },
      ACCEPTED: { label: 'Đã chấp nhận', className: 'bg-green-100 text-green-800' },
      REJECTED: { label: 'Đã từ chối', className: 'bg-red-100 text-red-800' },
      WITHDRAWN: { label: 'Đã hủy', className: 'bg-gray-100 text-gray-800' },
    }

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        {config.label}
      </span>
    )
  }

  const canWithdraw = (application: Application) => {
    // Cannot withdraw if:
    // - Application status is ACCEPTED, REJECTED, or WITHDRAWN
    // - CV has been approved by employer
    if (['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(application.status)) {
      return false
    }
    
    if (application.cvStatus === 'APPROVED') {
      return false
    }
    
    return true
  }

  const handleViewJob = async (jobId: string) => {
    try {
      setLoadingJobDetail(true)
      const data = await jobService.getPublicJobDetail(jobId)
      setSelectedJob(data.data)
    } catch (err: any) {
      alert('Không thể tải thông tin công việc')
    } finally {
      setLoadingJobDetail(false)
    }
  }

  const closeJobDetail = () => {
    setSelectedJob(null)
  }

  const loadStats = async () => {
    if (user?.role === 'candidate') {
      try {
        const [applicationsRes, cvRes] = await Promise.allSettled([
          jobService.getMyApplications(),
          cvService.getMyCv(),
        ])

        const applicationsData = applicationsRes.status === 'fulfilled' ? applicationsRes.value.data : []
        const cvFileData = cvRes.status === 'fulfilled' ? cvRes.value.data : null

        // Has CV if has uploaded file
        const hasCV = !!cvFileData

        // Filter out withdrawn applications
        const activeApplications = (applicationsData || []).filter((app: any) => app.status !== 'WITHDRAWN')
        
        setApplications(applicationsData || [])
        setStats({
          totalApplications: activeApplications.length,
          pendingApplications: activeApplications.filter((app: any) => 
            app.cvStatus === 'PENDING' || app.cvStatus === null
          ).length,
          hasCV,
          cvDownloadUrl: cvFileData?.downloadUrl || '',
          loading: false,
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
        setStats(prev => ({ ...prev, loading: false }))
      }
    } else if (user?.role === 'employer') {
      try {
        const jobsRes = await jobService.getMyJobs()
        const jobs = jobsRes.data || []
        
        setStats({
          totalApplications: jobs.length || 0,
          pendingApplications: jobs.filter((job: any) => job.status === 'PENDING').length || 0,
          hasCV: false,
          cvDownloadUrl: '',
          loading: false,
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
        setStats(prev => ({ ...prev, loading: false }))
      }
    } else if (user?.role === 'admin') {
      try {
        const jobsRes = await jobService.getPendingJobs()
        const jobs = jobsRes.data || []
        
        setStats({
          totalApplications: jobs.length || 0,
          pendingApplications: jobs.filter((job: any) => job.status === 'PENDING').length || 0,
          hasCV: false,
          cvDownloadUrl: '',
          loading: false,
        })
      } catch (error) {
        console.error('Failed to load stats:', error)
        setStats(prev => ({ ...prev, loading: false }))
      }
    } else {
      setStats(prev => ({ ...prev, loading: false }))
    }
  }

  const roleLabels = {
    candidate: 'Ứng viên',
    employer: 'Nhà tuyển dụng',
    admin: 'Quản trị viên',
  }

  const roleDescriptions: Record<string, string> = {
    candidate: 'Tìm kiếm và ứng tuyển vào các vị trí công việc phù hợp với bạn.',
    employer: 'Đăng tin tuyển dụng và quản lý hồ sơ ứng viên.',
    admin: 'Quản lý toàn bộ hệ thống và duyệt tin tuyển dụng.',
  }

  const ApplicationCard = ({
    application,
    withdrawing,
    onWithdraw,
    onViewJob,
  }: {
    application: Application
    withdrawing: string | null
    onWithdraw: (id: string) => void
    onViewJob: (jobId: string) => void
  }) => (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {application.job?.title || 'Công việc'}
          </h3>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>📅 Ứng tuyển: {new Date(application.createdAt).toLocaleDateString('vi-VN')}</span>
            <span>🔄 Cập nhật: {new Date(application.updatedAt).toLocaleDateString('vi-VN')}</span>
          </div>
          {application.cvFileId && (
            <div className="mt-2 text-sm text-gray-600">
              <span>📄 Đã gửi kèm CV</span>
            </div>
          )}
          {/* CV Status */}
          {application.cvStatus && (
            <div className="mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                application.cvStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                application.cvStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {application.cvStatus === 'APPROVED' ? '✓ CV đã được duyệt' :
                 application.cvStatus === 'REJECTED' ? '✗ CV chưa được duyệt' :
                 '⏳ CV đang chờ duyệt'}
              </span>
              {application.cvDecisionNote && (
                <p className="text-xs text-gray-600 mt-1">
                  Ghi chú: {application.cvDecisionNote}
                </p>
              )}
            </div>
          )}
        </div>
        <div>{getStatusBadge(application.status)}</div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewJob(application.jobId)}
        >
          Xem công việc
        </Button>

        {canWithdraw(application) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onWithdraw(application.id)}
            isLoading={withdrawing === application.id}
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            Hủy ứng tuyển
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Chào mừng trở lại!</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <svg 
            className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Đang tải...' : 'Làm mới'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Vai trò</p>
              <p className="text-lg font-semibold text-gray-900">
                {roleLabels[user?.role || 'candidate']}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Trạng thái</p>
              <p className="text-lg font-semibold text-green-600">
                Đã xác minh
              </p>
            </div>
          </div>
        </div>

        {user?.role === 'candidate' && !stats.loading && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <Send className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Đã ứng tuyển</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalApplications}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Đang chờ</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.pendingApplications}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {user?.role === 'employer' && !stats.loading && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Tin tuyển dụng</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalApplications}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Chờ duyệt</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.pendingApplications}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {user?.role === 'candidate' && !stats.loading && (
        <>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">CV của bạn</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {stats.hasCV ? 'Đã upload CV' : 'Chưa có CV'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {stats.hasCV ? (
                  <>
                    {stats.cvDownloadUrl && (
                      <a
                        href={`${import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'}${stats.cvDownloadUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Xem CV PDF
                      </a>
                    )}
                    <a
                      href="/cv"
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Quản lý
                    </a>
                  </>
                ) : (
                  <a
                    href="/cv"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Upload CV
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Applications List */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Công Việc Đã Ứng Tuyển</h2>
            
            {applications.filter(app => app.status !== 'WITHDRAWN').length === 0 ? (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-600 mb-4">Bạn chưa ứng tuyển công việc nào</p>
                <Button onClick={() => (window.location.href = '/jobs')}>Tìm việc ngay</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {applications
                  .filter(app => app.status !== 'WITHDRAWN')
                  .map((app) => (
                    <ApplicationCard
                      key={app.id}
                      application={app}
                      withdrawing={withdrawing}
                      onWithdraw={handleWithdraw}
                      onViewJob={handleViewJob}
                    />
                  ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Briefcase className="w-8 h-8 text-primary-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">
              Bắt đầu với Job Finder
            </h2>
          </div>
          {user?.role === 'employer' && (
            <a
              href="/employer/jobs/create"
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold"
            >
              + Đăng tin tuyển dụng
            </a>
          )}
        </div>
        <p className="text-gray-600 mb-4">
          {roleDescriptions[user?.role || 'candidate']}
        </p>
        {user?.role === 'admin' && <AdminJobsSection />}
        {user?.role === 'employer' && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/employer/jobs"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 mb-2">Quản lý tin tuyển dụng</h3>
              <p className="text-sm text-gray-600">Xem và chỉnh sửa các tin đã đăng</p>
            </a>
            <a
              href="/profile"
              className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 mb-2">Thông tin công ty</h3>
              <p className="text-sm text-gray-600">Cập nhật profile công ty</p>
            </a>
            <button
              onClick={handleEmployerChatWithAdmin}
              className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold text-gray-900">Liên hệ Admin</h3>
              </div>
              <p className="text-sm text-gray-600">Chat với quản trị viên</p>
            </button>
          </div>
        )}

      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h2 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h2>
            </div>

            <div className="p-6">
              {/* Job Images */}
              {selectedJob.images && selectedJob.images.length > 0 && (
                <div className="mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedJob.images.map((image: any) => (
                      <div key={image.id} className="rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={`http://localhost:3002${image.filePath}`}
                          alt={`${selectedJob.title} - Hình ${image.slot}`}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <span className="text-gray-600">📍 Địa điểm:</span>
                  <span className="ml-2 font-medium">
                    {selectedJob.provinceNameSnapshot || selectedJob.location}
                    {selectedJob.districtNameSnapshot && `, ${selectedJob.districtNameSnapshot}`}
                  </span>
                </div>
                {selectedJob.addressLine && (
                  <div>
                    <span className="text-gray-600">📍 Địa chỉ cụ thể:</span>
                    <span className="ml-2 font-medium">{selectedJob.addressLine}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">💰 Mức lương:</span>
                  <span className="ml-2 font-medium">
                    {typeof selectedJob.salary === 'number'
                      ? `${selectedJob.salary.toLocaleString()} ${selectedJob.currency || 'VND'}`
                      : selectedJob.salary}
                  </span>
                </div>
                {selectedJob.jobType && (
                  <div>
                    <span className="text-gray-600">💼 Loại hình:</span>
                    <span className="ml-2 font-medium">{getJobTypeLabel(selectedJob.jobType)}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">📊 Kinh nghiệm:</span>
                  <span className="ml-2 font-medium">
                    {selectedJob.experienceLevel ? getExperienceLevelLabel(selectedJob.experienceLevel) : 'Không yêu cầu'}
                  </span>
                </div>
                {selectedJob.skills && selectedJob.skills.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-gray-600">🔧 Kỹ năng:</span>
                    <span className="ml-2 font-medium">{selectedJob.skills.join(', ')}</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Mô tả công việc</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.description}</p>
                </div>

                {selectedJob.requirements && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Yêu cầu</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.requirements}</p>
                  </div>
                )}

                {selectedJob.benefits && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Quyền lợi</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedJob.benefits}</p>
                  </div>
                )}
              </div>

              {/* Job Document (PDF) */}
              {selectedJob.document && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h10l4 4v16H2v-1z"/>
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900">{selectedJob.document.originalName}</p>
                        <p className="text-sm text-gray-600">
                          {(selectedJob.document.fileSize / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <a
                      href={`http://localhost:3002${selectedJob.document.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Xem PDF
                    </a>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button onClick={closeJobDetail} className="w-full">
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loadingJobDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải...</p>
          </div>
        </div>
      )}

      {/* Location Update Modal */}
      <LocationUpdateModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSuccess={() => {
          alert('Cập nhật địa chỉ thành công! Bạn có thể xem gợi ý việc làm phù hợp.')
        }}
      />
    </div>
  )
}

// Admin Jobs Section Component
function AdminJobsSection() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'jobs' | 'employers'>('jobs')
  const [jobs, setJobs] = useState<any[]>([])
  const [employers, setEmployers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('PENDING')
  const [selectedJob, setSelectedJob] = useState<any>(null)
  const [selectedEmployer, setSelectedEmployer] = useState<any>(null)
  const [showJobDetail, setShowJobDetail] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [creatingChat, setCreatingChat] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'jobs') {
      loadJobs()
    } else {
      loadPendingEmployers()
    }
  }, [statusFilter, activeTab])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const data = await jobService.getAllJobs({ status: statusFilter })
      console.log('📋 Jobs loaded:', data.data?.length || 0)
      console.log('📋 First job employerId:', data.data?.[0]?.employerId)
      setJobs(data.data || [])
    } catch (err: any) {
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPendingEmployers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001'}/api/admin/users/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })
      const data = await response.json()
      setEmployers(data.data || [])
    } catch (err: any) {
      console.error('Failed to load employers:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveEmployer = async (employerId: string) => {
    if (!confirm('Bạn có chắc muốn duyệt nhà tuyển dụng này?')) return
    try {
      setActionLoading(true)
      await fetch(`${import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001'}/api/admin/users/${employerId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: 'Đã xác minh thông tin công ty' }),
      })
      alert('Duyệt thành công!')
      setSelectedEmployer(null)
      loadPendingEmployers()
    } catch (err: any) {
      alert('Duyệt thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectEmployer = async (employerId: string) => {
    const reason = prompt('Nhập lý do từ chối:')
    if (!reason) return
    try {
      setActionLoading(true)
      await fetch(`${import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001'}/api/admin/users/${employerId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      })
      alert('Từ chối thành công!')
      setSelectedEmployer(null)
      loadPendingEmployers()
    } catch (err: any) {
      alert('Từ chối thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAdminChatWithEmployer = async (employerId: string, jobId: string) => {
    if (!user?.id) return

    setCreatingChat(jobId)
    try {
      // Admin chat với Employer về job cụ thể
      const response = await chatService.createConversation({
        participantId: employerId,
        jobId: jobId,
      })
      // Navigate to specific conversation
      navigate('/chat', { state: { conversationId: response.conversationId } })
    } catch (err: any) {
      console.error('Failed to create conversation:', err)
      alert('Không thể tạo cuộc trò chuyện. Vui lòng thử lại.')
    } finally {
      setCreatingChat(null)
    }
  }

  const handleApprove = async (jobId: string) => {
    if (!confirm('Bạn có chắc muốn duyệt công việc này?')) return
    try {
      await jobService.approveJob(jobId)
      loadJobs()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Duyệt thất bại')
    }
  }

  const handleReject = async (jobId: string) => {
    // Show modal with predefined reasons
    const reasons = [
      'Nội dung không phù hợp',
      'Thông tin không đầy đủ',
      'Mô tả công việc không rõ ràng',
      'Yêu cầu không hợp lý',
      'Nghi ngờ lừa đảo',
      'Vi phạm chính sách',
      'Lý do khác (nhập thủ công)',
    ]
    
    const selectedReason = prompt(
      'Chọn lý do từ chối:\n\n' + 
      reasons.map((r, i) => `${i + 1}. ${r}`).join('\n') + 
      '\n\nNhập số (1-7) hoặc nhập lý do tùy chỉnh:'
    )
    
    if (!selectedReason) return
    
    let finalReason = selectedReason
    const reasonIndex = parseInt(selectedReason)
    
    if (reasonIndex >= 1 && reasonIndex <= 6) {
      finalReason = reasons[reasonIndex - 1]
    } else if (reasonIndex === 7) {
      finalReason = prompt('Nhập lý do từ chối:') || ''
      if (!finalReason) return
    }
    
    try {
      await jobService.rejectJob(jobId, finalReason)
      loadJobs()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Từ chối thất bại')
    }
  }

  const handleDelete = async (jobId: string) => {
    const reasons = [
      'Nội dung vi phạm chính sách',
      'Thông tin không chính xác hoặc gây hiểu lầm',
      'Nghi ngờ lừa đảo',
      'Tin trùng lặp',
      'Yêu cầu không hợp lý hoặc bất hợp pháp',
      'Nhà tuyển dụng yêu cầu xóa',
      'Lý do khác (nhập thủ công)',
    ]
    
    const selectedReason = prompt(
      'Chọn lý do xóa tin tuyển dụng:\n\n' + 
      reasons.map((r, i) => `${i + 1}. ${r}`).join('\n') + 
      '\n\nNhập số (1-7) hoặc nhập lý do tùy chỉnh:'
    )
    
    if (!selectedReason) return
    
    let finalReason = selectedReason
    const reasonIndex = parseInt(selectedReason)
    
    if (reasonIndex >= 1 && reasonIndex <= 6) {
      finalReason = reasons[reasonIndex - 1]
    } else if (reasonIndex === 7) {
      finalReason = prompt('Nhập lý do xóa (tối thiểu 10 ký tự):') || ''
      if (!finalReason) return
      if (finalReason.trim().length < 10) {
        alert('Lý do xóa phải có ít nhất 10 ký tự')
        return
      }
    }
    
    if (!confirm(`Bạn có chắc muốn xóa công việc này?\n\nLý do: ${finalReason}\n\nEmail sẽ được gửi cho nhà tuyển dụng.`)) return
    
    try {
      await jobService.adminDeleteJob(jobId, finalReason)
      loadJobs()
      alert('Đã xóa tin tuyển dụng và gửi email thông báo cho nhà tuyển dụng')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Xóa thất bại')
    }
  }



  const handleViewDetail = async (job: any) => {
    // Admin already has full job data from list API (includes images and document)
    setSelectedJob({ ...job, employerDetails: null, loadingEmployer: true })
    setShowJobDetail(true)
    
    console.log('📋 Job data from list:', job)
    console.log('🖼️ Images:', job.images)
    console.log('📄 Document:', job.document)
    console.log('👤 Employer ID:', job.employerId)
    
    // Get token from auth store
    const authStorage = localStorage.getItem('auth-storage')
    const accessToken = authStorage ? JSON.parse(authStorage).state.accessToken : null
    
    console.log('🔑 Access token:', accessToken ? 'Found' : 'Not found')
    
    // Fetch employer details
    try {
      const response = await fetch(`${import.meta.env.VITE_AUTH_API_URL || 'http://localhost:3001'}/api/admin/users/${job.employerId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      
      console.log('Employer API response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Employer data:', data)
        setSelectedJob({ ...job, employerDetails: data.data, loadingEmployer: false })
      } else {
        const errorText = await response.text()
        console.error('Employer API error:', response.status, errorText)
        setSelectedJob({ ...job, employerDetails: null, loadingEmployer: false })
      }
    } catch (error) {
      console.error('Failed to fetch employer details:', error)
      setSelectedJob({ ...job, employerDetails: null, loadingEmployer: false })
    }
  }

  return (
    <div className="mt-6">
      {/* Tabs */}
      <div className="flex gap-4 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-2 px-4 font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Tin tuyển dụng
        </button>
        <button
          onClick={() => setActiveTab('employers')}
          className={`pb-2 px-4 font-medium transition-colors ${
            activeTab === 'employers'
              ? 'border-b-2 border-primary-600 text-primary-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Nhà tuyển dụng ({employers.length})
        </button>
      </div>

      {activeTab === 'jobs' ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Quản lý Tin tuyển dụng</h3>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="ALL">Tất cả</option>
              <option value="PENDING">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Đã từ chối</option>
              <option value="DELETED">Đã xóa</option>
            </select>
          </div>
        </>
      ) : (
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Duyệt Nhà Tuyển Dụng</h3>
          <p className="text-sm text-gray-600 mt-1">Danh sách nhà tuyển dụng chờ duyệt</p>
        </div>
      )}

      {activeTab === 'jobs' ? (
        loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Không có công việc nào
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{job.title}</h4>
                    <div className="flex gap-3 text-sm text-gray-600 mb-2">
                      <span>📍 {job.provinceNameSnapshot || job.location}</span>
                      <span>💰 {job.salary}</span>
                      <span>💼 {getJobTypeLabel(job.jobType)}</span>
                    </div>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                      job.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      job.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      job.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleViewDetail(job)}
                    >
                      Xem chi tiết
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleAdminChatWithEmployer(job.employerId, job.id)}
                      isLoading={creatingChat === job.id}
                      className="flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Chat
                    </Button>
                    {job.status === 'PENDING' && (
                      <>
                        <Button size="sm" onClick={() => handleApprove(job.id)}>
                          Duyệt
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReject(job.id)}>
                          Từ chối
                        </Button>
                      </>
                    )}
                    {job.status === 'APPROVED' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDelete(job.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Xóa
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Employers List */
        loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : employers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Không có nhà tuyển dụng nào chờ duyệt
          </div>
        ) : (
          <div className="space-y-3">
            {employers.map((employer: any) => (
              <div key={employer.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {employer.employerProfile?.companyName || 'Chưa có tên công ty'}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <span>📧 {employer.email}</span>
                      <span>📞 {employer.phoneNumber}</span>
                    </div>
                    <span className="inline-block px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                      Chờ duyệt
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setSelectedEmployer(employer)}
                    >
                      Chi tiết
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleApproveEmployer(employer.id)}
                      isLoading={actionLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Duyệt
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleRejectEmployer(employer.id)}
                      isLoading={actionLoading}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Từ chối
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Job Detail Modal */}
      {showJobDetail && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold text-gray-900">{selectedJob.title}</h3>
                <button
                  onClick={() => setShowJobDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Job Info */}
              <div className="space-y-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Thông tin cơ bản</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Trạng thái:</span>
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                        selectedJob.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        selectedJob.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        selectedJob.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedJob.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Loại hình:</span>
                      <span className="ml-2 font-medium">{getJobTypeLabel(selectedJob.jobType)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Địa điểm:</span>
                      <span className="ml-2 font-medium">
                        {selectedJob.districtNameSnapshot && selectedJob.provinceNameSnapshot
                          ? `${selectedJob.districtNameSnapshot}, ${selectedJob.provinceNameSnapshot}`
                          : selectedJob.provinceNameSnapshot || selectedJob.location}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Mức lương:</span>
                      <span className="ml-2 font-medium">
                        {typeof selectedJob.salary === 'number' 
                          ? `${selectedJob.salary.toLocaleString()} ${selectedJob.currency || 'VND'}`
                          : selectedJob.salary}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Kinh nghiệm:</span>
                      <span className="ml-2 font-medium">{getExperienceLevelLabel(selectedJob.experienceLevel) || 'Không yêu cầu'}</span>
                    </div>
                    {selectedJob.addressLine && (
                      <div className="col-span-2">
                        <span className="text-gray-600">Địa chỉ cụ thể:</span>
                        <span className="ml-2 font-medium">{selectedJob.addressLine}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Mô tả công việc</h4>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{selectedJob.description}</p>
                </div>

                {selectedJob.skills && (() => {
                  const skills = Array.isArray(selectedJob.skills) 
                    ? selectedJob.skills 
                    : typeof selectedJob.skills === 'string' 
                      ? JSON.parse(selectedJob.skills) 
                      : [];
                  return skills.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Kỹ năng yêu cầu</h4>
                      <div className="flex flex-wrap gap-2">
                        {skills.map((skill: string, index: number) => (
                          <span key={index} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {selectedJob.images && selectedJob.images.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Ảnh minh họa:</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedJob.images.map((image: any) => (
                        <img
                          key={image.id}
                          src={`${import.meta.env.VITE_JOB_API_BASE_URL?.replace('/api', '') || 'http://localhost:3002'}${image.filePath}`}
                          alt="Job"
                          className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80"
                          onClick={() => window.open(`${import.meta.env.VITE_JOB_API_BASE_URL?.replace('/api', '') || 'http://localhost:3002'}${image.filePath}`, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selectedJob.document && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Tài liệu đính kèm:</h4>
                    <a
                      href={`${import.meta.env.VITE_JOB_API_BASE_URL?.replace('/api', '') || 'http://localhost:3002'}${selectedJob.document.filePath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                    >
                      📄 {selectedJob.document.originalName}
                    </a>
                  </div>
                )}
              </div>

              {/* Employer Info */}
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3">Thông tin nhà tuyển dụng</h4>
                
                {/* Basic info from job data - always show */}
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="text-gray-600 font-medium">ID nhà tuyển dụng:</span>
                      <span className="ml-2 text-gray-900 font-mono text-xs">{selectedJob.employerId}</span>
                    </div>
                    {selectedJob.employerEmail && (
                      <div>
                        <span className="text-gray-600 font-medium">Email:</span>
                        <span className="ml-2 text-gray-900">{selectedJob.employerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed info from API */}
                {selectedJob.loadingEmployer ? (
                  <div className="bg-blue-50 rounded-lg p-4 text-center text-blue-700">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    Đang tải thông tin chi tiết...
                  </div>
                ) : selectedJob.employerDetails ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                    {selectedJob.employerDetails.employerProfile && (
                      <>
                        <div className="border-t pt-3 mt-3">
                          <span className="text-gray-600 font-medium">Tên công ty:</span>
                          <div className="mt-1 font-semibold text-gray-900">{selectedJob.employerDetails.employerProfile.companyName || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Địa chỉ công ty:</span>
                          <div className="mt-1">{selectedJob.employerDetails.employerProfile.headquartersLocation || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Email liên hệ:</span>
                          <div className="mt-1">{selectedJob.employerDetails.employerProfile.contactEmail || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">SĐT liên hệ:</span>
                          <div className="mt-1">{selectedJob.employerDetails.employerProfile.contactPhone || 'N/A'}</div>
                        </div>
                        {selectedJob.employerDetails.employerProfile.companyWebsite && (
                          <div>
                            <span className="text-gray-600 font-medium">Website:</span>
                            <div className="mt-1">
                              <a 
                                href={selectedJob.employerDetails.employerProfile.companyWebsite.startsWith('http') 
                                  ? selectedJob.employerDetails.employerProfile.companyWebsite 
                                  : `https://${selectedJob.employerDetails.employerProfile.companyWebsite}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700 underline"
                              >
                                {selectedJob.employerDetails.employerProfile.companyWebsite}
                              </a>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="border-t pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-gray-600 font-medium">Tài khoản employer:</span>
                          <div className="mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              selectedJob.employerDetails.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                              selectedJob.employerDetails.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {selectedJob.employerDetails.status}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-600 font-medium">Duyệt employer:</span>
                          <div className="mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              selectedJob.employerDetails.approvalStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                              selectedJob.employerDetails.approvalStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {selectedJob.employerDetails.approvalStatus}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500 italic">
                        * Đây là trạng thái tài khoản nhà tuyển dụng, không phải trạng thái tin tuyển dụng
                      </div>
                    </div>
                    
                    <div className="border-t pt-3 mt-3 text-xs text-gray-500">
                      <div>ID: {selectedJob.employerId}</div>
                      <div>Ngày đăng tin: {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}</div>
                      {selectedJob.updatedAt && (
                        <div>Cập nhật lần cuối: {new Date(selectedJob.updatedAt).toLocaleString('vi-VN')}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <p className="text-yellow-700 mb-2 font-medium">⚠️ Không thể tải thông tin chi tiết nhà tuyển dụng</p>
                    <div className="text-sm space-y-1">
                      <div className="text-gray-700">
                        <span className="font-medium">ID:</span> {selectedJob.employerId}
                      </div>
                      {selectedJob.employerEmail && (
                        <div className="text-gray-700">
                          <span className="font-medium">Email:</span> {selectedJob.employerEmail}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-yellow-200 text-xs text-gray-600">
                        Vui lòng kiểm tra Console (F12) để xem lỗi chi tiết
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Dates and Timeline */}
              <div className="border-t pt-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Ngày tạo:</span>
                    <div>{new Date(selectedJob.createdAt).toLocaleString('vi-VN')}</div>
                  </div>
                  {selectedJob.publishedAt && (
                    <div>
                      <span className="font-medium">Ngày đăng:</span>
                      <div>{new Date(selectedJob.publishedAt).toLocaleString('vi-VN')}</div>
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Cập nhật lần cuối:</span>
                    <div>{new Date(selectedJob.updatedAt).toLocaleString('vi-VN')}</div>
                  </div>
                  {selectedJob.deletedAt && (
                    <div>
                      <span className="font-medium text-red-600">Ngày xóa:</span>
                      <div className="text-red-600">{new Date(selectedJob.deletedAt).toLocaleString('vi-VN')}</div>
                    </div>
                  )}
                </div>
              </div>

              {selectedJob.approvalLogs && selectedJob.approvalLogs.length > 0 && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold text-gray-900 mb-2">Lịch sử duyệt tin:</h4>
                  <div className="space-y-2">
                    {selectedJob.approvalLogs.map((log: any) => (
                      <div key={log.id} className="bg-gray-50 rounded p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.action === 'ADMIN_APPROVED' || log.action === 'AUTO_APPROVED' ? 'bg-green-100 text-green-800' :
                            log.action === 'REJECTED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action}
                          </span>
                          <span className="text-gray-500">{new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                        {log.note && (
                          <div className="mt-2 text-gray-700">{log.note}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-6">
                {selectedJob.status === 'PENDING' && (
                  <>
                    <Button onClick={() => { handleApprove(selectedJob.id); setShowJobDetail(false) }}>
                      Duyệt tin này
                    </Button>
                    <Button variant="outline" onClick={() => { handleReject(selectedJob.id); setShowJobDetail(false) }}>
                      Từ chối
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={() => setShowJobDetail(false)}>
                  Đóng
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Employer Detail Modal */}
      {selectedEmployer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedEmployer.employerProfile?.companyName || 'Thông tin nhà tuyển dụng'}
                </h2>
                <button
                  onClick={() => setSelectedEmployer(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Thông tin tài khoản</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                    <p><span className="font-medium">Email:</span> {selectedEmployer.email}</p>
                    <p><span className="font-medium">Số điện thoại:</span> {selectedEmployer.phoneNumber}</p>
                    <p>
                      <span className="font-medium">Email đã xác minh:</span>{' '}
                      {selectedEmployer.emailVerified ? '✓ Đã xác minh' : '✗ Chưa xác minh'}
                    </p>
                    <p>
                      <span className="font-medium">Đăng ký lúc:</span>{' '}
                      {new Date(selectedEmployer.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>

                {selectedEmployer.employerProfile && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Thông tin công ty</h3>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                      <p><span className="font-medium">Tên công ty:</span> {selectedEmployer.employerProfile.companyName}</p>
                      <p><span className="font-medium">Địa chỉ:</span> {selectedEmployer.employerProfile.headquartersLocation || 'Chưa cập nhật'}</p>
                      <p><span className="font-medium">Email liên hệ:</span> {selectedEmployer.employerProfile.contactEmail || 'Chưa cập nhật'}</p>
                      <p><span className="font-medium">SĐT liên hệ:</span> {selectedEmployer.employerProfile.contactPhone || 'Chưa cập nhật'}</p>
                      {selectedEmployer.employerProfile.companyWebsite && (
                        <p>
                          <span className="font-medium">Website:</span>{' '}
                          <a
                            href={selectedEmployer.employerProfile.companyWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-600 hover:underline"
                          >
                            {selectedEmployer.employerProfile.companyWebsite}
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => handleApproveEmployer(selectedEmployer.id)}
                    isLoading={actionLoading}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    ✓ Duyệt
                  </Button>
                  <Button
                    onClick={() => handleRejectEmployer(selectedEmployer.id)}
                    isLoading={actionLoading}
                    variant="outline"
                    className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                  >
                    ✗ Từ chối
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { jobService } from '../services/jobService'
import type { Application } from '../services/jobService'
import { chatService } from '../services/chatService'
import Button from '../components/Button'
import { MessageCircle } from 'lucide-react'
import ParsedCvDisplay from '../components/ParsedCvDisplay'
import CvDetailModal from '../components/CvDetailModal'

// Helper to get parsed cvSnapshot
const getParsedCvSnapshot = (app: Application) => {
  if (!app.cvSnapshot) return null
  
  let snapshot = app.cvSnapshot
  
  // If it's a string, parse it first
  if (typeof snapshot === 'string') {
    try {
      snapshot = JSON.parse(snapshot)
    } catch {
      return null
    }
  }
  
  // Check if it's a malformed object with numeric keys
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const keys = Object.keys(snapshot)
    
    // If ALL keys are numeric, it's malformed - reconstruct the string
    if (keys.length > 0 && keys.every((k) => !isNaN(Number(k)))) {
      try {
        // Reconstruct string from numeric keys
        const str = keys.sort((a, b) => Number(a) - Number(b)).map((k) => (snapshot as any)[k]).join('')
        // Parse the reconstructed string
        const parsed = JSON.parse(str)
        return parsed
      } catch {
        return null
      }
    }
  }
  
  return snapshot
}

export default function Applications() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingChat, setCreatingChat] = useState<string | null>(null)
  const [cvDetailModal, setCvDetailModal] = useState<{
    isOpen: boolean
    parsedFields: any
    candidateName?: string
    pdfUrl?: string
  }>({
    isOpen: false,
    parsedFields: null,
  })

  useEffect(() => {
    if (jobId) {
      loadApplications()
    }
  }, [jobId])

  const loadApplications = async () => {
    if (!jobId) return

    try {
      setLoading(true)
      const data = await jobService.getJobApplications(jobId)
      console.log('Applications data:', data)
      
      // Parse cvSnapshot if it's a string
      const parsedApplications = (data.data || []).map((app: Application) => {
        if (typeof app.cvSnapshot === 'string') {
          try {
            return {
              ...app,
              cvSnapshot: JSON.parse(app.cvSnapshot)
            }
          } catch (e) {
            console.error('Failed to parse cvSnapshot:', e)
            return app
          }
        }
        return app
      })
      
      console.log('Parsed applications:', parsedApplications)
      setApplications(parsedApplications)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải danh sách ứng viên')
    } finally {
      setLoading(false)
    }
  }

  const handleStartChat = async (candidateId: string) => {
    if (!jobId) return

    setCreatingChat(candidateId)
    try {
      const response = await chatService.createConversation({
        participantId: candidateId,
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

  const handleViewCvDetail = (app: Application) => {
    const parsedCv = getParsedCvSnapshot(app)
    setCvDetailModal({
      isOpen: true,
      parsedFields: parsedCv,
      candidateName: parsedCv?.fullName || (app as any).candidateName || 'Ứng viên',
      pdfUrl: (app as any).cvDownloadUrl 
        ? `${import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'}${(app as any).cvDownloadUrl}`
        : undefined,
    })
  }

  const handleDecision = async (applicationId: string, decision: 'ACCEPTED' | 'REJECTED') => {
    if (!jobId) return
    
    let note = ''
    
    if (decision === 'REJECTED') {
      // Show reasons for rejection
      const reasons = [
        'Kinh nghiệm chưa phù hợp',
        'Kỹ năng chưa đáp ứng yêu cầu',
        'Trình độ học vấn chưa đủ',
        'CV không rõ ràng',
        'Không phù hợp với văn hóa công ty',
        'Đã tìm được ứng viên phù hợp hơn',
        'Lý do khác (nhập thủ công)',
      ]
      
      const selectedReason = prompt(
        'Chọn lý do từ chối:\n\n' + 
        reasons.map((r, i) => `${i + 1}. ${r}`).join('\n') + 
        '\n\nNhập số (1-7) hoặc nhập lý do tùy chỉnh:'
      )
      
      if (!selectedReason) return
      
      const reasonIndex = parseInt(selectedReason)
      
      if (reasonIndex >= 1 && reasonIndex <= 6) {
        note = reasons[reasonIndex - 1]
      } else if (reasonIndex === 7) {
        note = prompt('Nhập lý do từ chối (tối thiểu 10 ký tự):') || ''
        if (!note || note.trim().length < 10) {
          alert('Lý do từ chối phải có ít nhất 10 ký tự')
          return
        }
      } else {
        note = selectedReason
      }
      
      // Final validation for custom reason
      if (note.trim().length < 10) {
        alert('Lý do từ chối phải có ít nhất 10 ký tự')
        return
      }
    } else {
      if (!confirm('Bạn có chắc muốn chấp nhận ứng viên này?')) return
    }

    try {
      await jobService.decideApplication(jobId, applicationId, decision, note)
      loadApplications()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Thao tác thất bại')
    }
  }

  const handleViewCV = async (cvDownloadUrl: string, expiresAt?: string) => {
    // Check if token expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      console.log('Token expired, reloading applications...')
      await loadApplications()
      alert('Link đã hết hạn, vui lòng thử lại')
      return
    }

    // Build full URL (same as Profile page)
    const baseUrl = import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'
    const url = `${baseUrl}${cvDownloadUrl}`
    
    console.log('Opening CV:', { cvDownloadUrl, baseUrl, fullUrl: url })
    
    window.open(url, '_blank')
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate('/employer/jobs')}
        className="text-primary-600 hover:text-primary-700 mb-6 flex items-center"
      >
        ← Quay lại danh sách công việc
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-8">Danh Sách Ứng Viên</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {applications.map((app) => {
          const parsedCv = getParsedCvSnapshot(app);
          console.log('Application CV data:', {
            appId: app.id,
            hasCvSnapshot: !!app.cvSnapshot,
            parsedCv: parsedCv,
            hasAiSummary: !!parsedCv?.aiSummary,
            aiSummary: parsedCv?.aiSummary
          });
          
          return (
          <div key={app.id} className="bg-white rounded-lg shadow-md p-6">
            {/* Header với tên và action buttons */}
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                {(app as any).candidateName || parsedCv?.fullName || (app as any).candidate?.fullName || `Ứng viên #${app.candidateId.slice(0, 8)}`}
              </h3>
              <div className="flex gap-2 flex-shrink-0 ml-4">
                {app.cvStatus === 'PENDING' && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleDecision(app.id, 'ACCEPTED')}
                    >
                      Chấp nhận
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecision(app.id, 'REJECTED')}
                    >
                      Từ chối
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartChat(app.candidateId)}
                  isLoading={creatingChat === app.candidateId}
                  className="flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </Button>
              </div>
            </div>

            {/* Content */}
            <div>
                
                {/* AI Summary - Hiển thị nổi bật */}
                {parsedCv?.aiSummary && (
                  <div className="mb-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-2xl flex-shrink-0">🎯</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-green-900 mb-2">Đánh giá nhanh từ AI:</p>
                        <p className="text-base font-medium text-gray-800 leading-relaxed">
                          {parsedCv.aiSummary}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Debug: Show if CV has no AI Summary */}
                {parsedCv && !parsedCv.aiSummary && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      ℹ️ CV này chưa có đánh giá từ AI. Có thể CV được upload trước khi tính năng AI được thêm vào.
                    </p>
                  </div>
                )}
                
                <div className="text-sm text-gray-600 space-y-1">
                  {((app as any).candidateEmail || getParsedCvSnapshot(app)?.email) && (
                    <p>📧 {(app as any).candidateEmail || getParsedCvSnapshot(app)?.email}</p>
                  )}
                  {((app as any).candidatePhone || getParsedCvSnapshot(app)?.phoneNumber) && (
                    <p>📱 {(app as any).candidatePhone || getParsedCvSnapshot(app)?.phoneNumber}</p>
                  )}
                  {(app as any).candidateAddress && <p>📍 {(app as any).candidateAddress}</p>}
                  <p>📅 Ngày ứng tuyển: {new Date(app.createdAt).toLocaleDateString('vi-VN')}</p>
                  
                  {/* Hiển thị CV đã phân tích bởi AI */}
                  {(app as any).cvDownloadUrl ? (
                    <div className="mt-3">
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M4 18h12V6h-4V2H4v16zm-2 1V0h10l4 4v16H2v-1z"/>
                            </svg>
                            <div>
                              <p className="font-semibold text-gray-900">📄 CV đã upload (PDF)</p>
                              <p className="text-xs text-gray-600">Đã phân tích bởi AI</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleViewCV((app as any).cvDownloadUrl, (app as any).cvDownloadUrlExpiresAt)}
                            >
                              Xem PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Chỉ hiển thị nút xem chi tiết, không hiển thị ParsedCvDisplay */}
                      {getParsedCvSnapshot(app) && (
                        <div className="mt-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewCvDetail(app)}
                            className="w-full"
                          >
                            📋 Xem chi tiết đầy đủ
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Fallback: Hiển thị CV snapshot từ lúc ứng tuyển (nếu có) */
                    <>
                      {getParsedCvSnapshot(app) ? (
                        <div className="mt-3">
                          <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                            ⚠️ CV từ lúc ứng tuyển (không có file PDF)
                          </div>
                          <ParsedCvDisplay parsedFields={getParsedCvSnapshot(app)!} compact={true} />
                          <div className="mt-3 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewCvDetail(app)}
                              className="w-full"
                            >
                              📋 Xem chi tiết đầy đủ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 p-3 bg-gray-100 rounded text-sm text-gray-600">
                          Ứng viên chưa cung cấp thông tin CV
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    app.cvStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    app.cvStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {app.cvStatus === 'APPROVED' ? 'Đã chấp nhận' :
                     app.cvStatus === 'REJECTED' ? 'Đã từ chối' :
                     'Chờ xét duyệt'}
                  </span>
                  {app.cvReviewedAt && (
                    <span className="text-xs text-gray-500">
                      • Xét duyệt: {new Date(app.cvReviewedAt).toLocaleDateString('vi-VN')}
                    </span>
                  )}
                </div>
              {app.cvDecisionNote && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="font-medium text-sm text-yellow-900 mb-1">Ghi chú:</p>
                  <p className="text-sm text-yellow-800">{app.cvDecisionNote}</p>
                </div>
              )}
            </div>
          </div>
        )})}
      </div>

      {applications.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Chưa có ứng viên nào</p>
        </div>
      )}

      {/* CV Detail Modal */}
      <CvDetailModal
        isOpen={cvDetailModal.isOpen}
        onClose={() => setCvDetailModal({ isOpen: false, parsedFields: null })}
        parsedFields={cvDetailModal.parsedFields}
        candidateName={cvDetailModal.candidateName}
        pdfUrl={cvDetailModal.pdfUrl}
      />
    </div>
  )
}

import { useState, useEffect } from 'react'
import { cvService, type CvInfo } from '../services/cvService'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'

export default function CVManagement() {
  const { user } = useAuthStore()
  const [cvInfo, setCvInfo] = useState<CvInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadCv()
  }, [])

  // Auto-refresh when CV is being processed
  useEffect(() => {
    if (cvInfo && (cvInfo.status === 'PENDING' || cvInfo.status === 'PARSING')) {
      const interval = setInterval(() => {
        loadCv()
      }, 3000) // Refresh every 3 seconds

      return () => clearInterval(interval)
    }
  }, [cvInfo?.status])

  const loadCv = async () => {
    try {
      setLoading(true)
      const response = await cvService.getMyCv()
      setCvInfo(response.data)
      setError('') // Clear any previous errors
    } catch (err: any) {
      // 404 means no CV uploaded yet - this is normal
      if (err.response?.status === 404) {
        setCvInfo(null)
        return
      }
      
      // 401 means token expired
      if (err.response?.status === 401) {
        setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
        return
      }
      
      // Other errors
      setError(err.response?.data?.message || 'Không thể tải CV')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user?.id) return

    // Validate file type
    if (file.type !== 'application/pdf') {
      setError('Chỉ chấp nhận file PDF')
      e.target.value = ''
      return
    }

    // Validate file size (25MB)
    const maxSize = 25 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File quá lớn. Kích thước tối đa là 25 MB')
      e.target.value = ''
      return
    }

    // Confirm if replacing existing CV
    if (cvInfo) {
      if (!confirm('Bạn có chắc muốn thay thế CV hiện tại? CV cũ sẽ bị xóa vĩnh viễn.')) {
        e.target.value = ''
        return
      }
    }

    setError('')
    setSuccess('')
    setUploading(true)

    try {
      // Delete old CV if exists
      if (cvInfo) {
        await cvService.deleteMyCv()
      }

      // Upload new CV
      await cvService.uploadCv(file, user.id)
      setSuccess('Upload CV thành công! AI đang phân tích CV của bạn...')
      
      // Reload CV info after a short delay to show processing status
      setTimeout(() => {
        loadCv()
      }, 1000)
      
      e.target.value = ''
    } catch (err: any) {
      setError(err.response?.data?.message || 'Upload CV thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    const confirmMessage = 
      '⚠️ BẠN CÓ CHẮC MUỐN XÓA CV NÀY?\n\n' +
      '❌ File CV PDF sẽ bị xóa vĩnh viễn\n' +
      '❌ Phân tích AI sẽ bị xóa\n' +
      '❌ Tất cả thông tin CV sẽ mất\n\n' +
      'Bạn sẽ cần upload lại CV mới nếu muốn ứng tuyển.'
    
    if (!confirm(confirmMessage)) return

    try {
      await cvService.deleteMyCv()
      setSuccess('Xóa CV thành công! Bạn có thể upload CV mới.')
      setCvInfo(null)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Xóa CV thất bại')
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Quản Lý CV</h1>

      {/* Global error message */}
      {error && !cvInfo && (
        <div className="bg-red-50 border-2 border-red-200 text-red-700 px-6 py-4 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold mb-1">Lỗi tải CV</p>
              <p className="text-sm">{error}</p>
              {error.includes('đăng nhập') && (
                <button
                  onClick={() => window.location.href = '/login'}
                  className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Đăng nhập lại
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {cvInfo ? 'Thay thế CV' : 'Upload CV mới'}
        </h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {cvInfo && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Lưu ý:</strong> Upload CV mới sẽ thay thế CV hiện tại. CV cũ sẽ bị xóa vĩnh viễn.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleUpload}
              disabled={uploading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {uploading && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span>Đang upload...</span>
              </div>
            )}
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>📄 Chỉ chấp nhận file PDF</p>
            <p>📏 Kích thước tối đa: 25 MB</p>
            <p>🤖 AI sẽ tự động phân tích CV sau khi upload thành công</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">CV của bạn</h2>

        {cvInfo ? (
          <div className="space-y-4">
            {/* Header với nút Xem và Xóa */}
            <div className="flex justify-between items-start p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 mb-2">CV đã upload</h3>
                <div className="space-y-1">
                  <p className="text-sm text-gray-600">
                    📄 Kích thước: {(cvInfo.fileSize / 1024).toFixed(2)} KB
                  </p>
                  <p className="text-sm text-gray-600">
                    📅 Upload: {new Date(cvInfo.uploadedAt).toLocaleDateString('vi-VN')}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      cvInfo.status === 'PARSED' ? 'bg-green-100 text-green-800' :
                      cvInfo.status === 'PARSING' ? 'bg-blue-100 text-blue-800' :
                      cvInfo.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {cvInfo.status === 'PARSED' && '✅ Đã xử lý'}
                      {cvInfo.status === 'PARSING' && (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800"></div>
                          Đang phân tích...
                        </>
                      )}
                      {cvInfo.status === 'PENDING' && (
                        <>
                          <div className="animate-pulse">⏳</div>
                          Chờ xử lý
                        </>
                      )}
                      {cvInfo.status === 'FAILED' && '❌ Lỗi'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <a
                  href={`${import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'}${cvInfo.downloadUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📥 Xem CV
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDelete}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  🗑️ Xóa
                </Button>
              </div>
            </div>

            {/* Error message */}
            {cvInfo.errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900">❌ Lỗi:</p>
                <p className="text-sm text-red-700 mt-1">{cvInfo.errorMessage}</p>
              </div>
            )}

            {/* Parsed fields */}
            {cvInfo.parsedFields && (
              <div className="space-y-4">
                  {/* AI Summary - Tóm tắt ngắn gọn */}
                  {cvInfo.parsedFields.aiSummary && (
                    <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">🎯</span>
                        <div className="flex-1">
                          <p className="font-semibold text-green-900 mb-2">Đánh giá nhanh từ AI:</p>
                          <p className="text-base font-medium text-gray-800 leading-relaxed">
                            {cvInfo.parsedFields.aiSummary}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Feedback - Đánh giá chi tiết */}
                  {cvInfo.parsedFields.aiFeedback && (
                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg">
                      <div className="flex items-start gap-2">
                        <span className="text-2xl">🤖</span>
                        <div className="flex-1">
                          <p className="font-semibold text-purple-900 mb-2">Đánh giá chi tiết từ AI:</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {cvInfo.parsedFields.aiFeedback}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Thông tin cơ bản */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-3">📋 Thông tin cơ bản:</p>
                    <div className="text-sm text-blue-800 space-y-2">
                      {cvInfo.parsedFields.fullName && (
                        <p className="flex items-center gap-2">
                          <span className="font-medium">👤 Họ tên:</span>
                          <span>{cvInfo.parsedFields.fullName}</span>
                        </p>
                      )}
                      {cvInfo.parsedFields.email && (
                        <p className="flex items-center gap-2">
                          <span className="font-medium">📧 Email:</span>
                          <span>{cvInfo.parsedFields.email}</span>
                        </p>
                      )}
                      {(cvInfo.parsedFields.phone || cvInfo.parsedFields.phoneNumber) && (
                        <p className="flex items-center gap-2">
                          <span className="font-medium">📱 Số điện thoại:</span>
                          <span>{cvInfo.parsedFields.phone || cvInfo.parsedFields.phoneNumber}</span>
                        </p>
                      )}
                      {cvInfo.parsedFields.yearsExperience !== undefined && (
                        <p className="flex items-center gap-2">
                          <span className="font-medium">💼 Kinh nghiệm:</span>
                          <span className="px-2 py-1 bg-blue-200 rounded font-semibold">
                            {cvInfo.parsedFields.yearsExperience} năm
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Mục tiêu nghề nghiệp */}
                  {cvInfo.parsedFields.objective && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm font-semibold text-green-900 mb-2">🎯 Mục tiêu nghề nghiệp:</p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {cvInfo.parsedFields.objective}
                      </p>
                    </div>
                  )}

                  {/* Tóm tắt */}
                  {cvInfo.parsedFields.summary && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm font-semibold text-amber-900 mb-2">📝 Tóm tắt:</p>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {cvInfo.parsedFields.summary}
                      </p>
                    </div>
                  )}

                  {/* Kỹ năng */}
                  {cvInfo.parsedFields.skills && cvInfo.parsedFields.skills.length > 0 && (
                    <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <p className="text-sm font-semibold text-indigo-900 mb-3">🔧 Kỹ năng:</p>
                      <div className="flex flex-wrap gap-2">
                        {cvInfo.parsedFields.skills.map((skill, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-indigo-200 text-indigo-900 rounded-full text-sm font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Học vấn */}
                  {cvInfo.parsedFields.education && cvInfo.parsedFields.education.length > 0 && (
                    <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                      <p className="text-sm font-semibold text-cyan-900 mb-3">🎓 Học vấn:</p>
                      <div className="space-y-3">
                        {cvInfo.parsedFields.education.map((edu, idx) => (
                          <div key={idx} className="p-3 bg-white rounded border-l-4 border-cyan-500">
                            {edu.degree && (
                              <p className="font-medium text-gray-900">{edu.degree}</p>
                            )}
                            {edu.institution && (
                              <p className="text-sm text-gray-700 mt-1">🏫 {edu.institution}</p>
                            )}
                            {edu.graduationYear && (
                              <p className="text-sm text-gray-600 mt-1">📅 Năm tốt nghiệp: {edu.graduationYear}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kinh nghiệm làm việc */}
                  {cvInfo.parsedFields.experience && cvInfo.parsedFields.experience.length > 0 && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-sm font-semibold text-emerald-900 mb-3">💼 Kinh nghiệm làm việc:</p>
                      <div className="space-y-3">
                        {cvInfo.parsedFields.experience.map((exp, idx) => (
                          <div key={idx} className="p-3 bg-white rounded border-l-4 border-emerald-500">
                            {exp.position && (
                              <p className="font-medium text-gray-900">{exp.position}</p>
                            )}
                            {exp.company && (
                              <p className="text-sm text-gray-700 mt-1">🏢 {exp.company}</p>
                            )}
                            {exp.duration && (
                              <p className="text-sm text-gray-600 mt-1">📅 {exp.duration}</p>
                            )}
                            {exp.description && (
                              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{exp.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chứng chỉ */}
                  {cvInfo.parsedFields.certificates && cvInfo.parsedFields.certificates.length > 0 && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                      <p className="text-sm font-semibold text-rose-900 mb-3">🏆 Chứng chỉ:</p>
                      <div className="flex flex-wrap gap-2">
                        {cvInfo.parsedFields.certificates.map((cert, idx) => (
                          <span key={idx} className="px-3 py-1.5 bg-rose-200 text-rose-900 rounded-full text-sm font-medium">
                            {cert}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Hoạt động */}
                  {cvInfo.parsedFields.activities && cvInfo.parsedFields.activities.length > 0 && (
                    <div className="p-4 bg-violet-50 border border-violet-200 rounded-lg">
                      <p className="text-sm font-semibold text-violet-900 mb-3">🎭 Hoạt động:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {cvInfo.parsedFields.activities.map((activity, idx) => (
                          <li key={idx} className="text-sm text-gray-700">{activity}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
          </div>
        ) : (
          <p className="text-center text-gray-600 py-8">
            Bạn chưa upload CV
          </p>
        )}
      </div>
    </div>
  )
}

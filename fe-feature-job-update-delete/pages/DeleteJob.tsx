/**
 * BRANCH: feature/job-update-delete
 * Feature: Xóa tin tuyển dụng
 * Cho phép employer xóa tin việc làm
 */

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { jobService } from '../services/jobService'
import Button from '../components/Button'

export default function DeleteJob() {
  const navigate = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    try {
      await jobService.deleteJob(jobId!)
      navigate('/employer/jobs')
    } catch (err: any) {
      console.error('Delete job error:', err)
      setError(err.response?.data?.message || 'Xóa tin tuyển dụng thất bại')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        {!confirmDelete ? (
          <div className="text-center">
            <div className="mb-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Xóa tin tuyển dụng</h2>
            <p className="text-gray-600 mb-6">
              Bạn chắc chắn muốn xóa tin tuyển dụng này? Hành động này không thể hoàn tác.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Xóa
              </button>
              <button
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Xác nhận xóa</h2>
            <p className="text-gray-600 mb-6">
              Đây là thao tác xóa cuối cùng. Nếu bạn tiếp tục, tin tuyển dụng sẽ bị xóa vĩnh viễn.
            </p>

            <div className="flex gap-4">
              <Button
                onClick={handleDelete}
                isLoading={loading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Xác nhận xóa
              </Button>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={loading}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { jobService } from '../services/jobService'
import type { Job } from '../services/jobService'
import Button from '../components/Button'
import { getJobTypeLabel } from '../utils/jobTypeLabels'

export default function EmployerJobs() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const data = await jobService.getMyJobs()
      setJobs(data.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Khong the tai danh sach cong viec')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (jobId: string) => {
    if (!confirm('Ban co chac muon xoa cong viec nay?')) return

    try {
      await jobService.deleteJob(jobId)
      loadJobs()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Xoa that bai')
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Dang tai...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tin tuyen dung</h1>
        <Button onClick={() => navigate('/employer/jobs/create')}>
          + Dang tin tuyen dung
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {jobs.map((job) => (
          <div key={job.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{job.title}</h3>
                <div className="flex gap-4 text-sm text-gray-600 mb-2">
                  <span>Dia diem: {job.provinceNameSnapshot || job.location}</span>
                  <span>Luong: {job.salary}</span>
                  <span>Loai: {getJobTypeLabel(job.jobType)}</span>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    job.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    job.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {job.status}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                {job.status !== 'DELETED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(job.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Xoa
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">Ban chua dang tin tuyen dung nao</p>
        </div>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, CheckCircle, Clock, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { jobService } from '../services/jobService'
import Button from '../components/Button'

export default function Dashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [jobCount, setJobCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        setLoading(true)
        const res = await jobService.getMyJobs()
        const jobs = res.data || []
        if (!isMounted) return
        setJobCount(jobs.length)
        setPendingCount(jobs.filter((job: any) => job.status === 'PENDING').length)
      } catch {
        if (!isMounted) return
        setJobCount(0)
        setPendingCount(0)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const roleLabel = useMemo(() => {
    if (user?.role === 'employer') return 'Nha tuyen dung'
    if (user?.role === 'admin') return 'Quan tri vien'
    return 'Ung vien'
  }, [user?.role])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Chao mung tro lai!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Vai tro</p>
              <p className="text-lg font-semibold text-gray-900">{roleLabel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Trang thai</p>
              <p className="text-lg font-semibold text-green-600">Da xac minh</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tin tuyen dung</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '-' : jobCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Cho duyet</p>
              <p className="text-2xl font-bold text-gray-900">{loading ? '-' : pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">Bat dau voi Job Finder</h2>
          </div>
          <Button onClick={() => navigate('/employer/jobs/create')}>+ Dang tin tuyen dung</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Quan ly tin tuyen dung</h3>
            <p className="text-sm text-gray-600 mb-3">Xem va chinh sua cac tin da dang</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/employer/jobs')}>
              Mo danh sach
            </Button>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Thong tin cong ty</h3>
            <p className="text-sm text-gray-600">Cap nhat profile cong ty (neu co)</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Lien he Admin</h3>
            <p className="text-sm text-gray-600">Can ho tro? Gui email cho admin</p>
            <a
              className="text-sm text-primary-600 hover:underline"
              href="mailto:admin@example.com"
            >
              admin@example.com
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

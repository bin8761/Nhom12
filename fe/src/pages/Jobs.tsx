import { useState, useEffect } from 'react'
import { jobService } from '../services/jobService'
import type { Job, SearchJobsParams } from '../services/jobService'
import { locationService } from '../services/locationService'
import type { Province } from '../services/locationService'
import Button from '../components/Button'
import { getJobTypeLabel } from '../utils/jobTypeLabels'

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [provinces, setProvinces] = useState<Province[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })

  const [filters, setFilters] = useState<SearchJobsParams>({
    page: 1,
    limit: 50,
    q: '',
    provinceCode: '',
    jobType: '',
    salaryMin: undefined,
    salaryMax: undefined,
    sort: 'publishedAt_desc',
  })

  useEffect(() => {
    loadProvinces()
    loadJobs()
  }, [])

  useEffect(() => {
    loadJobs()
  }, [filters.page, filters.sort])

  const loadProvinces = async () => {
    try {
      const response = await locationService.getProvinces()
      setProvinces(response.data)
    } catch (error) {
      console.error('Failed to load provinces:', error)
    }
  }

  const loadJobs = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await jobService.searchPublicJobs(filters)
      setJobs(data.data || [])
      setPagination(data.pagination)
    } catch (err: any) {
      console.error('Error loading jobs:', err)
      setJobs([])
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'KhĂ´ng thá»ƒ táº£i danh sĂ¡ch cĂ´ng viá»‡c')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters((prev) => ({ ...prev, page: 1 }))
    loadJobs()
  }

  const handleReset = () => {
    setFilters({
      page: 1,
      limit: 50,
      q: '',
      provinceCode: '',
      jobType: '',
      salaryMin: undefined,
      salaryMax: undefined,
      sort: 'publishedAt_desc',
    })
    loadJobs()
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Äang táº£i...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">TĂ¬m Viá»‡c LĂ m</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="TĂ¬m kiáº¿m theo tá»« khĂ³a..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showFilters ? 'đŸ”¼ áº¨n bá»™ lá»c' : 'đŸ”½ Hiá»‡n bá»™ lá»c'}
              </button>
              <Button type="submit" isLoading={loading}>TĂ¬m kiáº¿m</Button>
            </div>

            {showFilters && (
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={filters.provinceCode}
                    onChange={(e) => setFilters({ ...filters, provinceCode: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Táº¥t cáº£ tá»‰nh/thĂ nh</option>
                    {provinces.map((province) => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <select
                    value={filters.jobType}
                    onChange={(e) => setFilters({ ...filters, jobType: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Táº¥t cáº£ loáº¡i hĂ¬nh</option>
                    <option value="FULL_TIME">ToĂ n thá»i gian</option>
                    <option value="PART_TIME">BĂ¡n thá»i gian</option>
                    <option value="CONTRACT">Há»£p Ä‘á»“ng</option>
                    <option value="INTERN">Thá»±c táº­p</option>
                    <option value="REMOTE">Tá»« xa</option>
                  </select>

                  <input
                    type="number"
                    value={filters.salaryMin || ''}
                    onChange={(e) => setFilters({ ...filters, salaryMin: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="LÆ°Æ¡ng tá»‘i thiá»ƒu"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />

                  <input
                    type="number"
                    value={filters.salaryMax || ''}
                    onChange={(e) => setFilters({ ...filters, salaryMax: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="LÆ°Æ¡ng tá»‘i Ä‘a"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">Sáº¯p xáº¿p:</label>
                  <select
                    value={filters.sort}
                    onChange={(e) => setFilters({ ...filters, sort: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="publishedAt_desc">Má»›i nháº¥t</option>
                    <option value="salary_desc">LÆ°Æ¡ng cao nháº¥t</option>
                    <option value="salary_asc">LÆ°Æ¡ng tháº¥p nháº¥t</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="ml-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Äáº·t láº¡i
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {!loading && (
          <div className="mb-4 text-gray-600">
            TĂ¬m tháº¥y {pagination.total} cĂ´ng viá»‡c
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {jobs.length === 0 && !loading ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 rounded-lg p-8">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 text-lg">KhĂ´ng tĂ¬m tháº¥y cĂ´ng viá»‡c nĂ o</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{job.title}</h3>

                {(job.employerProfile?.companyName || job.employerEmail) && (
                  <div className="mb-3 pb-3 border-b border-gray-100">
                    {job.employerProfile?.companyName && (
                      <div className="text-sm text-gray-700 font-medium mb-1 flex items-center gap-1">
                        <span>đŸ¢</span>
                        <span>{job.employerProfile.companyName}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {job.employerProfile?.contactEmail && (
                        <span className="flex items-center gap-1">
                          <span>đŸ“§</span>
                          <span>{job.employerProfile.contactEmail}</span>
                        </span>
                      )}
                      {job.employerProfile?.companyWebsite && (
                        <span className="flex items-center gap-1">
                          <span>đŸŒ</span>
                          <span className="truncate max-w-[200px]">{job.employerProfile.companyWebsite}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                  <span>đŸ’° {Number(job.salary).toLocaleString()} {job.currency}</span>
                  <span>đŸ“ {job.provinceNameSnapshot || job.location}</span>
                  {job.jobType && <span>đŸ’¼ {getJobTypeLabel(job.jobType)}</span>}
                </div>
                <p className="text-gray-700 line-clamp-2 mb-3">{job.description}</p>
                {job.skills && job.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {job.skills.slice(0, 5).map((skill: string, index: number) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
                disabled={filters.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                TrÆ°á»›c
              </button>
              <span className="px-4 py-2">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
                disabled={filters.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

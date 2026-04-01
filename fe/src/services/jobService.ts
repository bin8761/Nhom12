import jobApi from './jobApi'

export interface Job {
  id: string
  title: string
  slug: string
  description: string
  salary: number | string
  currency?: string
  location: string
  addressLine?: string
  provinceCode?: string
  provinceNameSnapshot?: string
  jobType?: string
  experienceLevel?: string
  status?: string
  skills?: string[]
  publishedAt?: string
  createdAt: string
  updatedAt: string
  employerId: string
  employer?: {
    companyName: string
    email: string
    phone?: string
    address?: string
    website?: string
  }
  employerEmail?: string
  employerProfile?: {
    companyName?: string
    companyWebsite?: string
    contactEmail?: string
  }
  deletedAt?: string
  images?: { id: string; filePath: string; slot: number; createdAt: string }[]
  document?: { id: string; filePath: string; originalName: string; fileSize: number; createdAt: string }
}

export interface SearchJobsParams {
  page?: number
  limit?: number
  q?: string
  provinceCode?: string
  jobType?: string
  salaryMin?: number
  salaryMax?: number
  sort?: 'publishedAt_desc' | 'salary_desc' | 'salary_asc'
}

export const jobService = {
  searchPublicJobs: async (params: SearchJobsParams) => {
    const cleanParams: any = {}
    if (params.page) cleanParams.page = params.page
    if (params.limit) cleanParams.limit = params.limit
    if (params.q?.trim()) cleanParams.q = params.q.trim()
    if (params.provinceCode) cleanParams.provinceCode = params.provinceCode
    if (params.jobType) cleanParams.jobType = params.jobType
    if (params.salaryMin) cleanParams.salaryMin = params.salaryMin
    if (params.salaryMax) cleanParams.salaryMax = params.salaryMax
    if (params.sort) cleanParams.sort = params.sort

    const response = await jobApi.get('/public/jobs/search', { params: cleanParams })
    return response.data
  },

  createJob: async (data: FormData) => {
    const response = await jobApi.post('/jobs', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  getMyJobs: async () => {
    const response = await jobApi.get('/jobs')
    return response.data
  },

  getJobDetail: async (jobId: string) => {
    const response = await jobApi.get(`/jobs/${jobId}`)
    return response.data
  },

  deleteJob: async (jobId: string) => {
    const response = await jobApi.delete(`/jobs/${jobId}`)
    return response.data
  },
}

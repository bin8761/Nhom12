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

export interface Application {
  id: string
  jobId: string
  candidateId: string
  status: 'SUBMITTED' | 'REVIEWED' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN'
  cvFileId?: string
  cvSnapshot?: string | {
    fullName?: string
    email?: string
    phoneNumber?: string
    skills?: string[]
    experience?: Array<{
      company: string
      position?: string
      description?: string
      startDate?: string
      endDate?: string
      current?: boolean
    }>
    education?: Array<{
      institution: string
      degree?: string
      fieldOfStudy?: string
      startDate?: string
      endDate?: string
      current?: boolean
      description?: string
    }>
    certificates?: Array<{
      name: string
      issuer?: string
      issueDate?: string
      expiryDate?: string
      description?: string
    }>
    source?: string
  }
  cvStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  cvDecisionNote?: string
  cvReviewedAt?: string
  createdAt: string
  updatedAt: string
  job?: Job
  candidate?: Candidate
}

export interface Candidate {
  id: string
  email?: string
  fullName?: string
  phoneNumber?: string
  createdAt: string
  updatedAt: string
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
  // Public Jobs
  getPublicJobs: async (params?: { page?: number; limit?: number; search?: string }) => {
    // Loại bỏ params rỗng
    const cleanParams: any = {}
    if (params?.page) cleanParams.page = params.page
    if (params?.limit) cleanParams.limit = params.limit
    if (params?.search && params.search.trim()) cleanParams.search = params.search.trim()
    
    console.log('📡 API call to /public/jobs with params:', cleanParams)
    const response = await jobApi.get('/public/jobs', { params: cleanParams })
    console.log('📥 API response:', response.data)
    return response.data
  },

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

  applyToJob: async (jobId: string, data: { cvFileId?: string }) => {
    const response = await jobApi.post(`/public/jobs/${jobId}/apply`, data)
    return response.data
  },

  // Employer Jobs
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

  getPublicJobDetail: async (jobId: string) => {
    const response = await jobApi.get(`/public/jobs/${jobId}`)
    return response.data
  },

  updateJob: async (jobId: string, data: FormData) => {
    const response = await jobApi.put(`/jobs/${jobId}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  deleteJob: async (jobId: string) => {
    const response = await jobApi.delete(`/jobs/${jobId}`)
    return response.data
  },



  // Applications
  getMyApplications: async () => {
    const response = await jobApi.get('/candidates/me/applications')
    return response.data
  },

  withdrawApplication: async (applicationId: string) => {
    const response = await jobApi.delete(`/candidates/me/applications/${applicationId}`)
    return response.data
  },

  getJobApplications: async (jobId: string) => {
    const response = await jobApi.get(`/jobs/${jobId}/applications`)
    return response.data
  },

  decideApplication: async (jobId: string, applicationId: string, decision: 'ACCEPTED' | 'REJECTED', note?: string) => {
    const response = await jobApi.post(`/jobs/${jobId}/applications/${applicationId}/decision`, {
      cvStatus: decision === 'ACCEPTED' ? 'APPROVED' : 'REJECTED',
      note: note || undefined,
    })
    return response.data
  },

  // Admin
  getPendingJobs: async () => {
    const response = await jobApi.get('/admin/jobs')
    return response.data
  },

  getAllJobs: async (params?: { status?: string; page?: number; limit?: number }) => {
    const response = await jobApi.get('/admin/jobs', { params })
    return response.data
  },

  approveJob: async (jobId: string) => {
    const response = await jobApi.post(`/admin/jobs/${jobId}/approve`)
    return response.data
  },

  rejectJob: async (jobId: string, reason: string) => {
    const response = await jobApi.post(`/admin/jobs/${jobId}/reject`, { note: reason })
    return response.data
  },

  adminDeleteJob: async (jobId: string, reason: string) => {
    const response = await jobApi.delete(`/admin/jobs/${jobId}`, {
      data: { reason }
    })
    return response.data
  },



  // Recommendations
  getRecommendations: async (params?: { limit?: number; sort?: 'publishedAt_desc' | 'salary_desc' | 'salary_asc'; includeGlobal?: boolean }) => {
    const cleanParams: any = {}
    if (params?.limit) cleanParams.limit = params.limit
    if (params?.sort) cleanParams.sort = params.sort
    if (params?.includeGlobal) cleanParams.includeGlobal = 'true'
    // Add timestamp to prevent browser caching
    cleanParams._t = Date.now()

    const response = await jobApi.get('/candidates/me/recommendations', { params: cleanParams })
    return response.data
  },

  // Update candidate location
  updateMyLocation: async (data: { addressLine: string; provinceCode?: string }) => {
    const response = await jobApi.put('/candidates/me/location', data)
    return response.data
  },


}

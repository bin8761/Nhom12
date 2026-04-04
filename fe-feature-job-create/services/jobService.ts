/**
 * BRANCH: feature/job-create
 * Service: Job API calls
 */

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
  jobType?: string
  experienceLevel?: string
  skills?: string[]
  createdAt: string
  updatedAt: string
  employerId: string
}

export const jobService = {
  createJob: async (formData: FormData) => {
    const response = await jobApi.post('/jobs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getJobDetail: async (jobId: string) => {
    const response = await jobApi.get(`/jobs/${jobId}`)
    return response.data
  },

  updateJob: async (jobId: string, formData: FormData) => {
    const response = await jobApi.put(`/jobs/${jobId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  deleteJob: async (jobId: string) => {
    const response = await jobApi.delete(`/jobs/${jobId}`)
    return response.data
  },

  updateMyLocation: async (data: any) => {
    const response = await jobApi.put('/candidates/me/location', data)
    return response.data
  },
}

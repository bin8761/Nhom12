/**
 * BRANCH: feature/job-update-delete
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

  getMyJobs: async () => {
    const response = await jobApi.get('/employers/me/jobs')
    return response.data
  },

  publishJob: async (jobId: string) => {
    const response = await jobApi.put(`/jobs/${jobId}/publish`)
    return response.data
  },

  unpublishJob: async (jobId: string) => {
    const response = await jobApi.put(`/jobs/${jobId}/unpublish`)
    return response.data
  },
}

import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const JOB_API_BASE_URL = import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'

const jobApi = axios.create({
  baseURL: JOB_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
jobApi.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

export interface ParsedEducationEntry {
  institution: string
  degree?: string
  graduationYear?: number
}

export interface ParsedExperienceEntry {
  position?: string
  company?: string
  duration?: string
  description?: string
}

export interface ParsedFields {
  fullName?: string
  email?: string
  phone?: string
  phoneNumber?: string // Alias for backward compatibility
  skills?: string[]
  yearsExperience?: number
  education?: ParsedEducationEntry[]
  experience?: ParsedExperienceEntry[]
  certificates?: string[]
  activities?: string[]
  summary?: string
  objective?: string
  rawText?: string
  aiFeedback?: string
  aiSummary?: string
}

export interface CvInfo {
  cvId: string
  status: 'PENDING' | 'PARSING' | 'PARSED' | 'FAILED'
  parsedFields: ParsedFields | null
  fileSize: number
  mimeType: string
  errorMessage?: string
  uploadedAt: string
  processedAt: string | null
  createdAt: string
  updatedAt: string
  downloadUrl: string
  downloadUrlExpiresAt: string
}

export const cvService = {
  uploadCv: async (file: File, candidateId: string) => {
    const formData = new FormData()
    formData.append('cv', file)

    const response = await jobApi.post(`/candidates/${candidateId}/cv`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  getMyCv: async () => {
    const response = await jobApi.get<{ data: CvInfo }>('/candidates/me/cv')
    return response.data
  },

  deleteMyCv: async () => {
    const response = await jobApi.delete('/candidates/me/cv')
    return response.data
  },
}

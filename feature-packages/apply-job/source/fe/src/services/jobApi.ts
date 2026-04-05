import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const JOB_API_BASE_URL = import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'

console.log('Job API Base URL:', JOB_API_BASE_URL)

export const jobApi = axios.create({
  baseURL: JOB_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor để thêm token
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

// Response interceptor để xử lý lỗi
jobApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const { refreshToken, deviceId } = useAuthStore.getState()
        if (refreshToken) {
          const authApiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'
          const response = await axios.post(`${authApiUrl}/auth/refresh`, {
            refreshToken,
            deviceId,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data.data
          const user = response.data.data.user || useAuthStore.getState().user

          if (user) {
            useAuthStore.getState().setAuth(user, accessToken, newRefreshToken)
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
            return jobApi(originalRequest)
          }
        }
      } catch (refreshError: any) {
        console.error('Refresh token failed:', refreshError)
        useAuthStore.getState().logout()
        
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default jobApi

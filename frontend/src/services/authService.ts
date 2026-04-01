import api from './api'
import { useAuthStore } from '../store/authStore'

export interface RegisterData {
  email: string
  password: string
  role: 'candidate' | 'employer'
  fullName: string
  dateOfBirth: string
  address: string
  phoneNumber: string
  deviceId?: string
}

export interface LoginData {
  email: string
  password: string
  deviceId: string
}

export interface VerifyEmailData {
  email: string
  code: string
}

export interface AuthResponse {
  data: {
    accessToken: string
    refreshToken: string
    tokenType: string
    expiresIn: number
    refreshTokenExpiresIn: number
    user?: {
      id: string
      email: string
      role: 'candidate' | 'employer' | 'admin'
      emailVerified: boolean
    }
  }
}

export const authService = {
  register: async (data: RegisterData) => {
    const deviceId = useAuthStore.getState().deviceId
    const response = await api.post<AuthResponse>('/auth/register', {
      ...data,
      deviceId,
    })
    return response.data
  },

  login: async (data: LoginData) => {
    const deviceId = useAuthStore.getState().deviceId
    const response = await api.post<AuthResponse>('/auth/login', {
      ...data,
      deviceId,
    })

    console.log('Login response:', response.data)

    // If user info is in response, use it
    if (response.data.data.user) {
      console.log('User found in response, setting auth')
      useAuthStore.getState().setAuth(
        response.data.data.user,
        response.data.data.accessToken,
        response.data.data.refreshToken
      )
    } else {
      // Otherwise fetch user info
      console.log('User not in response, fetching from /auth/me')
      try {
        // Temporarily set token to make /auth/me work
        useAuthStore.setState({ 
          accessToken: response.data.data.accessToken,
          refreshToken: response.data.data.refreshToken 
        })
        
        const userResponse = await authService.getMe()
        console.log('User info from /auth/me:', userResponse)
        
        useAuthStore.getState().setAuth(
          userResponse.data,
          response.data.data.accessToken,
          response.data.data.refreshToken
        )
      } catch (error) {
        console.error('Failed to fetch user info:', error)
        throw error
      }
    }

    return response.data
  },

  logout: async () => {
    try {
      const deviceId = useAuthStore.getState().deviceId
      await api.post('/auth/logout', { deviceId })
    } finally {
      useAuthStore.getState().logout()
    }
  },

  verifyEmail: async (data: VerifyEmailData) => {
    const response = await api.post('/auth/verify-email', data)
    return response.data
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/auth/resend-verification', { email })
    return response.data
  },

  getMe: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    })
    return response.data
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email })
    return response.data
  },

  resetPassword: async (email: string, code: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', {
      email,
      code,
      newPassword,
    })
    return response.data
  },

  verifyPhone: async (code: string) => {
    const response = await api.post('/auth/verify-phone', { code })
    return response.data
  },

  resendPhoneOtp: async () => {
    const response = await api.post('/auth/resend-phone-otp')
    return response.data
  },

  refreshToken: async () => {
    const { refreshToken, deviceId } = useAuthStore.getState()
    const response = await api.post<AuthResponse>('/auth/refresh', {
      refreshToken,
      deviceId,
    })
    return response.data
  },
}

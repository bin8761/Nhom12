import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { io, Socket } from 'socket.io-client'

const CHAT_API_BASE_URL = import.meta.env.VITE_CHAT_API_BASE_URL || 'http://localhost:4100/v1'

export const chatApi = axios.create({
  baseURL: CHAT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
chatApi.interceptors.request.use(
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

// Response interceptor
chatApi.interceptors.response.use(
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
            return chatApi(originalRequest)
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

export interface Conversation {
  _id?: string // For backward compatibility
  conversationId?: string // Backend returns this
  participants?: string[]
  jobId?: string
  jobTitle?: string
  employerId?: string
  candidateId?: string
  adminId?: string
  createdBy?: string
  lastReadAt?: Record<string, string> // Track last read time for each participant
  lastMessage?: {
    id?: string
    type?: string
    body?: string
    text?: string
    senderId: string
    senderRole?: string
    createdAt: string
  } | null
  createdAt?: string
  updatedAt: string
}

export interface Message {
  _id?: string // Frontend uses this
  id?: string // Backend returns this
  conversationId: string
  senderId: string
  text?: string // For display (mapped from body)
  body?: string // Backend field
  type?: string
  senderRole?: string
  createdAt: string | Date
  deliveryStatus?: string
}

export interface CreateConversationParams {
  participantId: string
  jobId?: string
}

export interface SendMessageParams {
  body: string // Backend expects 'body' not 'text'
}

let socket: Socket | null = null

export const chatService = {
  // REST API
  createConversation: async (params: CreateConversationParams) => {
    const response = await chatApi.post('/conversations', params)
    return response.data
  },

  getConversations: async () => {
    const response = await chatApi.get<{ items: Conversation[] }>('/conversations')
    // Backend returns { items: [...] } not { data: [...] }
    return { data: response.data.items || [] }
  },

  sendMessage: async (conversationId: string, params: SendMessageParams) => {
    const response = await chatApi.post(`/conversations/${conversationId}/messages`, params)
    return response.data
  },

  getMessages: async (conversationId: string, params?: { page?: number; limit?: number }) => {
    const response = await chatApi.get<{ items: Message[]; hasMore: boolean; nextCursor: string | null }>(
      `/conversations/${conversationId}/messages`,
      { params }
    )
    // Backend returns { items: [...] } not { data: [...] }
    return { data: response.data.items || [], pagination: { hasMore: response.data.hasMore } }
  },

  getUnreadCount: async () => {
    const response = await chatApi.get<{ unreadCount: number }>('/conversations/unread-count')
    return response.data
  },

  markAsRead: async (conversationId: string) => {
    const response = await chatApi.post(`/conversations/${conversationId}/mark-read`)
    return response.data
  },

  // Socket.IO
  connectSocket: (token: string) => {
    if (socket?.connected) {
      return socket
    }

    const socketUrl = import.meta.env.VITE_CHAT_SOCKET_URL || 'http://localhost:4100'
    
    socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket?.id)
    })

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected')
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    return socket
  },

  disconnectSocket: () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  },

  getSocket: () => socket,

  joinConversation: (conversationId: string) => {
    socket?.emit('join_conversation', { conversationId })
  },

  leaveConversation: (conversationId: string) => {
    socket?.emit('leave_conversation', { conversationId })
  },

  onNewMessage: (callback: (message: Message) => void) => {
    socket?.on('new_message', callback)
  },

  offNewMessage: () => {
    socket?.off('new_message')
  },
}

export default chatApi

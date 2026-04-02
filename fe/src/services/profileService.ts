import api from './api'

export interface UserProfile {
  userId: string
  fullName?: string
  phoneNumber?: string
  dateOfBirth?: string
  location?: string
  companyName?: string
  companyIndustry?: string
  companyLocation?: string
  companyWebsite?: string
  // Employer fields
  contactPhone?: string
  industry?: string
  headquartersLocation?: string
}

export const profileService = {
  getMyProfile: async () => {
    const response = await api.get('/users/me/profile')
    return response.data
  },

  updateMyProfile: async (data: Partial<UserProfile>) => {
    const response = await api.put('/users/me/profile', data)
    return response.data
  },
}

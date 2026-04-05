/**
 * BRANCH: feature/user-update-profile
 * Service: Job related API calls used by profile page
 */

import api from './api'

interface UpdateLocationPayload {
  addressLine: string
}

export const jobService = {
  updateMyLocation: async (data: UpdateLocationPayload) => {
    const response = await api.put('/jobs/preferences/location', data)
    return response.data
  },
}

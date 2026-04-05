/**
 * BRANCH: feature/job-update-delete
 * Service: Location API calls
 */

import jobApi from './jobApi'

export interface Province {
  code: string
  name: string
  active: boolean
}

export const locationService = {
  getProvinces: async (): Promise<{ data: Province[] }> => {
    const response = await jobApi.get('/public/locations/provinces')
    return response.data
  },

  searchLocations: async (query: string): Promise<any> => {
    const response = await jobApi.get('/public/locations/suggestions', {
      params: { q: query },
    })
    return response.data
  },
}

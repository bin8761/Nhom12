import jobApi from './jobApi'

export interface Province {
  code: string
  name: string
  active: boolean
}

export interface LocationSuggestion {
  type: 'province'
  code: string
  name: string
}

export const locationService = {
  getProvinces: async (): Promise<{ data: Province[] }> => {
    const response = await jobApi.get('/public/locations/provinces')
    return response.data
  },

  searchLocations: async (query: string): Promise<{ data: LocationSuggestion[] }> => {
    const response = await jobApi.get('/public/locations/suggestions', {
      params: { q: query },
    })
    return response.data
  },
}

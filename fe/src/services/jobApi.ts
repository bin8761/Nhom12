import axios from 'axios'

const JOB_API_BASE_URL = import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3001/api'

export const jobApi = axios.create({
  baseURL: JOB_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default jobApi

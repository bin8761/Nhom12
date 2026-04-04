/**
 * BRANCH: feature/job-update-delete
 * Job API axios instance
 */

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_JOB_API_BASE_URL || 'http://localhost:3002/api'

const jobApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export default jobApi

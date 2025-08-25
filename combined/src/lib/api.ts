import axios from 'axios'

// API client configured for Next.js
// In development and production, uses the same origin API routes
const apiClient = axios.create({
  baseURL: typeof window !== 'undefined' ? window.location.origin : '',
  timeout: 60000, // 60 seconds timeout for API calls
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.baseURL}${config.url}`)
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    if (error.response?.status === 404) {
      console.error('API endpoint not found:', error.config?.url)
    }
    return Promise.reject(error)
  }
)

export default apiClient

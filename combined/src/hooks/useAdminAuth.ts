'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuthentication()
  }, [])

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/admin/session')
      const data = await response.json()
      
      if (response.ok && data.authenticated) {
        setIsAuthenticated(true)
      } else {
        setIsAuthenticated(false)
        router.push('/admin')
      }
    } catch (error) {
      setIsAuthenticated(false)
      router.push('/admin')
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/admin/session', { method: 'DELETE' })
      setIsAuthenticated(false)
      router.push('/admin')
    } catch (error) {
      console.error('Logout failed:', error)
      router.push('/admin')
    }
  }

  return { isAuthenticated, isLoading, logout, checkAuthentication }
}

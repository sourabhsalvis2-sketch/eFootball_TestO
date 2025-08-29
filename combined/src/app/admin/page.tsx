'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TextField, Button, Box, Typography, Paper, CircularProgress, Alert } from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import LoginIcon from '@mui/icons-material/Login'

export default function AdminLogin() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user is already authenticated
    checkAuthentication()
  }, [])

  const checkAuthentication = async () => {
    try {
      const response = await fetch('/api/admin/session')
      const data = await response.json()
      
      if (response.ok && data.authenticated) {
        // User is already authenticated, redirect to dashboard
        router.push('/admin/dashboard')
      }
    } catch (error) {
      // Not authenticated, which is fine for login page
    } finally {
      setCheckingAuth(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: user, password: pass })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        router.push('/admin/dashboard')
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (error) {
      setError('Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '80vh',
          flexDirection: 'column',
          gap: 2
        }}
      >
        <CircularProgress size={40} />
        <Typography variant="h6" sx={{ color: '#b0bec5' }}>
          Checking authentication...
        </Typography>
      </Box>
    )
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '80vh',
        px: 2
      }}
    >
      <Paper 
        elevation={24}
        sx={{
          p: 4,
          maxWidth: 400,
          width: '100%',
          background: 'linear-gradient(135deg, rgba(6,30,60,0.95), rgba(2,8,20,0.98))',
          border: '2px solid rgba(0,229,255,0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(0,229,255,0.1)',
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #00e5ff, #0091ea, #00e5ff)',
            opacity: 0.8,
          }
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SecurityIcon sx={{ fontSize: 48, color: '#00e5ff', mb: 1, filter: 'drop-shadow(0 0 8px rgba(0,229,255,0.6))' }} />
          <Typography 
            variant="h4" 
            sx={{ 
              fontFamily: 'Orbitron', 
              fontWeight: 700, 
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              mb: 1
            }}
          >
            Admin Portal
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: '#b0bec5',
              fontWeight: 500
            }}
          >
            Tournament Management System
          </Typography>
        </Box>
        
        <form onSubmit={submit}>
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 3,
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                border: '1px solid rgba(244, 67, 54, 0.3)',
                color: '#ffffff',
                '& .MuiAlert-icon': {
                  color: '#f44336'
                }
              }}
            >
              {error}
            </Alert>
          )}
          <TextField 
            fullWidth 
            label="Username" 
            value={user} 
            onChange={e => setUser(e.target.value)} 
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.2)',
                '& fieldset': {
                  borderColor: 'rgba(0,229,255,0.3)',
                  borderWidth: '2px',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0,229,255,0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00e5ff',
                  boxShadow: '0 0 10px rgba(0,229,255,0.3)',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#b0bec5',
                '&.Mui-focused': {
                  color: '#00e5ff',
                },
              },
              '& .MuiOutlinedInput-input': {
                color: '#ffffff',
                '&::placeholder': {
                  color: '#b0bec5',
                  opacity: 0.7,
                },
              },
            }} 
          />
          <TextField 
            fullWidth 
            label="Password" 
            type="password" 
            value={pass} 
            onChange={e => setPass(e.target.value)} 
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                backgroundColor: 'rgba(0,0,0,0.2)',
                '& fieldset': {
                  borderColor: 'rgba(0,229,255,0.3)',
                  borderWidth: '2px',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0,229,255,0.5)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00e5ff',
                  boxShadow: '0 0 10px rgba(0,229,255,0.3)',
                },
              },
              '& .MuiInputLabel-root': {
                color: '#b0bec5',
                '&.Mui-focused': {
                  color: '#00e5ff',
                },
              },
              '& .MuiOutlinedInput-input': {
                color: '#ffffff',
                '&::placeholder': {
                  color: '#b0bec5',
                  opacity: 0.7,
                },
              },
            }} 
          />
          <Button 
            variant="contained" 
            type="submit" 
            fullWidth
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 700,
              background: loading ? 'rgba(0,229,255,0.5)' : 'linear-gradient(90deg, #00e5ff, #0091ea)',
              color: '#0b0f16',
              border: '2px solid transparent',
              borderRadius: '8px',
              textTransform: 'none',
              transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                background: loading ? 'rgba(0,229,255,0.5)' : 'linear-gradient(90deg, #00b8d4, #00e5ff)',
                transform: loading ? 'none' : 'translateY(-2px)',
                boxShadow: loading ? 'none' : '0 8px 25px rgba(0,229,255,0.3), 0 0 20px rgba(0,229,255,0.2)',
                border: loading ? '2px solid transparent' : '2px solid rgba(0,229,255,0.6)',
              },
              '&:active': {
                transform: loading ? 'none' : 'translateY(0px)',
              },
              '&.Mui-disabled': {
                color: '#0b0f16',
                opacity: 0.7,
              }
            }}
          >
            {loading ? 'Authenticating...' : 'Access Dashboard'}
          </Button>
        </form>
      </Paper>
    </Box>
  )
}

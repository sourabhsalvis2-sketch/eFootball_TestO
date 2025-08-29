import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('admin-session')

    if (!sessionCookie) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Decode and validate session token
    try {
      const decoded = Buffer.from(sessionCookie.value, 'base64').toString()
      const [username, timestamp] = decoded.split(':')
      
      // Check if session is still valid (24 hours)
      const sessionTime = parseInt(timestamp)
      const now = Date.now()
      const maxAge = 60 * 60 * 24 * 1000 // 24 hours in milliseconds
      
      if (now - sessionTime > maxAge) {
        return NextResponse.json({ authenticated: false }, { status: 401 })
      }

      // Validate username matches environment
      if (username !== process.env.ADMIN_USERNAME) {
        return NextResponse.json({ authenticated: false }, { status: 401 })
      }

      return NextResponse.json({ authenticated: true, username })
    } catch (decodeError) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 500 })
  }
}

// Logout endpoint
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin-session')
  return response
}

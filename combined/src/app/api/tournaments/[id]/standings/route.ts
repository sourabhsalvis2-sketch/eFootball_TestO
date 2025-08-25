import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const tournamentId = parseInt(resolvedParams.id)
    
    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: 'Invalid tournament ID' },
        { status: 400 }
      )
    }

    const standings = await DatabaseService.computeStandings(tournamentId)
    return NextResponse.json(standings)
  } catch (error) {
    console.error('Get standings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch standings' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, Match } from '@/lib/db'

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

    // Get tournament matches
    const matches = await DatabaseService.executeQuery<Match>(
      'SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, id',
      [tournamentId]
    )
    
    return NextResponse.json(matches)
  } catch (error) {
    console.error('Get matches error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournament matches' },
      { status: 500 }
    )
  }
}

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

    const winner = await DatabaseService.getTournamentWinner(tournamentId)
    
    if (!winner) {
      return NextResponse.json(
        { error: 'Tournament not complete or no winner determined' },
        { status: 404 }
      )
    }

    return NextResponse.json(winner)
  } catch (error) {
    console.error('Get winner error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournament winner' },
      { status: 500 }
    )
  }
}

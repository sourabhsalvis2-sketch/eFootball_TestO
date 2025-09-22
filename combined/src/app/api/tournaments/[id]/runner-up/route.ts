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

    const runnerUp = await DatabaseService.getTournamentRunnerUp(tournamentId)
    
    if (!runnerUp) {
      return NextResponse.json(
        { error: 'Tournament not complete or no runner-up determined' },
        { status: 404 }
      )
    }

    return NextResponse.json(runnerUp)
  } catch (error) {
    console.error('Get runner-up error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournament runner-up' },
      { status: 500 }
    )
  }
}
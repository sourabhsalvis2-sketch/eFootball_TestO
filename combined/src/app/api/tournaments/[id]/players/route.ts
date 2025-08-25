import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

interface AddPlayerToTournamentRequest {
  playerId: number
}

export async function POST(
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

    const body = await request.json() as AddPlayerToTournamentRequest
    const { playerId } = body

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    if (typeof playerId !== 'number' || !Number.isInteger(playerId)) {
      return NextResponse.json(
        { error: 'Player ID must be a valid integer' },
        { status: 400 }
      )
    }

    await DatabaseService.addPlayerToTournament(tournamentId, playerId)
    return NextResponse.json({ tournamentId, playerId })
  } catch (error) {
    console.error('Add player to tournament error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Tournament not found')) {
        return NextResponse.json(
          { error: 'Tournament not found' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('Player not found')) {
        return NextResponse.json(
          { error: 'Player not found' },
          { status: 404 }
        )
      }
      
      if (error.message.includes('already in this tournament')) {
        return NextResponse.json(
          { error: 'Player is already in this tournament' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to add player to tournament' },
      { status: 500 }
    )
  }
}

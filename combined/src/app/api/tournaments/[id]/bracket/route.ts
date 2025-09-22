import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const tournamentId = parseInt(params.id)
    
    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: 'Invalid tournament ID' },
        { status: 400 }
      )
    }

    // Get tournament details
    const tournament = await DatabaseService.getOne('SELECT * FROM tournaments WHERE id = ?', [tournamentId])
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Get all knockout matches
    const knockoutMatches = await DatabaseService.executeQuery(
      "SELECT m.*, p1.name as player1_name, p2.name as player2_name FROM matches m LEFT JOIN players p1 ON m.player1_id = p1.id LEFT JOIN players p2 ON m.player2_id = p2.id WHERE m.tournament_id = ? AND m.stage = 'knockout' ORDER BY CASE m.round WHEN 'round-of-16' THEN 1 WHEN 'quarter' THEN 2 WHEN 'semi' THEN 3 WHEN 'final' THEN 4 WHEN 'third-place' THEN 5 END, m.id",
      [tournamentId]
    )

    // Organize matches by round
    const bracket = {
      'round-of-16': knockoutMatches.filter(m => m.round === 'round-of-16'),
      'quarter': knockoutMatches.filter(m => m.round === 'quarter'),
      'semi': knockoutMatches.filter(m => m.round === 'semi'),
      'final': knockoutMatches.filter(m => m.round === 'final'),
      'third-place': knockoutMatches.filter(m => m.round === 'third-place')
    }

    return NextResponse.json({
      tournamentId,
      tournamentName: tournament.name,
      tournamentType: tournament.type,
      thirdPlacePlayoff: tournament.third_place_playoff,
      bracket
    })
  } catch (error) {
    console.error('Get knockout bracket error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch knockout bracket' },
      { status: 500 }
    )
  }
}

// Endpoint to manually trigger knockout bracket generation (for debugging/admin)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const tournamentId = parseInt(params.id)
    
    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: 'Invalid tournament ID' },
        { status: 400 }
      )
    }

    // Trigger knockout generation
    await DatabaseService.tryGenerateKnockoutMatches(tournamentId)

    return NextResponse.json({ 
      success: true, 
      message: 'Knockout bracket generation triggered' 
    })
  } catch (error) {
    console.error('Generate knockout bracket error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate knockout bracket' },
      { status: 500 }
    )
  }
}
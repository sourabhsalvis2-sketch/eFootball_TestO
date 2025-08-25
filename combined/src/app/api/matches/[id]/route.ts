import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, Match, Player } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const matchId = parseInt(resolvedParams.id)
    
    if (isNaN(matchId)) {
      return NextResponse.json(
        { error: 'Invalid match ID' },
        { status: 400 }
      )
    }

    const { score1, score2 } = await request.json()
    
    if (typeof score1 !== 'number' || typeof score2 !== 'number' || 
        score1 < 0 || score2 < 0) {
      return NextResponse.json(
        { error: 'Valid scores (non-negative numbers) are required' },
        { status: 400 }
      )
    }

    const result = await DatabaseService.updateMatchScore(matchId, score1, score2)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Update match score error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update match score' },
      { status: 500 }
    )
  }
}

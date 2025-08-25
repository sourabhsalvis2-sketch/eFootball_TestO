import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const tournamentId = parseInt(id)
    
    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: 'Invalid tournament ID' },
        { status: 400 }
      )
    }

    // Check if tournament exists
    const tournament = await DatabaseService.getOne(
      'SELECT * FROM tournaments WHERE id = ?',
      [tournamentId]
    )

    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    await DatabaseService.deleteTournament(tournamentId)
    
    return NextResponse.json({ message: 'Tournament deleted successfully' })
  } catch (error) {
    console.error('Delete tournament error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete tournament' },
      { status: 500 }
    )
  }
}

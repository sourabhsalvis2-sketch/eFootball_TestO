import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

// Type definitions for request bodies
interface CreateTournamentRequest {
  name: string
}

export async function GET() {
  try {
    const tournaments = await DatabaseService.getAllTournamentsWithDetails()
    return NextResponse.json(tournaments)
  } catch (error) {
    console.error('Get tournaments error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tournaments' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateTournamentRequest
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Tournament name is required' },
        { status: 400 }
      )
    }

    if (typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Tournament name must be a string' },
        { status: 400 }
      )
    }

    if (name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Tournament name cannot be empty' },
        { status: 400 }
      )
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Tournament name cannot exceed 100 characters' },
        { status: 400 }
      )
    }

    const tournament = await DatabaseService.createTournament(name.trim())
    return NextResponse.json(tournament, { status: 201 })
  } catch (error) {
    console.error('Create tournament error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE constraint')) {
        return NextResponse.json(
          { error: 'Tournament name already exists' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create tournament' },
      { status: 500 }
    )
  }
}

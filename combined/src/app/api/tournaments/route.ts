import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

// Type definitions for request bodies
interface CreateTournamentRequest {
  name: string
  type?: 'round_robin' | 'group_and_knockout'
  teamsPerGroup?: number
  teamsAdvancingPerGroup?: number
  allowThirdPlaceTeams?: boolean
  thirdPlacePlayoff?: boolean
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
    const { 
      name, 
      type = 'round_robin',
      teamsPerGroup = 4,
      teamsAdvancingPerGroup = 2,
      allowThirdPlaceTeams = false,
      thirdPlacePlayoff = type === 'group_and_knockout' ? true : false 
    } = body

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

    // Validate tournament type
    if (type && !['round_robin', 'group_and_knockout'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid tournament type' },
        { status: 400 }
      )
    }

    // Validate group settings for group_and_knockout tournaments
    if (type === 'group_and_knockout') {
      if (teamsPerGroup < 3 || teamsPerGroup > 8) {
        return NextResponse.json(
          { error: 'Teams per group must be between 3 and 8' },
          { status: 400 }
        )
      }

      if (teamsAdvancingPerGroup < 1 || teamsAdvancingPerGroup >= teamsPerGroup) {
        return NextResponse.json(
          { error: 'Teams advancing per group must be less than teams per group' },
          { status: 400 }
        )
      }
    }

    const config = {
      type,
      teamsPerGroup,
      teamsAdvancingPerGroup,
      allowThirdPlaceTeams,
      thirdPlacePlayoff
    }

    const tournament = await DatabaseService.createTournament(name.trim(), config)
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

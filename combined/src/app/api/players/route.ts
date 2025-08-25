import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService, Player } from '@/lib/db'

// Type definitions for request bodies
interface CreatePlayerRequest {
  name: string
}

export async function GET() {
  try {
    const players = await DatabaseService.getAllPlayers()
    return NextResponse.json(players)
  } catch (error) {
    console.error('Get players error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch players' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreatePlayerRequest
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Player name is required' },
        { status: 400 }
      )
    }

    if (typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Player name must be a string' },
        { status: 400 }
      )
    }

    if (name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Player name cannot be empty' },
        { status: 400 }
      )
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Player name cannot exceed 100 characters' },
        { status: 400 }
      )
    }

    const player = await DatabaseService.createPlayer(name.trim())
    return NextResponse.json(player, { status: 201 })
  } catch (error) {
    console.error('Create player error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE constraint')) {
        return NextResponse.json(
          { error: 'Player name already exists' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create player' },
      { status: 500 }
    )
  }
}

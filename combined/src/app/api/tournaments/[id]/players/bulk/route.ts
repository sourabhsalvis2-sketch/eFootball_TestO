import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

interface BulkAddPlayersRequest {
  playerIds?: number[]
  addAllPlayers?: boolean
}

interface BulkAddPlayersResponse {
  tournamentId: number
  results: {
    successful: Array<{ playerId: number, playerName: string }>
    failed: Array<{ playerId: number, playerName: string, error: string }>
    skipped: Array<{ playerId: number, playerName: string, reason: string }>
  }
  summary: {
    total: number
    successful: number
    failed: number
    skipped: number
  }
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

    const body = await request.json() as BulkAddPlayersRequest
    const { playerIds, addAllPlayers } = body

    // Validate input
    if (!playerIds && !addAllPlayers) {
      return NextResponse.json(
        { error: 'Either playerIds array or addAllPlayers flag must be provided' },
        { status: 400 }
      )
    }

    if (playerIds && (!Array.isArray(playerIds) || playerIds.length === 0)) {
      return NextResponse.json(
        { error: 'playerIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Get all players if addAllPlayers is true
    let playersToAdd: number[] = []
    if (addAllPlayers) {
      const allPlayers = await DatabaseService.getAllPlayers()
      playersToAdd = allPlayers.map(p => p.id)
    } else {
      playersToAdd = playerIds!
    }

    // Validate that all playerIds are numbers
    const invalidIds = playersToAdd.filter(id => !Number.isInteger(id) || id <= 0)
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid player IDs: ${invalidIds.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if tournament exists
    const tournaments = await DatabaseService.getAllTournamentsWithDetails()
    const tournament = tournaments.find(t => t.id === tournamentId)
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Get existing players in tournament
    const existingPlayerIds = new Set(tournament.players.map(p => p.id))

    // Get all player details for response
    const allPlayers = await DatabaseService.getAllPlayers()
    const playerMap = new Map(allPlayers.map(p => [p.id, p.name]))

    const results: BulkAddPlayersResponse['results'] = {
      successful: [],
      failed: [],
      skipped: []
    }

    // Process each player
    for (const playerId of playersToAdd) {
      const playerName = playerMap.get(playerId) || `Unknown (ID: ${playerId})`

      try {
        // Check if player exists
        if (!playerMap.has(playerId)) {
          results.failed.push({
            playerId,
            playerName,
            error: 'Player not found'
          })
          continue
        }

        // Check if player is already in tournament
        if (existingPlayerIds.has(playerId)) {
          results.skipped.push({
            playerId,
            playerName,
            reason: 'Already in tournament'
          })
          continue
        }

        // Add player to tournament
        await DatabaseService.addPlayerToTournament(tournamentId, playerId)
        results.successful.push({
          playerId,
          playerName
        })

      } catch (error) {
        console.error(`Failed to add player ${playerId} to tournament ${tournamentId}:`, error)
        results.failed.push({
          playerId,
          playerName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const response: BulkAddPlayersResponse = {
      tournamentId,
      results,
      summary: {
        total: playersToAdd.length,
        successful: results.successful.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Bulk add players error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process bulk player addition',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
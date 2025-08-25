import { createClient } from '@libsql/client'

// Turso database configuration
const client = createClient({
  url: process.env.TURSO_DB_URL || '',
  authToken: process.env.TURSO_DB_TOKEN || '',
})

// Type definitions for database entities
export interface Player {
  id: number
  name: string
}

export interface Tournament {
  id: number
  name: string
  status: 'pending' | 'in_progress' | 'completed'
}

export interface TournamentWithDetails extends Tournament {
  players: Player[]
  matches: Match[]
}

export interface Match {
  id: number
  tournament_id: number
  player1_id: number
  player2_id: number
  score1: number | null
  score2: number | null
  round: 'group' | 'semi' | 'final'
  status: 'scheduled' | 'completed'
}

export interface PlayerStats {
  playerId: number
  name: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

// Database helper functions
export class DatabaseService {
  static async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await client.execute({ sql, args: params })
      return result.rows as T[]
    } catch (error) {
      console.error('Database query error:', error)
      throw new Error(`Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async executeUpdate(sql: string, params: any[] = []): Promise<{ insertId?: number; changes: number }> {
    try {
      const result = await client.execute({ sql, args: params })
      return {
        insertId: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
        changes: result.rowsAffected || 0
      }
    } catch (error) {
      console.error('Database update error:', error)
      throw new Error(`Database operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async getOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.executeQuery<T>(sql, params)
    return rows[0] || null
  }

  // Player operations
  static async createPlayer(name: string): Promise<Player> {
    if (!name?.trim()) {
      throw new Error('Player name is required')
    }

    const result = await this.executeUpdate(
      'INSERT INTO players (name) VALUES (?)',
      [name.trim()]
    )

    if (!result.insertId) {
      throw new Error('Failed to create player')
    }

    return { id: result.insertId, name: name.trim() }
  }

  static async getAllPlayers(): Promise<Player[]> {
    return this.executeQuery<Player>('SELECT * FROM players ORDER BY name')
  }

  // Tournament operations
  static async createTournament(name: string): Promise<Tournament> {
    if (!name?.trim()) {
      throw new Error('Tournament name is required')
    }

    const result = await this.executeUpdate(
      'INSERT INTO tournaments (name, status) VALUES (?, ?)',
      [name.trim(), 'pending']
    )

    if (!result.insertId) {
      throw new Error('Failed to create tournament')
    }

    return { id: result.insertId, name: name.trim(), status: 'pending' }
  }

  static async getAllTournamentsWithDetails(): Promise<TournamentWithDetails[]> {
    const tournaments = await this.executeQuery<Tournament>('SELECT * FROM tournaments ORDER BY id DESC')
    
    const result: TournamentWithDetails[] = []
    
    for (const tournament of tournaments) {
      const players = await this.executeQuery<Player>(
        `SELECT p.id, p.name 
         FROM tournament_players tp 
         JOIN players p ON p.id = tp.player_id 
         WHERE tp.tournament_id = ?`,
        [tournament.id]
      )

      const matches = await this.executeQuery<Match>(
        'SELECT * FROM matches WHERE tournament_id = ? ORDER BY round, id',
        [tournament.id]
      )

      result.push({
        ...tournament,
        players,
        matches
      })
    }

    return result
  }

  static async addPlayerToTournament(tournamentId: number, playerId: number): Promise<void> {
    // Check if tournament exists
    const tournament = await this.getOne<Tournament>('SELECT * FROM tournaments WHERE id = ?', [tournamentId])
    if (!tournament) {
      throw new Error('Tournament not found')
    }

    // Check if player exists
    const player = await this.getOne<Player>('SELECT * FROM players WHERE id = ?', [playerId])
    if (!player) {
      throw new Error('Player not found')
    }

    // Check if player is already in tournament
    const existing = await this.getOne(
      'SELECT * FROM tournament_players WHERE tournament_id = ? AND player_id = ?',
      [tournamentId, playerId]
    )
    if (existing) {
      throw new Error('Player is already in this tournament')
    }

    await this.executeUpdate(
      'INSERT INTO tournament_players (tournament_id, player_id) VALUES (?, ?)',
      [tournamentId, playerId]
    )
  }

  static async generateMatches(tournamentId: number): Promise<Match[]> {
    // Get tournament players
    const players = await this.executeQuery<{ player_id: number }>(
      'SELECT player_id FROM tournament_players WHERE tournament_id = ?',
      [tournamentId]
    )

    if (players.length < 2) {
      throw new Error('Need at least 2 players to generate matches')
    }

    // Clear existing matches
    await this.executeUpdate('DELETE FROM matches WHERE tournament_id = ?', [tournamentId])

    // Generate round-robin matches
    const playerIds = players.map(p => p.player_id)
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        await this.executeUpdate(
          'INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, ?, ?)',
          [tournamentId, playerIds[i], playerIds[j], 'group', 'scheduled']
        )
      }
    }

    // Update tournament status
    await this.executeUpdate('UPDATE tournaments SET status = ? WHERE id = ?', ['in_progress', tournamentId])

    return this.executeQuery<Match>('SELECT * FROM matches WHERE tournament_id = ?', [tournamentId])
  }

  // Match operations
  static async updateMatchScore(matchId: number, score1: number, score2: number): Promise<Match & { winner?: Player }> {
    console.log(`Updating match ${matchId} with scores ${score1}-${score2}`)
    
    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      throw new Error('Scores must be numbers')
    }

    // Get existing match
    const existingMatch = await this.getOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])
    if (!existingMatch) {
      throw new Error('Match not found')
    }

    console.log('Existing match:', existingMatch)

    // Update match score
    await this.executeUpdate(
      'UPDATE matches SET score1 = ?, score2 = ?, status = ? WHERE id = ?',
      [score1, score2, 'completed', matchId]
    )

    // Get updated match
    const updatedMatch = await this.getOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])
    if (!updatedMatch) {
      throw new Error('Failed to update match')
    }

    console.log('Updated match:', updatedMatch)

    // Handle knockout progression
    if (updatedMatch.round === 'group') {
      console.log('Calling tryGenerateKnockoutMatches for group match')
      await this.tryGenerateKnockoutMatches(updatedMatch.tournament_id)
    }
    
    console.log('Calling tryAdvanceKnockout')
    await this.tryAdvanceKnockout(updatedMatch.tournament_id)

    // If this was the final, get the winner
    let winner: Player | undefined
    if (updatedMatch.round === 'final' && updatedMatch.status === 'completed') {
      try {
        winner = await this.getTournamentWinner(updatedMatch.tournament_id) || undefined
      } catch (error) {
        console.warn('Failed to get tournament winner:', error)
      }
    }

    return { ...updatedMatch, winner }
  }

  static async getMatch(matchId: number): Promise<Match | null> {
    return this.getOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])
  }

  // Tournament progression logic
  static async tryGenerateKnockoutMatches(tournamentId: number): Promise<void> {
    // Check if all group matches are completed
    const groupMatches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'group'",
      [tournamentId]
    )

    const allGroupCompleted = groupMatches.every(match => match.status === 'completed')
    if (!allGroupCompleted) return

    // Get standings and select top 4
    const standings = await this.computeStandings(tournamentId)
    console.log('Tournament standings:', standings)
    
    const top4 = standings.slice(0, 4)
    console.log(`Top 4 players: ${top4.length} found`)
    
    if (top4.length < 2) {
      console.log('Not enough players for knockout stage')
      return
    }

    // Clear existing knockout matches
    await this.executeUpdate(
      "DELETE FROM matches WHERE tournament_id = ? AND round IN ('semi', 'final')",
      [tournamentId]
    )

    if (top4.length === 2) {
      // With only 2 players, go straight to final
      console.log('Creating final match for 2 players')
      await this.executeUpdate(
        'INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, ?, ?)',
        [tournamentId, top4[0].playerId, top4[1].playerId, 'final', 'scheduled']
      )
    } else if (top4.length === 3) {
      // With 3 players, top 2 go to final (3rd place is eliminated)
      console.log('Creating final match for top 2 of 3 players')
      await this.executeUpdate(
        'INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, ?, ?)',
        [tournamentId, top4[0].playerId, top4[1].playerId, 'final', 'scheduled']
      )
    } else {
      // 4+ players, create semi-finals
      console.log('Creating semi-finals for 4+ players')
      await this.executeUpdate(
        'INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, ?, ?)',
        [tournamentId, top4[0].playerId, top4[3].playerId, 'semi', 'scheduled']
      )
      await this.executeUpdate(
        'INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, ?, ?)',
        [tournamentId, top4[1].playerId, top4[2].playerId, 'semi', 'scheduled']
      )
    }
  }

  static async tryAdvanceKnockout(tournamentId: number): Promise<void> {
    // Check if both semis are completed
    const semis = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'semi'",
      [tournamentId]
    )

    console.log('Semi matches found:', semis.length)
    console.log('Semi matches data:', semis)

    if (semis.length === 2 && semis.every(match => match.status === 'completed')) {
      console.log('Both semis completed, checking for existing finals...')
      
      // Check if final already exists
      const existingFinals = await this.executeQuery<Match>(
        "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final'",
        [tournamentId]
      )

      console.log('Existing finals:', existingFinals.length)

      if (existingFinals.length === 0) {
        console.log('Creating final match...')
        
        // Create final with semi winners
        const winners = semis.map(match => {
          const winner = Number(match.score1) > Number(match.score2) ? match.player1_id : match.player2_id
          console.log(`Match ${match.id}: ${match.score1} vs ${match.score2}, winner: ${winner}`)
          return winner
        })

        console.log('Final winners:', winners)

        await this.executeUpdate(
          'INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, ?, ?)',
          [tournamentId, winners[0], winners[1], 'final', 'scheduled']
        )
        
        console.log('Final match created successfully!')
      }
    } else {
      console.log('Semi conditions not met:', {
        semiCount: semis.length,
        allCompleted: semis.every(match => match.status === 'completed'),
        semiStatuses: semis.map(m => m.status)
      })
    }

    // Check if final is completed and update tournament status
    const finals = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final'",
      [tournamentId]
    )

    if (finals.length === 1 && finals[0].status === 'completed') {
      await this.executeUpdate('UPDATE tournaments SET status = ? WHERE id = ?', ['completed', tournamentId])
    }
  }

  // Statistics and standings
  static async computeStandings(tournamentId: number): Promise<PlayerStats[]> {
    const players = await this.executeQuery<Player>(
      `SELECT p.id, p.name 
       FROM tournament_players tp 
       JOIN players p ON p.id = tp.player_id 
       WHERE tp.tournament_id = ?`,
      [tournamentId]
    )

    console.log('Computing standings for tournament:', tournamentId, 'Players:', players)

    const stats: PlayerStats[] = players.map(player => ({
      playerId: player.id,
      name: player.name,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0
    }))

    const groupMatches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'group' AND status = 'completed'",
      [tournamentId]
    )

    console.log('Group matches for standings:', groupMatches)

    for (const match of groupMatches) {
      const player1Stats = stats.find(s => s.playerId === match.player1_id)
      const player2Stats = stats.find(s => s.playerId === match.player2_id)
      
      if (!player1Stats || !player2Stats) continue

      console.log(`Processing match: Player ${match.player1_id} vs Player ${match.player2_id} - ${match.score1}:${match.score2}`)

      player1Stats.played++
      player2Stats.played++
      player1Stats.goalsFor += match.score1 || 0
      player1Stats.goalsAgainst += match.score2 || 0
      player2Stats.goalsFor += match.score2 || 0
      player2Stats.goalsAgainst += match.score1 || 0

      console.log(`Player ${match.player1_id} stats: ${player1Stats.goalsFor} goals for, ${player1Stats.goalsAgainst} goals against`)
      console.log(`Player ${match.player2_id} stats: ${player2Stats.goalsFor} goals for, ${player2Stats.goalsAgainst} goals against`)

      if ((match.score1 || 0) > (match.score2 || 0)) {
        player1Stats.wins++
        player2Stats.losses++
        player1Stats.points += 3
      } else if ((match.score1 || 0) < (match.score2 || 0)) {
        player2Stats.wins++
        player1Stats.losses++
        player2Stats.points += 3
      } else {
        player1Stats.draws++
        player2Stats.draws++
        player1Stats.points += 1
        player2Stats.points += 1
      }
    }

    // Calculate goal difference
    stats.forEach(stat => {
      stat.goalDiff = stat.goalsFor - stat.goalsAgainst
    })

    // Sort by points, goal difference, goals for
    stats.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })

    return stats
  }

  static async getTournamentWinner(tournamentId: number): Promise<Player | null> {
    const finals = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final' AND status = 'completed'",
      [tournamentId]
    )

    if (finals.length === 0) return null

    const final = finals[0]
    const winnerId = Number(final.score1) > Number(final.score2) ? final.player1_id : final.player2_id
    
    return this.getOne<Player>('SELECT * FROM players WHERE id = ?', [winnerId])
  }

  static async deleteTournament(tournamentId: number): Promise<void> {
    // Delete in the correct order to respect foreign key constraints
    // 1. Delete matches first
    await this.executeUpdate('DELETE FROM matches WHERE tournament_id = ?', [tournamentId])
    
    // 2. Delete tournament_players associations
    await this.executeUpdate('DELETE FROM tournament_players WHERE tournament_id = ?', [tournamentId])
    
    // 3. Finally delete the tournament
    await this.executeUpdate('DELETE FROM tournaments WHERE id = ?', [tournamentId])
  }

  static async removePlayerFromTournament(tournamentId: number, playerId: number): Promise<void> {
    await this.executeUpdate(
      'DELETE FROM tournament_players WHERE tournament_id = ? AND player_id = ?',
      [tournamentId, playerId]
    )
  }
}

export default client

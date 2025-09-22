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
  type?: 'round_robin' | 'group_and_knockout'
  teams_per_group?: number
  teams_advancing_per_group?: number
  allow_third_place_teams?: boolean
  third_place_playoff?: boolean
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
  round: string //  "round-of-16", "quarter", "semi", "final", "third-place"
  status: 'scheduled' | 'completed'
  group_letter?: string // "A", "B", "C", etc. for group stage matches
  stage: 'group' | 'knockout' // Distinguish between group stage and knockout
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
  group: string
  groupPosition?: number // 1st, 2nd, 3rd, etc. in group
  qualifiedForKnockout?: boolean
}

export interface GroupStanding {
  groupLetter: string
  groupName: string // "Group A", "Group B", etc.
  players: PlayerStats[]
}

export interface TournamentConfig {
  type: 'round_robin' | 'group_and_knockout'
  teamsPerGroup: number
  teamsAdvancingPerGroup: number
  allowThirdPlaceTeams: boolean
  thirdPlacePlayoff: boolean
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
  static async createTournament(name: string, config?: TournamentConfig): Promise<Tournament> {
    if (!name?.trim()) {
      throw new Error('Tournament name is required')
    }

    const {
      type = 'round_robin',
      teamsPerGroup = 4,
      teamsAdvancingPerGroup = 2,
      allowThirdPlaceTeams = false,
      thirdPlacePlayoff = false
    } = config || {}

    const result = await this.executeUpdate(
      `INSERT INTO tournaments (name, status, type, teams_per_group, teams_advancing_per_group, 
       allow_third_place_teams, third_place_playoff) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), 'pending', type, teamsPerGroup, teamsAdvancingPerGroup, allowThirdPlaceTeams, thirdPlacePlayoff]
    )

    if (!result.insertId) {
      throw new Error('Failed to create tournament')
    }

    return { 
      id: result.insertId, 
      name: name.trim(), 
      status: 'pending',
      type,
      teams_per_group: teamsPerGroup,
      teams_advancing_per_group: teamsAdvancingPerGroup,
      allow_third_place_teams: allowThirdPlaceTeams,
      third_place_playoff: thirdPlacePlayoff
    }
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

  // ==============================
  // Match generation
  // ==============================
  /**
 * Generate round robin matches for a group
 * Each player plays against every other player once
 */
  static async generateRoundRobin(tournamentId: number, players: number[], round: string) {
    const matches: { p1: number; p2: number }[] = []

    // Generate all unique pairs
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        matches.push({ p1: players[i], p2: players[j] })
      }
    }

    // Insert into DB (legacy format for existing tournaments)
    for (const m of matches) {
      await this.executeUpdate(
        `INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status)
       VALUES (?, ?, ?, ?, 'group', 'scheduled')`,
        [tournamentId, m.p1, m.p2, round]
      )
    }
  }


  static async generateMatches(tournamentId: number, groupCount?: number): Promise<Match[]> {
    // Get tournament details
    const tournament = await this.getOne<Tournament>('SELECT * FROM tournaments WHERE id = ?', [tournamentId])
    if (!tournament) {
      throw new Error('Tournament not found')
    }

    const players = await this.executeQuery<{ player_id: number }>(
      'SELECT player_id FROM tournament_players WHERE tournament_id = ?',
      [tournamentId]
    )

    if (players.length < 2) throw new Error('Need at least 2 players')

    // Clear old matches
    await this.executeUpdate('DELETE FROM matches WHERE tournament_id = ?', [tournamentId])

    const playerIds = players.map(p => p.player_id)
    this.shuffle(playerIds)

    if (tournament.type === 'group_and_knockout') {
      return this.generateGroupAndKnockoutMatches(tournamentId, playerIds, tournament)
    } else {
      return this.generateLegacyRoundRobinMatches(tournamentId, playerIds, groupCount)
    }
  }

  static async generateGroupAndKnockoutMatches(tournamentId: number, playerIds: number[], tournament: Tournament): Promise<Match[]> {
    const teamsPerGroup = tournament.teams_per_group || 4
    const totalPlayers = playerIds.length
    
    // Calculate optimal number of groups
    const idealGroups = Math.ceil(totalPlayers / teamsPerGroup)
    let actualGroups = idealGroups
    
    // Adjust for better distribution if needed
    const remainder = totalPlayers % teamsPerGroup
    if (remainder === 1 && actualGroups > 1) {
      // If we have 1 leftover player, try to distribute more evenly
      actualGroups = Math.max(2, Math.floor(totalPlayers / (teamsPerGroup - 1)))
    }

    // Validate knockout requirements
    const teamsAdvancing = tournament.teams_advancing_per_group || 2
    const knockoutTeams = actualGroups * teamsAdvancing
    
    if (knockoutTeams < 2) {
      throw new Error('Not enough teams for knockout stage. Need at least 2 qualifying teams.')
    }

    // Ensure players are properly shuffled before group assignment
    // This prevents groups from being formed based on player addition order
    this.shuffle(playerIds)
    
    // Distribute players into groups as evenly as possible
    const groups: number[][] = Array.from({ length: actualGroups }, () => [])
    
    // Round-robin distribution
    playerIds.forEach((playerId, index) => {
      const groupIndex = index % actualGroups
      groups[groupIndex].push(playerId)
    })

    // Generate round-robin matches within each group
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]
      const groupLetter = String.fromCharCode(65 + i) // A, B, C, etc.
      
      if (group.length > 1) {
        await this.generateGroupRoundRobin(tournamentId, group, groupLetter)
      }
    }

    // Update tournament status
    await this.executeUpdate(
      'UPDATE tournaments SET status = ? WHERE id = ?',
      ['in_progress', tournamentId]
    )

    return this.executeQuery<Match>(
      'SELECT * FROM matches WHERE tournament_id = ?',
      [tournamentId]
    )
  }

  static async generateLegacyRoundRobinMatches(tournamentId: number, playerIds: number[], groupCount?: number): Promise<Match[]> {
    // Legacy logic for existing round robin tournaments
    if (!groupCount) {
      if (playerIds.length <= 10) groupCount = 1
      else if (playerIds.length <= 16) groupCount = 2
      else groupCount = 4
    }

    // Ensure players are properly shuffled before group assignment
    // This prevents groups from being formed based on player addition order
    this.shuffle(playerIds)
    
    const groups: number[][] = Array.from({ length: groupCount }, () => [])
    
    playerIds.forEach((p, idx) => {
      groups[idx % groupCount!].push(p)
    })

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (g.length > 1) {
        await this.generateRoundRobin(tournamentId, g, `group-${i + 1}`)
      }
    }

    await this.executeUpdate(
      'UPDATE tournaments SET status = ? WHERE id = ?',
      ['in_progress', tournamentId]
    )

    return this.executeQuery<Match>(
      'SELECT * FROM matches WHERE tournament_id = ?',
      [tournamentId]
    )
  }

  static async generateGroupRoundRobin(tournamentId: number, players: number[], groupLetter: string) {
    const matches: { p1: number; p2: number }[] = []

    // Generate all unique pairs within the group
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        matches.push({ p1: players[i], p2: players[j] })
      }
    }

    // Insert matches into DB with group information
    for (const m of matches) {
      await this.executeUpdate(
        `INSERT INTO matches (tournament_id, player1_id, player2_id, round, group_letter, stage, status)
         VALUES (?, ?, ?, ?, ?, 'group', 'scheduled')`,
        [tournamentId, m.p1, m.p2, `group-${groupLetter}`, groupLetter]
      )
    }
  }

  // Match operations
  static async updateMatchScore(matchId: number, score1: number, score2: number): Promise<Match & { winner?: Player }> {

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      throw new Error('Scores must be numbers')
    }

    // Get existing match
    const existingMatch = await this.getOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])
    if (!existingMatch) {
      throw new Error('Match not found')
    }


    // Update match score
    await this.executeUpdate(
      'UPDATE matches SET score1 = ?, score2 = ?, status = ? WHERE id = ?',
      [score1, score2, 'completed', matchId]
    )

    // Get updated match
    const updatedMatch = await this.getOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])
    if (!updatedMatch) {
      throw new Error('Failed to retrieve updated match')
    }
    
    // Try to generate knockout matches if this was a group stage match
    if (updatedMatch.stage === 'group' || updatedMatch.round.startsWith('group')) {
      await this.tryGenerateKnockoutMatches(updatedMatch.tournament_id)
    }
    
    // Try to advance knockout rounds
    await this.tryAdvanceKnockout(updatedMatch.tournament_id)
    
    return updatedMatch
  }

  // ==============================
  // Knockout logic
  // ==============================
  static async tryGenerateKnockoutMatches(tournamentId: number) {
    const tournament = await this.getOne<Tournament>('SELECT * FROM tournaments WHERE id = ?', [tournamentId])
    if (!tournament) return

    if (tournament.type === 'group_and_knockout') {
      return this.generateKnockoutBracket(tournamentId, tournament)
    } else {
      return this.generateLegacyKnockoutMatches(tournamentId)
    }
  }

  static async generateKnockoutBracket(tournamentId: number, tournament: Tournament) {
    // Check if all group stage matches are completed
    const groupMatches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND stage = 'group'",
      [tournamentId]
    )

    if (!groupMatches.every(m => m.status === 'completed')) return

    // Get group standings
    const groupStandings = await this.computeGroupStandings(tournamentId, tournament)
    
    // Get qualified teams
    const qualifiedTeams = this.getKnockoutQualifiers(groupStandings, tournament)
    
    if (qualifiedTeams.length < 2) {
      throw new Error('Not enough qualified teams for knockout stage')
    }

    // Clear existing knockout matches
    await this.executeUpdate(
      "DELETE FROM matches WHERE tournament_id = ? AND stage = 'knockout'",
      [tournamentId]
    )

    // Create knockout bracket
    await this.createKnockoutMatches(tournamentId, qualifiedTeams, tournament)
  }

  static getKnockoutQualifiers(groupStandings: GroupStanding[], tournament: Tournament): PlayerStats[] {
    const teamsAdvancing = tournament.teams_advancing_per_group || 2
    const allowThirdPlace = tournament.allow_third_place_teams !== false // Default to true
    
    const groupWinners: PlayerStats[] = []
    const runnersUp: PlayerStats[] = []
    const thirdPlaceTeams: PlayerStats[] = []

    // Process each group and assign positions based on computed standings
    for (const group of groupStandings) {
      //Already sorted players
      const sortedPlayers = group.players
      
      // Extract qualified teams from each group
      if (sortedPlayers.length >= 1 && teamsAdvancing >= 1) {
        const winner = { ...sortedPlayers[0], groupPosition: 1, group: group.groupLetter, qualifiedForKnockout: true }
        groupWinners.push(winner)
      }
      
      if (sortedPlayers.length >= 2 && teamsAdvancing >= 2) {
        const runnerUp = { ...sortedPlayers[1], groupPosition: 2, group: group.groupLetter, qualifiedForKnockout: true }
        runnersUp.push(runnerUp)
      }
      
      if (sortedPlayers.length >= 3) {
        const thirdPlace = { ...sortedPlayers[2], groupPosition: 3, group: group.groupLetter }
        thirdPlaceTeams.push(thirdPlace)
      }
    }

    // Calculate qualified teams so far
    const automaticQualifiers = groupWinners.length + runnersUp.length
    
    // Determine ideal knockout bracket size
    const targetBracketSize = this.calculateIdealBracketSize(automaticQualifiers, thirdPlaceTeams.length)
    
    // Add best third-place teams if needed and allowed
    const qualifiedTeams = [...groupWinners, ...runnersUp]
    
    if (allowThirdPlace && automaticQualifiers < targetBracketSize) {
      const thirdPlaceNeeded = targetBracketSize - automaticQualifiers
      
      // Sort third place teams by performance and select best ones
      thirdPlaceTeams.sort(
        (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor
      )
      
      const bestThirdPlace = thirdPlaceTeams.slice(0, thirdPlaceNeeded)
      bestThirdPlace.forEach(team => {
        team.qualifiedForKnockout = true
      })
      
      qualifiedTeams.push(...bestThirdPlace)
    }

    console.log(`\nFinal qualified teams (${qualifiedTeams.length}):`)
    qualifiedTeams.forEach(team => {
      const pos = team.groupPosition === 1 ? '1st' : team.groupPosition === 2 ? '2nd' : '3rd'
      console.log(`${team.name} - Group ${team.group} ${pos} (${team.points}pts, GD:${team.goalDiff})`)
    })

    return qualifiedTeams
  }

  static calculateIdealBracketSize(automaticQualifiers: number, availableThirdPlace: number): number {
    const totalAvailable = automaticQualifiers + availableThirdPlace
    
    // Find the largest power of 2 that fits within available teams
    // and is at least as large as automatic qualifiers
    const minSize = Math.max(4, automaticQualifiers) // Minimum 4 teams for knockout
    const maxSize = totalAvailable
    
    let targetSize = 4
    while (targetSize * 2 <= maxSize && targetSize < 32) {
      targetSize *= 2
    }
    
    // If we can't fit the automatic qualifiers, return the next power of 2
    if (targetSize < automaticQualifiers) {
      targetSize = Math.pow(2, Math.ceil(Math.log2(automaticQualifiers)))
    }
    
    return Math.min(targetSize, maxSize)
  }

  static async createKnockoutMatches(tournamentId: number, qualifiedTeams: PlayerStats[], tournament: Tournament) {
    const teamCount = qualifiedTeams.length
    
    console.log(`Creating knockout bracket for ${teamCount} teams`)
    
    // Create proper seeding and bracket
    const seededTeams = this.createFIFAStyleSeeding(qualifiedTeams)
    const pairings = this.generateOptimalPairings(seededTeams)
    
    // Determine starting round
    const startRound = this.determineStartingRound(teamCount)
    
    // Create matches in database
    await this.insertKnockoutMatches(tournamentId, pairings, startRound)
  }

  static async insertKnockoutMatches(tournamentId: number, pairings: [PlayerStats, PlayerStats][], round: string) {
    console.log(`Inserting ${pairings.length} ${round} matches`)
    
    for (const [team1, team2] of pairings) {
      await this.executeUpdate(
        "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, ?, 'knockout', 'scheduled')",
        [tournamentId, team1.playerId, team2.playerId, round]
      )
      console.log(`Created match: ${team1.name} vs ${team2.name}`)
    }
  }

  static createFIFAStyleSeeding(teams: PlayerStats[]): PlayerStats[] {
    // Separate teams by group position
    const groupWinners = teams.filter(t => t.groupPosition === 1)
    const runnersUp = teams.filter(t => t.groupPosition === 2)  
    const thirdPlace = teams.filter(t => t.groupPosition === 3)
    
    // Sort each category by performance (points, goal diff, goals for)
    const sortedWinners = [...groupWinners].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
    const sortedRunners = [...runnersUp].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
    const sortedThird = [...thirdPlace].sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
    
    // FIFA seeding: Group winners get best seeds, then runners-up, then third-place
    const seeded = [...sortedWinners, ...sortedRunners, ...sortedThird]
    
    console.log(`Seeding complete: ${sortedWinners.length} winners, ${sortedRunners.length} runners-up, ${sortedThird.length} third-place`)
    
    return seeded
  }

  static generateOptimalPairings(seededTeams: PlayerStats[]): [PlayerStats, PlayerStats][] {
    const n = seededTeams.length
    const pairings: [PlayerStats, PlayerStats][] = []
    
    if (n === 8) {
      // Create pairings based on your expected format:
      // QF1: Winner Group A vs Best 3rd-place Team 2
      // QF2: Winner Group B vs Runner-up Group C
      // QF3: Winner Group C vs Best 3rd-place Team 1  
      // QF4: Runner-up Group A vs Runner-up Group B
      
      // Separate teams by position
      const groupWinners = seededTeams.filter(t => t.groupPosition === 1)
      const runnersUp = seededTeams.filter(t => t.groupPosition === 2)
      const thirdPlace = seededTeams.filter(t => t.groupPosition === 3)
      
      console.log('Creating bracket with specific format:')
      console.log('Group Winners:', groupWinners.map(t => `${t.name} (Group ${t.group})`))
      console.log('Runners-up:', runnersUp.map(t => `${t.name} (Group ${t.group})`))
      console.log('Third Place:', thirdPlace.map(t => `${t.name} (Group ${t.group})`))
      
      if (groupWinners.length >= 3 && runnersUp.length >= 2 && thirdPlace.length >= 2) {
        // Sort each group to ensure consistent ordering (A, B, C)
        groupWinners.sort((a, b) => a.group.localeCompare(b.group))
        runnersUp.sort((a, b) => a.group.localeCompare(b.group))
        
        // Sort third place by performance to get best 3rd place teams
        thirdPlace.sort((a, b) => 
          b.points - a.points || 
          b.goalDiff - a.goalDiff || 
          b.goalsFor - a.goalsFor
        )
        
        // Create the specific pairings you requested
        const winnerA = groupWinners.find(t => t.group === 'A') || groupWinners[0]
        const winnerB = groupWinners.find(t => t.group === 'B') || groupWinners[1] 
        const winnerC = groupWinners.find(t => t.group === 'C') || groupWinners[2]
        
        const runnerA = runnersUp.find(t => t.group === 'A') || runnersUp[0]
        const runnerB = runnersUp.find(t => t.group === 'B') || runnersUp[1]
        const runnerC = runnersUp.find(t => t.group === 'C') || runnersUp[0]
        
        const best3rd = thirdPlace[0] // Best 3rd place team
        const second3rd = thirdPlace[1] // Second best 3rd place team
        
        // QF1: Winner Group A vs Best 3rd-place Team 2 (second best third)
        pairings.push([winnerA, second3rd])
        console.log(`QF1: ${winnerA.name} (Winner Group ${winnerA.group}) vs ${second3rd.name} (2nd Best 3rd Place)`)
        
        // QF2: Winner Group B vs Runner-up Group C
        pairings.push([winnerB, runnerC])
        console.log(`QF2: ${winnerB.name} (Winner Group ${winnerB.group}) vs ${runnerC.name} (Runner-up Group ${runnerC.group})`)
        
        // QF3: Winner Group C vs Best 3rd-place Team 1 (best third) 
        pairings.push([winnerC, best3rd])
        console.log(`QF3: ${winnerC.name} (Winner Group ${winnerC.group}) vs ${best3rd.name} (Best 3rd Place)`)
        
        // QF4: Runner-up Group A vs Runner-up Group B
        pairings.push([runnerA, runnerB])
        console.log(`QF4: ${runnerA.name} (Runner-up Group ${runnerA.group}) vs ${runnerB.name} (Runner-up Group ${runnerB.group})`)
      } else {
        // Fallback to standard seeding
        const standardPairs = [[0, 7], [1, 6], [2, 5], [3, 4]]
        for (const [i, j] of standardPairs) {
          pairings.push([seededTeams[i], seededTeams[j]])
        }
        console.log(`Created ${pairings.length} quarterfinal matches with standard seeding`)
      }
    } else if (n === 4) {
      // Semifinals: 1v4, 2v3
      pairings.push([seededTeams[0], seededTeams[3]])
      pairings.push([seededTeams[1], seededTeams[2]])
      console.log(`Created ${pairings.length} semifinal matches`)
    } else if (n === 2) {
      // Final
      pairings.push([seededTeams[0], seededTeams[1]])
      console.log(`Final: ${seededTeams[0].name} vs ${seededTeams[1].name}`)
    } else {
      // Custom logic for other sizes (like 6, 12, 16)
      console.log(`Generating pairings for ${n} teams`)
      
      if (n === 16) {
        // Round of 16: Standard bracket
        for (let i = 0; i < 8; i++) {
          const team1 = seededTeams[i]
          const team2 = seededTeams[15 - i]
          pairings.push([team1, team2])
          console.log(`R16: ${team1.name} (${i + 1}) vs ${team2.name} (${16 - i})`)
        }
      } else {
        // Generic pairing for irregular sizes
        for (let i = 0; i < n; i += 2) {
          if (i + 1 < n) {
            pairings.push([seededTeams[i], seededTeams[i + 1]])
            console.log(`Match: ${seededTeams[i].name} vs ${seededTeams[i + 1].name}`)
          }
        }
      }
    }
    
    return pairings
  }

  static determineStartingRound(teamCount: number): string {
    if (teamCount <= 2) return 'final'
    if (teamCount <= 4) return 'semi'
    if (teamCount <= 8) return 'quarter'
    if (teamCount <= 16) return 'round-of-16'
    return 'round-of-32'
  }
  
  static async generateLegacyKnockoutMatches(tournamentId: number) {
    // Existing logic for legacy round robin tournaments
    const groupMatches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round LIKE 'group-%'",
      [tournamentId]
    );

    // Only continue if all group matches are completed
    if (!groupMatches.every(m => m.status === 'completed')) return;

    const standings = await this.computeStandings(tournamentId);

    // Organize standings into groups
    const grouped: Record<string, PlayerStats[]> = {};
    for (const s of standings) {
      if (!s.group) s.group = "Group X"; // fallback
      if (!grouped[s.group]) grouped[s.group] = [];
      grouped[s.group].push(s);
    }

    // Sort standings inside each group
    for (const g in grouped) {
      grouped[g].sort(
        (a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor
      );
    }

    // Clear any old knockout matches
    await this.executeUpdate(
      "DELETE FROM matches WHERE tournament_id = ? AND round IN ('quarter', 'semi', 'final')",
      [tournamentId]
    );

    const groups = Object.keys(grouped);

    if (groups.length === 1) {
      // ✅ Single group → Top 4 → Semis
      const top4 = grouped[groups[0]].slice(0, 4);
      if (top4.length === 4) {
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'semi', 'knockout', 'scheduled')",
          [tournamentId, top4[0].playerId, top4[3].playerId]
        );
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'semi', 'knockout', 'scheduled')",
          [tournamentId, top4[1].playerId, top4[2].playerId]
        );
      }
    } else if (groups.length === 2) {
      const g1 = grouped[groups[0]].slice(0, 2);
      const g2 = grouped[groups[1]].slice(0, 2);
      if (g1.length === 2 && g2.length === 2) {
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'semi', 'knockout', 'scheduled')",
          [tournamentId, g1[0].playerId, g2[1].playerId]
        );
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'semi', 'knockout', 'scheduled')",
          [tournamentId, g2[0].playerId, g1[1].playerId]
        );
      }
    }
  }


  static async tryAdvanceKnockout(tournamentId: number) {
    const tournament = await this.getOne<Tournament>('SELECT * FROM tournaments WHERE id = ?', [tournamentId])
    if (!tournament) return

    if (tournament.type === 'group_and_knockout') {
      return this.advanceGroupAndKnockoutTournament(tournamentId, tournament)
    } else {
      return this.advanceLegacyKnockoutTournament(tournamentId)
    }
  }

  static async advanceGroupAndKnockoutTournament(tournamentId: number, tournament: Tournament) {
    // Handle knockout round progression
    await this.advanceKnockoutRound(tournamentId, 'round-of-16', 'quarter')
    await this.advanceKnockoutRound(tournamentId, 'quarter', 'semi')
    await this.advanceKnockoutRound(tournamentId, 'semi', 'final')
    
    // Handle third-place playoff if enabled
    if (tournament.third_place_playoff) {
      await this.createThirdPlacePlayoff(tournamentId)
    }
    
    // Check if tournament is completed
    await this.checkTournamentCompletion(tournamentId, tournament)
  }

  static async advanceKnockoutRound(tournamentId: number, fromRound: string, toRound: string) {
    const completedMatches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND stage = 'knockout' AND status = 'completed' ORDER BY id ASC",
      [tournamentId, fromRound]
    )

    if (completedMatches.length === 0) return

    // Check if all matches in this round are completed
    const allMatches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND stage = 'knockout'",
      [tournamentId, fromRound]
    )

    if (!allMatches.every(m => m.status === 'completed')) return

    // Get winners from completed matches
    const winners = completedMatches.map(m => 
      Number(m.score1) > Number(m.score2) ? m.player1_id : m.player2_id
    )

    // Create next round matches
    const existingNextRound = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = ? AND stage = 'knockout' ORDER BY id ASC",
      [tournamentId, toRound]
    )

    // Pair up winners for next round
    const nextRoundPairs: [number, number][] = []
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        nextRoundPairs.push([winners[i], winners[i + 1]])
      }
    }

    if (existingNextRound.length !== nextRoundPairs.length) {
      // Delete existing matches and recreate
      await this.executeUpdate(
        "DELETE FROM matches WHERE tournament_id = ? AND round = ? AND stage = 'knockout'",
        [tournamentId, toRound]
      )

      for (const [p1, p2] of nextRoundPairs) {
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, ?, 'knockout', 'scheduled')",
          [tournamentId, p1, p2, toRound]
        )
      }
    } else {
      // Update existing matches if participants changed
      for (let i = 0; i < nextRoundPairs.length; i++) {
        const existing = existingNextRound[i]
        const [p1, p2] = nextRoundPairs[i]

        if (existing.player1_id !== p1 || existing.player2_id !== p2) {
          await this.executeUpdate(
            "UPDATE matches SET player1_id = ?, player2_id = ?, score1 = NULL, score2 = NULL, status = 'scheduled' WHERE id = ?",
            [p1, p2, existing.id]
          )
        }
      }
    }
  }

  static async createThirdPlacePlayoff(tournamentId: number) {
    const semiFinals = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'semi' AND stage = 'knockout' AND status = 'completed' ORDER BY id ASC",
      [tournamentId]
    )

    if (semiFinals.length !== 2) return

    const losers = semiFinals.map(m => 
      Number(m.score1) < Number(m.score2) ? m.player1_id : m.player2_id
    )

    const existingThirdPlace = await this.getOne<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'third-place' AND stage = 'knockout'",
      [tournamentId]
    )

    if (!existingThirdPlace && losers.length === 2) {
      await this.executeUpdate(
        "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'third-place', 'knockout', 'scheduled')",
        [tournamentId, losers[0], losers[1]]
      )
    } else if (existingThirdPlace && (existingThirdPlace.player1_id !== losers[0] || existingThirdPlace.player2_id !== losers[1])) {
      await this.executeUpdate(
        "UPDATE matches SET player1_id = ?, player2_id = ?, score1 = NULL, score2 = NULL, status = 'scheduled' WHERE id = ?",
        [losers[0], losers[1], existingThirdPlace.id]
      )
      console.log('Third place playoff match updated')
    }
  }

  static async checkTournamentCompletion(tournamentId: number, tournament: Tournament) {
    const final = await this.getOne<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final' AND stage = 'knockout' AND status = 'completed'",
      [tournamentId]
    )

    if (!final) {
      console.log('Final not completed yet')
      return
    }

    let tournamentCompleted = true

    // If third place playoff is enabled, check if it's completed too
    if (tournament.third_place_playoff) {
      const thirdPlace = await this.getOne<Match>(
        "SELECT * FROM matches WHERE tournament_id = ? AND round = 'third-place' AND stage = 'knockout'",
        [tournamentId]
      )
      
      if (thirdPlace && thirdPlace.status !== 'completed') {
        tournamentCompleted = false
      }
    }

    if (tournamentCompleted) {
      await this.executeUpdate(
        "UPDATE tournaments SET status = ? WHERE id = ?",
        ['completed', tournamentId]
      )
    }
  }

  static async advanceLegacyKnockoutTournament(tournamentId: number) {
    // Legacy logic for existing round robin tournaments
    const quarters = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'quarter' ORDER BY id ASC",
      [tournamentId]
    );

    if (quarters.length === 4 && quarters.every(q => q.status === 'completed')) {
      const winners = quarters.map(m =>
        Number(m.score1) > Number(m.score2) ? m.player1_id : m.player2_id
      );

      const desiredSemis: [number, number][] = [
        [winners[0], winners[3]], 
        [winners[1], winners[2]], 
      ];

      const existingSemis = await this.executeQuery<Match>(
        "SELECT * FROM matches WHERE tournament_id = ? AND round = 'semi' ORDER BY id ASC",
        [tournamentId]
      );

      if (existingSemis.length === 2) {
        // Compare participants
        for (let i = 0; i < 2; i++) {
          const semi = existingSemis[i];
          const [p1, p2] = desiredSemis[i];

          if (semi.player1_id !== p1 || semi.player2_id !== p2) {
            // Update only if participants differ (reset scores)
            await this.executeUpdate(
              "UPDATE matches SET player1_id = ?, player2_id = ?, score1 = NULL, score2 = NULL, status = 'scheduled' WHERE id = ?",
              [p1, p2, semi.id]
            );
          }
        }
      } else {
        // Delete wrong/missing semis and recreate
        await this.executeUpdate(
          "DELETE FROM matches WHERE tournament_id = ? AND round = 'semi'",
          [tournamentId]
        );
        for (const [p1, p2] of desiredSemis) {
          await this.executeUpdate(
            "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'semi', 'knockout', 'scheduled')",
            [tournamentId, p1, p2]
          );
        }
      }
    }

    const semis = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'semi' ORDER BY id ASC",
      [tournamentId]
    );

    if (semis.length === 2 && semis.every(s => s.status === 'completed')) {
      const winners = semis.map(m =>
        Number(m.score1) > Number(m.score2) ? m.player1_id : m.player2_id
      );

      const desiredFinal: [number, number] = [winners[0], winners[1]];

      const existingFinal = await this.getOne<Match>(
        "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final'",
        [tournamentId]
      );

      if (existingFinal) {
        if (
          existingFinal.player1_id !== desiredFinal[0] ||
          existingFinal.player2_id !== desiredFinal[1]
        ) {
          await this.executeUpdate(
            "UPDATE matches SET player1_id = ?, player2_id = ?, score1 = NULL, score2 = NULL, status = 'scheduled' WHERE id = ?",
            [desiredFinal[0], desiredFinal[1], existingFinal.id]
          );
        }
      } else {
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, stage, status) VALUES (?, ?, ?, 'final', 'knockout', 'scheduled')",
          [tournamentId, desiredFinal[0], desiredFinal[1]]
        );
      }
    }

    const finals = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final'",
      [tournamentId]
    );

    if (finals.length === 1 && finals[0].status === 'completed') {
      await this.executeUpdate(
        "UPDATE tournaments SET status = ? WHERE id = ?",
        ['completed', tournamentId]
      );
    }
  }




  // ==============================
  // Standings
  // ==============================
  static async computeGroupStandings(tournamentId: number, tournament: Tournament): Promise<GroupStanding[]> {
    // Get all distinct groups for this tournament
    const groupLetters = await this.executeQuery<{ group_letter: string }>(
      'SELECT DISTINCT group_letter FROM matches WHERE tournament_id = ? AND stage = ? AND group_letter IS NOT NULL ORDER BY group_letter',
      [tournamentId, 'group']
    )

    const groupStandings: GroupStanding[] = []

    for (const { group_letter } of groupLetters) {
      // Get all players in this group - use UNION to get both player1_id and player2_id
      const playersInGroup = await this.executeQuery<{ player_id: number }>(
        `SELECT DISTINCT player_id FROM (
           SELECT player1_id as player_id 
           FROM matches 
           WHERE tournament_id = ? AND group_letter = ? AND stage = 'group'
           UNION
           SELECT player2_id as player_id 
           FROM matches 
           WHERE tournament_id = ? AND group_letter = ? AND stage = 'group'
         ) players
         WHERE player_id IN (SELECT tp.player_id FROM tournament_players tp WHERE tp.tournament_id = ?)`,
        [tournamentId, group_letter, tournamentId, group_letter, tournamentId]
      )

      const players: PlayerStats[] = []

      for (const { player_id } of playersInGroup) {
        const player = await this.getOne<Player>('SELECT * FROM players WHERE id = ?', [player_id])
        if (!player) continue

        const stats: PlayerStats = {
          playerId: player.id,
          name: player.name,
          played: 0, wins: 0, draws: 0, losses: 0,
          goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
          group: `Group ${group_letter}`
        }

        // Calculate stats from completed matches in this group
        const completedMatches = await this.executeQuery<Match>(
          "SELECT * FROM matches WHERE tournament_id = ? AND group_letter = ? AND stage = 'group' AND status = 'completed' AND (player1_id = ? OR player2_id = ?)",
          [tournamentId, group_letter, player.id, player.id]
        )

        for (const match of completedMatches) {
          stats.played++
          
          if (match.player1_id === player.id) {
            stats.goalsFor += match.score1!
            stats.goalsAgainst += match.score2!
            
            if (match.score1! > match.score2!) {
              stats.wins++
              stats.points += 3
            } else if (match.score1! < match.score2!) {
              stats.losses++
            } else {
              stats.draws++
              stats.points += 1
            }
          } else {
            stats.goalsFor += match.score2!
            stats.goalsAgainst += match.score1!
            
            if (match.score2! > match.score1!) {
              stats.wins++
              stats.points += 3
            } else if (match.score2! < match.score1!) {
              stats.losses++
            } else {
              stats.draws++
              stats.points += 1
            }
          }
        }

        stats.goalDiff = stats.goalsFor - stats.goalsAgainst
        players.push(stats)
      }

      // Sort players within group
      players.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)

      groupStandings.push({
        groupLetter: group_letter,
        groupName: `Group ${group_letter}`,
        players
      })
    }

    return groupStandings
  }

  static async computeStandings(tournamentId: number): Promise<PlayerStats[]> {
    const players = await this.executeQuery<Player>(
      `SELECT p.id, p.name
       FROM tournament_players tp
       JOIN players p ON p.id = tp.player_id
       WHERE tp.tournament_id = ?`,
      [tournamentId]
    )
    const matches = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round LIKE 'group-%' AND status = 'completed'",
      [tournamentId]
    )

    const matchesGrouped = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round LIKE 'group-%'",
      [tournamentId]
    );

    const stats: PlayerStats[] = players.map(p => ({
      playerId: p.id,
      name: p.name,
      played: 0, wins: 0, draws: 0, losses: 0,
      goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0, group: ""
    }))

    for (const stat of stats) {
      const playerMatch = matchesGrouped.find(
        m => m.player1_id === stat.playerId || m.player2_id === stat.playerId
      );

      if (playerMatch?.round) {
        stat.group = playerMatch.round.replace("group-", "Group ").toUpperCase();
      } else {
        stat.group = "Overall"; // fallback if no group found
      }
    }


    for (const m of matches) {
      const s1 = stats.find(s => s.playerId === m.player1_id)!
      const s2 = stats.find(s => s.playerId === m.player2_id)!
      if (!s1.group) s1.group = m.round;
      if (!s2.group) s2.group = m.round;
      s1.played++; s2.played++
      s1.goalsFor += m.score1!; s1.goalsAgainst += m.score2!
      s2.goalsFor += m.score2!; s2.goalsAgainst += m.score1!
      if (m.score1! > m.score2!) { s1.wins++; s2.losses++; s1.points += 3 }
      else if (m.score2! > m.score1!) { s2.wins++; s1.losses++; s2.points += 3 }
      else { s1.draws++; s2.draws++; s1.points++; s2.points++ }
    }


    stats.forEach(s => { s.goalDiff = s.goalsFor - s.goalsAgainst })
    stats.sort((a, b) =>
      b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor
    )
    return stats
  }

  // ==============================
  // Utilities
  // ==============================
  static shuffle(array: number[]) {
    // Fisher-Yates shuffle algorithm for better randomization
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
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

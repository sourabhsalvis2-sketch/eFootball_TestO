/**
 * DatabaseService.ts
 * Football Tournament Manager - Database service for Turso (libSQL)
 * Handles players, tournaments, matches, standings, and progression logic.
 */

import { createClient } from '@libsql/client'

// Turso database configuration
const client = createClient({
  url: process.env.TURSO_DB_URL || '',
  authToken: process.env.TURSO_DB_TOKEN || '',
})

// ==============================
// Type definitions
// ==============================
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
  round: string // "group-A", "group-B", "semi", "final"
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
  group?: string
}

// ==============================
// Database service
// ==============================
export class DatabaseService {
  // Generic helpers
  static async executeQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await client.execute({ sql, args: params })
      return result.rows as T[]
    } catch (error) {
      console.error('Database query error:', error)
      throw error
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
      throw error
    }
  }

  static async getOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.executeQuery<T>(sql, params)
    return rows[0] || null
  }

  // ==============================
  // Player operations
  // ==============================
  static async createPlayer(name: string): Promise<Player> {
    const result = await this.executeUpdate(
      'INSERT INTO players (name) VALUES (?)',
      [name.trim()]
    )
    return { id: result.insertId!, name: name.trim() }
  }

  static async getAllPlayers(): Promise<Player[]> {
    return this.executeQuery<Player>('SELECT * FROM players ORDER BY name')
  }

  // ==============================
  // Tournament operations
  // ==============================
  static async createTournament(name: string): Promise<Tournament> {
    const result = await this.executeUpdate(
      'INSERT INTO tournaments (name, status) VALUES (?, ?)',
      [name.trim(), 'pending']
    )
    return { id: result.insertId!, name: name.trim(), status: 'pending' }
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

      result.push({ ...tournament, players, matches })
    }
    return result
  }

  static async addPlayerToTournament(tournamentId: number, playerId: number) {
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

    // Insert into DB
    for (const m of matches) {
      await this.executeUpdate(
        `INSERT INTO matches (tournament_id, player1_id, player2_id, round, status)
       VALUES (?, ?, ?, ?, ?)`,
        [tournamentId, m.p1, m.p2, round, 'scheduled']
      )
    }
  }


  static async generateMatches(tournamentId: number, groupCount?: number): Promise<Match[]> {
    const players = await this.executeQuery<{ player_id: number }>(
      'SELECT player_id FROM tournament_players WHERE tournament_id = ?',
      [tournamentId]
    )

    if (players.length < 2) throw new Error('Need at least 2 players')

    // Clear old matches
    await this.executeUpdate('DELETE FROM matches WHERE tournament_id = ?', [tournamentId])

    const playerIds = players.map(p => p.player_id)
    this.shuffle(playerIds)

    // Decide group count
    if (!groupCount) {
      if (playerIds.length <= 10) groupCount = 1
      else if (playerIds.length <= 20) groupCount = 2
      else groupCount = 4
    }

    // Create empty groups
    const groups: number[][] = Array.from({ length: groupCount }, () => [])

    // Distribute players into groups (round-robin distribution)
    playerIds.forEach((p, idx) => {
      groups[idx % groupCount!].push(p)
    })

    // Generate matches group by group (sequentially to ensure DB inserts finish)
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (g.length > 1) {
        // Use group-1, group-2 style (consistent with standings/knockout logic)
        await this.generateRoundRobin(tournamentId, g, `group-${i + 1}`)
      }
    }

    // Update tournament status
    await this.executeUpdate(
      'UPDATE tournaments SET status = ? WHERE id = ?',
      ['in_progress', tournamentId]
    )

    // Return all matches
    return this.executeQuery<Match>(
      'SELECT * FROM matches WHERE tournament_id = ?',
      [tournamentId]
    )
  }


  // ==============================
  // Match updates
  // ==============================
  static async updateMatchScore(matchId: number, score1: number, score2: number) {
    await this.executeUpdate(
      'UPDATE matches SET score1 = ?, score2 = ?, status = ? WHERE id = ?',
      [score1, score2, 'completed', matchId]
    )
    const updatedMatch = await this.getOne<Match>('SELECT * FROM matches WHERE id = ?', [matchId])
    if (updatedMatch?.round.startsWith('group')) await this.tryGenerateKnockoutMatches(updatedMatch.tournament_id)
    await this.tryAdvanceKnockout(updatedMatch!.tournament_id)
    return updatedMatch
  }

  // ==============================
  // Knockout logic
  // ==============================
  static async tryGenerateKnockoutMatches(tournamentId: number) {
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
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'semi', 'scheduled')",
          [tournamentId, top4[0].playerId, top4[3].playerId]
        );
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'semi', 'scheduled')",
          [tournamentId, top4[1].playerId, top4[2].playerId]
        );
      }
    } else if (groups.length === 2) {
      // ✅ Two groups → Top 2 from each → Cross semis
      const g1 = grouped[groups[0]].slice(0, 2);
      const g2 = grouped[groups[1]].slice(0, 2);
      if (g1.length === 2 && g2.length === 2) {
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'semi', 'scheduled')",
          [tournamentId, g1[0].playerId, g2[1].playerId]
        );
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'semi', 'scheduled')",
          [tournamentId, g2[0].playerId, g1[1].playerId]
        );
      }
    } else {
      // ✅ More than 2 groups → Take overall top 8 → Quarters
      const top8 = standings
        .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
        .slice(0, 8);

      if (top8.length === 8) {
        const pairs = [
          [0, 7], [1, 6], [2, 5], [3, 4]
        ];
        for (const [i, j] of pairs) {
          await this.executeUpdate(
            "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'quarter', 'scheduled')",
            [tournamentId, top8[i].playerId, top8[j].playerId]
          );
        }
      }
    }
  }



  static async tryAdvanceKnockout(tournamentId: number) {

    // 1. Handle Quarters → Semis
    // ========================
    const quarters = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'quarter'",
      [tournamentId]
    );

    if (quarters.length === 4 && quarters.every(q => q.status === 'completed')) {
      const winners = quarters.map(m =>
        Number(m.score1) > Number(m.score2) ? m.player1_id : m.player2_id
      );

      // Clear old semis before inserting new ones
      await this.executeUpdate(
        "DELETE FROM matches WHERE tournament_id = ? AND round = 'semi'",
        [tournamentId]
      );

      // Semi 1: Winner QF1 vs Winner QF4
      await this.executeUpdate(
        "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'semi', 'scheduled')",
        [tournamentId, winners[0], winners[3]]
      );
      // Semi 2: Winner QF2 vs Winner QF3
      await this.executeUpdate(
        "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'semi', 'scheduled')",
        [tournamentId, winners[1], winners[2]]
      );
    }

    // ========================
    // 2. Handle Semis → Final
    // ========================
    const semis = await this.executeQuery<Match>(
      "SELECT * FROM matches WHERE tournament_id = ? AND round = 'semi'",
      [tournamentId]
    );

    if (semis.length === 2 && semis.every(s => s.status === 'completed')) {
      const winners = semis.map(m =>
        Number(m.score1) > Number(m.score2) ? m.player1_id : m.player2_id
      );

      // Only create final if it doesn't exist
      const existingFinal = await this.getOne<Match>(
        "SELECT * FROM matches WHERE tournament_id = ? AND round = 'final'",
        [tournamentId]
      );

      if (!existingFinal) {
        await this.executeUpdate(
          "INSERT INTO matches (tournament_id, player1_id, player2_id, round, status) VALUES (?, ?, ?, 'final', 'scheduled')",
          [tournamentId, winners[0], winners[1]]
        );
      }
    }

    // ========================
    // 3. Handle Final → Tournament Completed
    // ========================
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
      console.log('Processing match:', m);
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
    console.log('Computed standings:', stats);
    return stats
  }

  // ==============================
  // Utilities
  // ==============================
  static shuffle(array: number[]) {
    let i = array.length
    while (i) {
      const j = Math.floor(Math.random() * i--)
        ;[array[i], array[j]] = [array[j], array[i]]
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
}

import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function POST() {
  try {
    // Drop tables in correct order (due to foreign keys)
    await DatabaseService.executeUpdate('DROP TABLE IF EXISTS matches')
    await DatabaseService.executeUpdate('DROP TABLE IF EXISTS tournament_players')
    await DatabaseService.executeUpdate('DROP TABLE IF EXISTS tournaments')
    await DatabaseService.executeUpdate('DROP TABLE IF EXISTS players')

    // Recreate tables with clean schema
    await DatabaseService.executeUpdate(`
      CREATE TABLE players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `)

    await DatabaseService.executeUpdate(`
      CREATE TABLE tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending'
      )
    `)

    await DatabaseService.executeUpdate(`
      CREATE TABLE tournament_players (
        tournament_id INTEGER,
        player_id INTEGER,
        PRIMARY KEY (tournament_id, player_id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `)

    await DatabaseService.executeUpdate(`
      CREATE TABLE matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        player1_id INTEGER,
        player2_id INTEGER,
        score1 INTEGER,
        score2 INTEGER,
        round TEXT DEFAULT 'group',
        status TEXT DEFAULT 'scheduled',
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        FOREIGN KEY (player1_id) REFERENCES players(id),
        FOREIGN KEY (player2_id) REFERENCES players(id)
      )
    `)

    return NextResponse.json({ 
      success: true, 
      message: 'Database reset and recreated successfully with clean schema' 
    })
  } catch (error) {
    console.error('Database reset error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset database' },
      { status: 500 }
    )
  }
}

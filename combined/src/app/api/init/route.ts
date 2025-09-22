import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function POST() {
  try {
    // Create tables
    await DatabaseService.executeUpdate(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      )
    `)

    await DatabaseService.executeUpdate(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        type TEXT DEFAULT 'round_robin',
        teams_per_group INTEGER DEFAULT 4,
        teams_advancing_per_group INTEGER DEFAULT 2,
        allow_third_place_teams BOOLEAN DEFAULT FALSE,
        third_place_playoff BOOLEAN DEFAULT FALSE
      )
    `)

    await DatabaseService.executeUpdate(`
      CREATE TABLE IF NOT EXISTS tournament_players (
        tournament_id INTEGER,
        player_id INTEGER,
        PRIMARY KEY (tournament_id, player_id),
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        FOREIGN KEY (player_id) REFERENCES players(id)
      )
    `)

    await DatabaseService.executeUpdate(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        player1_id INTEGER,
        player2_id INTEGER,
        score1 INTEGER,
        score2 INTEGER,
        round TEXT DEFAULT 'group',
        status TEXT DEFAULT 'scheduled',
        group_letter TEXT,
        stage TEXT DEFAULT 'group',
        FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
        FOREIGN KEY (player1_id) REFERENCES players(id),
        FOREIGN KEY (player2_id) REFERENCES players(id)
      )
    `)

    return NextResponse.json({ success: true, message: 'Database tables created successfully' })
  } catch (error) {
    console.error('Database initialization error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initialize database' },
      { status: 500 }
    )
  }
}

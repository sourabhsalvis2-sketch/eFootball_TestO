const { initDb } = require('./db')

async function createTables(adapter) {
  const q = adapter.pool.query
  if (adapter.type === 'mysql') {
    // MySQL-specific DDL
    await q(`
      CREATE TABLE IF NOT EXISTS players (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL
      )
    `)
    await q(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(32) DEFAULT 'open'
      )
    `)
    await q(`
      CREATE TABLE IF NOT EXISTS tournament_players (
        tournament_id INT,
        player_id INT,
        PRIMARY KEY (tournament_id, player_id)
      )
    `)
    await q(`
      CREATE TABLE IF NOT EXISTS matches (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tournament_id INT,
        player1_id INT,
        player2_id INT,
        score1 INT DEFAULT NULL,
        score2 INT DEFAULT NULL,
        round VARCHAR(32) DEFAULT 'group',
        status VARCHAR(32) DEFAULT 'scheduled'
      )
    `)
  } else {
    // SQLite-compatible DDL
    await q(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      )
    `)
    await q(`
      CREATE TABLE IF NOT EXISTS tournaments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'open'
      )
    `)
    await q(`
      CREATE TABLE IF NOT EXISTS tournament_players (
        tournament_id INTEGER,
        player_id INTEGER,
        PRIMARY KEY (tournament_id, player_id)
      )
    `)
    await q(`
      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tournament_id INTEGER,
        player1_id INTEGER,
        player2_id INTEGER,
        score1 INTEGER DEFAULT NULL,
        score2 INTEGER DEFAULT NULL,
        round TEXT DEFAULT 'group',
        status TEXT DEFAULT 'scheduled'
      )
    `)
  }
}

;(async function main(){
  try {
    const adapter = await initDb()
    await createTables(adapter)

    const [rows] = await adapter.pool.query('SELECT COUNT(*) as c FROM players')
    const count = Array.isArray(rows) && rows[0] ? (rows[0].c || rows[0]['COUNT(*)'] || 0) : 0
    if (!count) {
      await adapter.pool.query('INSERT INTO players (name) VALUES (?)', ['Alice'])
      await adapter.pool.query('INSERT INTO players (name) VALUES (?)', ['Bob'])
      await adapter.pool.query('INSERT INTO players (name) VALUES (?)', ['Carol'])
      await adapter.pool.query('INSERT INTO players (name) VALUES (?)', ['Dave'])
      console.log('Seeded players')
    } else {
      console.log('Players already seeded')
    }
    process.exit(0)
  } catch (err) {
    console.error('Seeding failed:', err)
    process.exit(1)
  }
})()

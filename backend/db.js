const dotenv = require('dotenv');
dotenv.config();

// Try MySQL first, if it fails (ENOTFOUND or cannot connect) fall back to SQLite for local dev
const mysql2 = require('mysql2/promise');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function createMySQLPool() {
  const pool = mysql2.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'efootball',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    waitForConnections: true,
    connectionLimit: 10,
  });
  // Try a simple query to verify connectivity
  await pool.query('SELECT 1')
  return { type: 'mysql', pool };
}

async function createSQLitePool() {
  const dbfile = process.env.SQLITE_FILE || './data.sqlite3'
  const db = await open({ filename: dbfile, driver: sqlite3.Database })
  // Provide a .query interface similar to mysql2's pool.query
  const query = async (sql, params = []) => {
    // normalize parameter markers: sqlite uses ? same as mysql2
    if (sql.trim().toLowerCase().startsWith('select')) {
      const rows = await db.all(sql, params)
      return [rows]
    } else {
      const res = await db.run(sql, params)
      return [{ insertId: res.lastID, affectedRows: res.changes }]
    }
  }
  return { type: 'sqlite', pool: { query } }
}

let adapter = null

async function initDb() {
  if (adapter) return adapter
  try {
    adapter = await createMySQLPool()
    console.log('Using MySQL adapter')
  } catch (err) {
    console.warn('MySQL unavailable, falling back to SQLite:', err.message)
    adapter = await createSQLitePool()
    console.log('Using SQLite adapter')
  }
  return adapter
}

module.exports = { initDb }

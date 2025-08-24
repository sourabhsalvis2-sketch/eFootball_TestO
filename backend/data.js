const { initDb } = require('./db')

let adapter = null
async function getAdapter() {
  if (!adapter) adapter = await initDb()
  return adapter
}

// Debug helper - enable by setting DEBUG=true in environment
const DBG = process.env.DEBUG === 'true' ? (...args) => console.log('[debug]', ...args) : () => {}

function getRowsFromResult(res) {
  // mysql2: returns [rows, fields]
  // sqlite adapter: our wrapper returns [rows]
  if (!res) return []
  if (Array.isArray(res)) {
    if (Array.isArray(res[0])) return res[0]
    return res
  }
  return []
}

async function getOne(a, sql, params) {
  const res = await a.pool.query(sql, params)
  const rows = getRowsFromResult(res)
  return rows[0] || null
}

function getInsertIdFromResult(res) {
  // Handle mysql2 ([OkPacket, fields]) and sqlite wrapper ([{ insertId }])
  if (!res) return null
  if (Array.isArray(res)) {
    // If first element is an object with insertId/lastID, use it
    if (res[0] && typeof res[0] === 'object') {
      return (res[0].insertId ?? res[0].lastID) || null
    }
    return null
  }
  if (res && typeof res === 'object') {
    return (res.insertId ?? res.lastID) || null
  }
  return null
}

async function createPlayer(name) {
  const a = await getAdapter()
  const res = await a.pool.query('INSERT INTO players (name) VALUES (?)', [name])
  const id = getInsertIdFromResult(res)
  return { id, name }
}

async function createTournament(name) {
  const a = await getAdapter()
  const res = await a.pool.query('INSERT INTO tournaments (name, status) VALUES (?,?)', [name, 'pending'])
  const id = getInsertIdFromResult(res)
  return { id, name, status: 'pending' }
}

async function getTournaments() {
  const a = await getAdapter()
  const tsRes = await a.pool.query('SELECT * FROM tournaments')
  const ts = getRowsFromResult(tsRes)
  const out = []
  for (const t of ts) {
    const tpsRes = await a.pool.query('SELECT p.id,p.name FROM tournament_players tp JOIN players p ON p.id=tp.player_id WHERE tp.tournament_id=?', [t.id])
    const msRes = await a.pool.query('SELECT * FROM matches WHERE tournament_id=?', [t.id])
    const tps = getRowsFromResult(tpsRes)
    const ms = getRowsFromResult(msRes)
    out.push({ ...t, players: tps, matches: ms })
  }
  return out
}

async function addPlayerToTournament(tournamentId, playerId) {
  const a = await getAdapter()
  await a.pool.query('INSERT INTO tournament_players (tournament_id, player_id) VALUES (?,?)', [tournamentId, playerId])
  return { tournamentId, playerId }
}

async function generateRoundRobinAndKnockout(tournamentId) {
  const a = await getAdapter()
  const tpsRes = await a.pool.query('SELECT player_id FROM tournament_players WHERE tournament_id=?', [tournamentId])
  const tps = getRowsFromResult(tpsRes)
  const pids = tps.map(r => r.player_id)
  if (pids.length < 2) throw new Error('need at least 2 players')

  await a.pool.query('DELETE FROM matches WHERE tournament_id=?', [tournamentId])

  for (let i = 0; i < pids.length; i++) {
    for (let j = i + 1; j < pids.length; j++) {
      await a.pool.query('INSERT INTO matches (tournament_id,player1_id,player2_id,round,status) VALUES (?,?,?,?,?)', [tournamentId, pids[i], pids[j], 'group', 'scheduled'])
    }
  }

  await a.pool.query('UPDATE tournaments SET status=? WHERE id=?', ['in_progress', tournamentId])
  const msRes = await a.pool.query('SELECT * FROM matches WHERE tournament_id=?', [tournamentId])
  const ms = getRowsFromResult(msRes)
  return ms
}

async function updateMatchScore(matchId, score1, score2) {
  if (typeof score1 !== 'number' || typeof score2 !== 'number') throw new Error('scores must be numbers')
  const a = await getAdapter()
  // Read match first to reliably obtain tournament id (works for both adapters)
  const existing = await getOne(a, 'SELECT * FROM matches WHERE id=?', [matchId])
  DBG('updateMatchScore - existing:', existing)
  if (!existing) throw new Error('match not found')
  const updateRes = await a.pool.query('UPDATE matches SET score1=?,score2=?,status=? WHERE id=?', [score1, score2, 'completed', matchId])
  DBG('updateMatchScore - updateRes:', updateRes)

  // Read the updated row to ensure persistence and return a fresh object
  const updated = await getOne(a, 'SELECT * FROM matches WHERE id=?', [matchId])
  DBG('updateMatchScore - after select:', updated)
  if (!updated) {
    console.error('ERROR updateMatchScore: updated match row not found after UPDATE', { matchId, updateRes })
    throw new Error('match not found after update')
  }
  if (updated.status !== 'completed') {
    console.error('ERROR updateMatchScore: match status not completed after update', { matchId, status: updated.status })
    throw new Error('match not marked completed')
  }

  // Only generate knockout matches when a group match finishes
  if (updated.round === 'group') {
    await tryGenerateKnockoutIfReady(updated.tournament_id)
  }
  // Always try to advance knockout progression (semis -> final)
  await tryAdvanceKnockout(updated.tournament_id)

  // If this was the final and it's completed, fetch and attach the winner
  if (updated.round === 'final' && updated.status === 'completed') {
    try {
      const winner = await getWinner(updated.tournament_id)
      if (winner) updated.winner = winner
    } catch (e) {
      console.warn('failed to fetch winner after final completion', e && e.message)
    }
  }

  return updated
}

async function computeStandings(tournamentId) {
  const a = await getAdapter()
  const playersRes = await a.pool.query('SELECT p.id,p.name FROM tournament_players tp JOIN players p ON p.id=tp.player_id WHERE tp.tournament_id=?', [tournamentId])
  const players = getRowsFromResult(playersRes)
  const stats = players.map(p => ({
    playerId: p.id,
    name: p.name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0
  }))

  const gmRes = await a.pool.query("SELECT * FROM matches WHERE tournament_id=? AND round='group' AND status='completed'", [tournamentId])
  const groupMatches = getRowsFromResult(gmRes)
  for (const m of groupMatches) {
    const aStat = stats.find(s => s.playerId === m.player1_id)
    const bStat = stats.find(s => s.playerId === m.player2_id)
    if (!aStat || !bStat) continue
    aStat.played++
    bStat.played++
    aStat.goalsFor += m.score1
    aStat.goalsAgainst += m.score2
    bStat.goalsFor += m.score2
    bStat.goalsAgainst += m.score1
    if (m.score1 > m.score2) {
      aStat.wins++
      bStat.losses++
      aStat.points += 3
    } else if (m.score1 < m.score2) {
      bStat.wins++
      aStat.losses++
      bStat.points += 3
    } else {
      aStat.draws++
      bStat.draws++
      aStat.points += 1
      bStat.points += 1
    }
  }

  for (const s of stats) s.goalDiff = s.goalsFor - s.goalsAgainst

  stats.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    if (y.goalDiff !== x.goalDiff) return y.goalDiff - x.goalDiff
    return y.goalsFor - x.goalsFor
  })

  return stats
}

async function tryGenerateKnockoutIfReady(tournamentId) {
  const a = await getAdapter()
  const gmRes = await a.pool.query("SELECT * FROM matches WHERE tournament_id=? AND round='group'", [tournamentId])
  const groupMatches = getRowsFromResult(gmRes)
  if (groupMatches.some(m => m.status !== 'completed')) return
  const standings = await computeStandings(tournamentId)
  const top4 = standings.slice(0, 4).map(s => s.playerId)
  if (top4.length < 4) return
  await a.pool.query("DELETE FROM matches WHERE tournament_id=? AND round IN ('semi','final')", [tournamentId])
  await a.pool.query('INSERT INTO matches (tournament_id,player1_id,player2_id,round,status) VALUES (?,?,?,?,?)', [tournamentId, top4[0], top4[3], 'semi', 'scheduled'])
  await a.pool.query('INSERT INTO matches (tournament_id,player1_id,player2_id,round,status) VALUES (?,?,?,?,?)', [tournamentId, top4[1], top4[2], 'semi', 'scheduled'])
}

async function tryAdvanceKnockout(tournamentId) {
  const a = await getAdapter()
  const semisRes = await a.pool.query("SELECT * FROM matches WHERE tournament_id=? AND round='semi'", [tournamentId])
  const semis = getRowsFromResult(semisRes)
  if (semis.length === 2 && semis.every(s => s.status === 'completed')) {
    // Only create a final if one doesn't already exist. Do not delete/recreate finals
    const finalsCheckRes = await a.pool.query("SELECT * FROM matches WHERE tournament_id=? AND round='final'", [tournamentId])
    const existingFinals = getRowsFromResult(finalsCheckRes)
    if (!existingFinals || existingFinals.length === 0) {
      const winners = semis.map(s => (Number(s.score1) > Number(s.score2) ? s.player1_id : s.player2_id))
      await a.pool.query('INSERT INTO matches (tournament_id,player1_id,player2_id,round,status) VALUES (?,?,?,?,?)', [tournamentId, winners[0], winners[1], 'final', 'scheduled'])
    }
  }
  const finalsRes = await a.pool.query("SELECT * FROM matches WHERE tournament_id=? AND round='final'", [tournamentId])
  const finals = getRowsFromResult(finalsRes)
  if (finals.length === 1 && finals[0].status === 'completed') {
    await a.pool.query('UPDATE tournaments SET status=? WHERE id=?', ['completed', tournamentId])
  }
}

async function getWinner(tournamentId) {
  const a = await getAdapter()
  // Only consider finals that are completed to avoid picking a scheduled placeholder
  const rowsRes = await a.pool.query("SELECT * FROM matches WHERE tournament_id=? AND round='final' AND status='completed'", [tournamentId])
  const rows = getRowsFromResult(rowsRes)
  DBG('getWinner - final rows:', rows)
  if (!rows || rows.length === 0) return null
  const final = rows[0]
  if (final.status !== 'completed') return null
  // Coerce scores to numbers in case sqlite returns strings
  const s1 = Number(final.score1)
  const s2 = Number(final.score2)
  const winnerId = s1 > s2 ? final.player1_id : final.player2_id
  DBG('getWinner - final:', { id: final.id, s1, s2, winnerId })
  const prsRes = await a.pool.query('SELECT * FROM players WHERE id=?', [winnerId])
  const prs = getRowsFromResult(prsRes)
  return prs[0] || null
}

module.exports = {
  createPlayer,
  createTournament,
  getTournaments,
  addPlayerToTournament,
  generateRoundRobinAndKnockout,
  updateMatchScore,
  computeStandings,
  getWinner,
  tryGenerateKnockoutIfReady,
  tryAdvanceKnockout
}

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const dotenv = require('dotenv');
dotenv.config();

const db = require('./data');

// Create player
app.post('/api/players', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const player = await db.createPlayer(name);
    res.json(player);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create tournament
app.post('/api/tournaments', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const t = await db.createTournament(name);
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const ts = await db.getTournaments();
    res.json(ts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add player to tournament
app.post('/api/tournaments/:id/players', async (req, res) => {
  const tid = Number(req.params.id);
  const { playerId } = req.body;
  try {
    const tp = await db.addPlayerToTournament(tid, playerId);
    res.json(tp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Generate matches (round-robin + placeholders for knockout)
// Generate matches (round-robin + placeholders for knockout)
app.post('/api/tournaments/:id/generate-matches', async (req, res) => {
  const tid = Number(req.params.id);
  try {
    const matches = await db.generateRoundRobinAndKnockout(tid)
    res.json(matches)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// Update match score
app.put('/api/matches/:id/score', async (req, res) => {
  const mid = Number(req.params.id);
  const { score1, score2 } = req.body;
  try {
    const match = await db.updateMatchScore(mid, score1, score2);
    // updateMatchScore already triggers knockout progression; ensure response includes tournament id
    const tournamentId = match.tournament_id || match.tournamentId || match.tournamentId || null
    // If this was the final and is completed, return the winner immediately
    let winner = null
    try {
      if ((match.round === 'final' || match.round === "final") && (match.status === 'completed' || match.status === 'completed')) {
        winner = await db.getWinner(tournamentId)
      }
    } catch (e) {
      // don't fail the request if winner lookup has an issue
      console.warn('winner lookup failed:', e && e.message)
    }
    res.json({ ...match, tournamentId, winner })
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Standings
app.get('/api/tournaments/:id/standings', async (req, res) => {
  const tid = Number(req.params.id);
  try {
    const standings = await db.computeStandings(tid);
    res.json(standings);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Winner
app.get('/api/tournaments/:id/winner', async (req, res) => {
  const tid = Number(req.params.id);
  try {
    const w = await db.getWinner(tid);
    res.json(w);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Box, Typography, TextField, Button, Grid, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material'

export default function AdminDashboard() {
  const [tournaments, setTournaments] = useState<any[]>([])
  const [name, setName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null)
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false)
  const [currentMatch, setCurrentMatch] = useState<any | null>(null)
  const [dialogScore1, setDialogScore1] = useState<string>('')
  const [dialogScore2, setDialogScore2] = useState<string>('')
  // loading states to prevent double submits
  const [creatingTournament, setCreatingTournament] = useState(false)
  const [creatingPlayer, setCreatingPlayer] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [addPlayerLoading, setAddPlayerLoading] = useState(false)
  const [submitScoreLoading, setSubmitScoreLoading] = useState(false)

  useEffect(() => load(), [])

  function load() {
    axios.get('/api/tournaments').then(r => setTournaments(r.data))
  }

  async function createTournament() {
  if (!name.trim()) return alert('Enter a tournament name')
  setCreatingTournament(true)
  try {
    await axios.post('/api/tournaments', { name })
    setName('')
    load()
  } finally {
    setCreatingTournament(false)
  }
  }

  async function createPlayer() {
  if (!playerName.trim()) return alert('Enter a player name')
  setCreatingPlayer(true)
  try {
    await axios.post('/api/players', { name: playerName })
    setPlayerName('')
    load()
  } finally {
    setCreatingPlayer(false)
  }
  }

  async function addPlayerToTournament(pid: number) {
    if (!selectedTournament) return alert('select a tournament')
    setAddPlayerLoading(true)
    try {
      await axios.post(`/api/tournaments/${selectedTournament}/players`, { playerId: pid })
      load()
    } finally {
      setAddPlayerLoading(false)
    }
  }

  async function generateMatches(tid: number) {
    setGenerateLoading(true)
    try {
      await axios.post(`/api/tournaments/${tid}/generate-matches`)
      load()
    } finally {
      setGenerateLoading(false)
    }
  }

  async function setScore(matchId: number) {
    // find match object so we can show player names
    const t = tournaments.find(x => x.id === selectedTournament) || tournaments.find(tr => tr.matches?.some((m: any) => m.id === matchId))
    const match = t?.matches?.find((m: any) => m.id === matchId) || null
    setCurrentMatch(match)
    setDialogScore1(match?.score1 != null ? String(match.score1) : '')
    setDialogScore2(match?.score2 != null ? String(match.score2) : '')
    setScoreDialogOpen(true)
  }

  async function submitDialogScore() {
    if (!currentMatch) return
    const s1 = Number(dialogScore1)
    const s2 = Number(dialogScore2)
    if (dialogScore1.trim() === '' || dialogScore2.trim() === '' || Number.isNaN(s1) || Number.isNaN(s2)) return alert('enter valid numeric scores')
    setSubmitScoreLoading(true)
    try {
      const resp = await axios.put(`/api/matches/${currentMatch.id}/score`, { score1: s1, score2: s2 })
      // if backend returned a winner immediately, show a quick alert
      if (resp?.data?.winner) {
        alert(`Winner: ${resp.data.winner.name}`)
      }
      setScoreDialogOpen(false)
      setCurrentMatch(null)
      setDialogScore1('')
      setDialogScore2('')
      load()
    } finally {
      setSubmitScoreLoading(false)
    }
  }

  function closeDialog() {
    setScoreDialogOpen(false)
    setCurrentMatch(null)
    setDialogScore1('')
    setDialogScore2('')
  }

  function getPlayerName(t: any, pid: number) {
    if (!t) return String(pid)
    const p = (t.players || []).find((x: any) => x.id === pid)
    return p ? p.name : String(pid)
  }

  async function showStandings(tid: number) {
    const r = await axios.get(`/api/tournaments/${tid}/standings`)
    alert(JSON.stringify(r.data, null, 2))
  }

  return (
    <Box className="admin-dashboard">
      <Typography variant="h4" className="dashboard-title">Admin Dashboard</Typography>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Card className="dashboard-card">
            <CardContent>
              <Typography variant="h6" className="card-title">Create Tournament</Typography>
              <TextField 
                fullWidth 
                label="Tournament name" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                sx={{ mt: 1 }}
                className="dashboard-input"
              />
              <Button 
                variant="contained" 
                sx={{ mt: 1 }} 
                onClick={createTournament}
                className="dashboard-button"
                disabled={creatingTournament}
              >
                {creatingTournament ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Create
              </Button>
            </CardContent>
          </Card>

          <Card className="dashboard-card" sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" className="card-title">Create Player</Typography>
              <TextField 
                fullWidth 
                label="Player name" 
                value={playerName} 
                onChange={e => setPlayerName(e.target.value)} 
                sx={{ mt: 1 }}
                className="dashboard-input"
              />
              <Button 
                variant="contained" 
                sx={{ mt: 1 }} 
                onClick={createPlayer}
                className="dashboard-button"
                disabled={creatingPlayer}
              >
                {creatingPlayer ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Create
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Typography variant="h6" className="section-title">Tournaments</Typography>
          {tournaments.map(t => (
            <Card key={t.id} className="tournament-admin-card" sx={{ mb: 1 }}>
              <CardContent>
                <Typography className="tournament-name">{t.name} <span className="tournament-id">(id: {t.id})</span></Typography>
                <Typography variant="body2" className="tournament-status">Status: {t.status}</Typography>
                <Box className="tournament-actions">
                  <Button 
                    sx={{ mr: 1 }} 
                    onClick={() => setSelectedTournament(t.id)}
                    className="action-button"
                    variant={selectedTournament === t.id ? "contained" : "outlined"}
                  >
                    {selectedTournament === t.id ? "Selected" : "Select"}
                  </Button>
                  <Button 
                    onClick={() => generateMatches(t.id)} 
                    disabled={generateLoading}
                    className="action-button"
                    variant="outlined"
                  >
                    {generateLoading ? <><CircularProgress size={14} sx={{ mr: 1 }} />Generating</> : 'Generate Matches'}
                  </Button>
                </Box>

                <Box sx={{ mt: 1 }} className="admin-section">
                  <Typography variant="subtitle2" className="section-subtitle">Players</Typography>
                  <Box className="players-list">
                    {t.players?.map((p: any) => (
                      <Box key={p.id} className="player-item">
                        <span className="player-name">{p.name}</span>
                        <Button 
                          size="small" 
                          onClick={() => addPlayerToTournament(p.id)} 
                          disabled={addPlayerLoading}
                          className="player-action-button"
                          variant="outlined"
                        > 
                          {addPlayerLoading ? <CircularProgress size={12} /> : 'Add to selected'}
                        </Button>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box sx={{ mt: 1 }} className="admin-section">
                  <Typography variant="subtitle2" className="section-subtitle">Matches</Typography>
                  <Box className="matches-list">
                    {t.matches?.map((m: any) => (
                      <Box key={m.id} className="match-item">
                        <span className="match-details">
                          <span className="match-round">{m.round}</span> - 
                          <span className="match-players"> {getPlayerName(t, m.player1_id)} vs {getPlayerName(t, m.player2_id)}</span> - 
                          <span className="match-score">{m.score1 ?? '-'}:{m.score2 ?? '-'}</span>
                        </span>
                        <Button 
                          size="small" 
                          onClick={() => { setSelectedTournament(t.id); setScore(m.id); }} 
                          disabled={submitScoreLoading}
                          className="match-action-button"
                          variant="outlined"
                        > 
                          {submitScoreLoading ? <CircularProgress size={12} /> : 'Set Score'}
                        </Button>
                      </Box>
                    ))}
                  </Box>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => showStandings(t.id)}
                    className="standings-button"
                  >
                    Show Standings
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Grid>
      <Dialog open={scoreDialogOpen} onClose={closeDialog} className="score-dialog">
        <DialogTitle className="dialog-title">Enter Match Score</DialogTitle>
        <DialogContent className="dialog-content">
          <Typography sx={{ mb: 1 }} className="match-info">
            {currentMatch ? `${getPlayerName(tournaments.find(x=>x.id===selectedTournament), currentMatch.player1_id)} vs ${getPlayerName(tournaments.find(x=>x.id===selectedTournament), currentMatch.player2_id)}` : ''}
          </Typography>
          <TextField 
            label="Score 1" 
            value={dialogScore1} 
            onChange={e => setDialogScore1(e.target.value)} 
            sx={{ mr: 1 }}
            className="score-input"
          />
          <TextField 
            label="Score 2" 
            value={dialogScore2} 
            onChange={e => setDialogScore2(e.target.value)}
            className="score-input"
          />
        </DialogContent>
        <DialogActions className="dialog-actions">
          <Button onClick={closeDialog} className="dialog-cancel-button">Cancel</Button>
          <Button 
            onClick={submitDialogScore} 
            variant="contained"
            className="dialog-submit-button"
            disabled={submitScoreLoading}
          >
            {submitScoreLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

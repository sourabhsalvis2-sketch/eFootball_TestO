'use client'

import React, { useEffect, useState } from 'react'
import apiClient from '@/lib/api'
import { Box, Typography, TextField, Button, Grid, Card, CardContent, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useAdminAuth } from '@/hooks/useAdminAuth'

export default function AdminDashboard() {
  const { isAuthenticated, isLoading, logout } = useAdminAuth()
  const [tournaments, setTournaments] = useState<any[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [name, setName] = useState('')
  const [playerName, setPlayerName] = useState('')
  // Tournament creation settings
  const [tournamentType, setTournamentType] = useState<'round_robin' | 'group_and_knockout'>('round_robin')
  const [teamsPerGroup, setTeamsPerGroup] = useState(4)
  const [teamsAdvancing, setTeamsAdvancing] = useState(2)
  const [allowThirdPlace, setAllowThirdPlace] = useState(false)
  const [thirdPlacePlayoff, setThirdPlacePlayoff] = useState(false)
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
  // State for collapsible sections - track expanded state by tournament ID
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(new Set())
  const [expandedMatches, setExpandedMatches] = useState<Set<number>>(new Set())

  useEffect(() => load(), [])

  function load() {
    // Fetch both tournaments and all players
    Promise.all([
      apiClient.get('/api/tournaments'),
      apiClient.get('/api/players')
    ]).then(([tournamentsRes, playersRes]) => {
      setTournaments(tournamentsRes.data)
      setAllPlayers(playersRes.data)
    }).catch(err => {
      console.error('Failed to load data:', err)
    })
  }

  async function createTournament() {
    if (!name.trim()) return alert('Enter a tournament name')
    
    // Validate group + knockout settings
    if (tournamentType === 'group_and_knockout') {
      if (teamsPerGroup < 3 || teamsPerGroup > 8) {
        return alert('Teams per group must be between 3 and 8')
      }
      if (teamsAdvancing < 1 || teamsAdvancing >= teamsPerGroup) {
        return alert('Teams advancing must be less than teams per group')
      }
    }
    
    setCreatingTournament(true)
    try {
      const config = {
        name,
        type: tournamentType,
        teamsPerGroup,
        teamsAdvancingPerGroup: teamsAdvancing,
        allowThirdPlaceTeams: allowThirdPlace,
        thirdPlacePlayoff
      }
      
      await apiClient.post('/api/tournaments', config)
      
      // Reset form
      setName('')
      setTournamentType('round_robin')
      setTeamsPerGroup(4)
      setTeamsAdvancing(2)
      setAllowThirdPlace(false)
      setThirdPlacePlayoff(tournamentType === 'group_and_knockout')
      
      load()
    } finally {
      setCreatingTournament(false)
    }
  }

  async function createPlayer() {
    if (!playerName.trim()) return alert('Enter a player name')
    setCreatingPlayer(true)
    try {
      await apiClient.post('/api/players', { name: playerName })
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
      await apiClient.post(`/api/tournaments/${selectedTournament}/players`, { playerId: pid })
      load()
    } finally {
      setAddPlayerLoading(false)
    }
  }

  async function addAllPlayersToTournament() {
    if (!selectedTournament) return alert('Please select a tournament first')
    if (allPlayers.length === 0) return alert('No players available to add')
    
    setAddPlayerLoading(true)
    try {
      const response = await apiClient.post(`/api/tournaments/${selectedTournament}/players/bulk`, { 
        addAllPlayers: true 
      })
      
      const result = response.data
      const { summary, results } = result
      
      // Create a detailed message
      let message = `Bulk operation completed:\n`
      message += `• Successfully added: ${summary.successful} players\n`
      
      if (summary.skipped > 0) {
        message += `• Already in tournament: ${summary.skipped} players\n`
      }
      
      if (summary.failed > 0) {
        message += `• Failed to add: ${summary.failed} players\n`
      }
      
      // Show detailed results if there are failures
      if (results.failed.length > 0) {
        message += `\nFailed players:\n`
        results.failed.forEach((failure: any) => {
          message += `• ${failure.playerName}: ${failure.error}\n`
        })
      }
      
      alert(message)
      load() // Refresh the data
      
    } catch (error: any) {
      console.error('Error adding all players:', error)
      let errorMessage = 'Failed to add players to tournament'
      
      if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      
      alert(errorMessage)
    } finally {
      setAddPlayerLoading(false)
    }
  }

  async function generateMatches(tid: number) {
    setGenerateLoading(true)
    try {
      await apiClient.post(`/api/tournaments/${tid}/generate-matches`)
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
            const resp = await apiClient.put(`/api/matches/${currentMatch.id}`, { score1: s1, score2: s2 })
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

  // Helper functions for managing collapsible sections
  function togglePlayersExpansion(tournamentId: number) {
    setExpandedPlayers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId)
      } else {
        newSet.add(tournamentId)
      }
      return newSet
    })
  }

  function toggleMatchesExpansion(tournamentId: number) {
    setExpandedMatches(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId)
      } else {
        newSet.add(tournamentId)
      }
      return newSet
    })
  }

  async function deleteTournament(tournamentId: number, tournamentName: string) {
    if (!confirm(`Are you sure you want to delete "${tournamentName}"? This will permanently delete the tournament and all its matches.`)) {
      return
    }
    
    try {
      await apiClient.delete(`/api/tournaments/${tournamentId}`)
      // If the deleted tournament was selected, clear the selection
      if (selectedTournament === tournamentId) {
        setSelectedTournament(null)
      }
      load()
    } catch (error) {
      console.error('Failed to delete tournament:', error)
      alert('Failed to delete tournament')
    }
  }

  async function removePlayerFromTournament(tournamentId: number, playerId: number, playerName: string) {
    if (!confirm(`Are you sure you want to remove "${playerName}" from this tournament?`)) {
      return
    }
    
    try {
      await apiClient.delete(`/api/tournaments/${tournamentId}/players/${playerId}`)
      load()
    } catch (error) {
      console.error('Failed to remove player from tournament:', error)
      alert('Failed to remove player from tournament')
    }
  }

  function getPlayerName(t: any, pid: number) {
    if (!t) return String(pid)
    const p = (t.players || []).find((x: any) => x.id === pid)
    return p ? p.name : String(pid)
  }

  async function showStandings(tid: number) {
    const r = await apiClient.get(`/api/tournaments/${tid}/standings`)
    alert(JSON.stringify(r.data, null, 2))
  }

  async function showGroupStandings(tid: number) {
    try {
      const r = await apiClient.get(`/api/tournaments/${tid}/groups`)
      
      let output = `Group Standings for Tournament: ${r.data.tournamentName}\n\n`
      
      r.data.groupStandings.forEach((group: any) => {
        output += `${group.groupName}:\n`
        output += `Pos | Player | P | W | D | L | GF | GA | GD | Pts\n`
        output += `----+--------+---+---+---+---+----+----+----+----\n`
        
        group.players.forEach((player: any, index: number) => {
          output += `${(index + 1).toString().padStart(3)} | ${player.name.padEnd(6)} | ${player.played} | ${player.wins} | ${player.draws} | ${player.losses} | ${player.goalsFor.toString().padStart(2)} | ${player.goalsAgainst.toString().padStart(2)} | ${(player.goalDiff >= 0 ? '+' : '') + player.goalDiff.toString().padStart(2)} | ${player.points.toString().padStart(2)}\n`
        })
        output += '\n'
      })
      
      alert(output)
    } catch (error) {
      alert('Failed to fetch group standings')
    }
  }

  async function showKnockoutBracket(tid: number) {
    try {
      const r = await apiClient.get(`/api/tournaments/${tid}/bracket`)
      
      let output = `Knockout Bracket for Tournament: ${r.data.tournamentName}\n\n`
      
      const rounds = ['round-of-16', 'quarter', 'semi', 'final', 'third-place']
      const roundNames = {
        'round-of-16': 'Round of 16',
        'quarter': 'Quarter Finals', 
        'semi': 'Semi Finals',
        'final': 'Final',
        'third-place': 'Third Place Playoff'
      }
      
      rounds.forEach(round => {
        const matches = r.data.bracket[round]
        if (matches && matches.length > 0) {
          output += `${roundNames[round as keyof typeof roundNames]}:\n`
          matches.forEach((match: any, index: number) => {
            const p1Name = match.player1_name || 'TBD'
            const p2Name = match.player2_name || 'TBD'
            const score = match.status === 'completed' 
              ? `${match.score1}-${match.score2}`
              : 'Not played'
            output += `  ${index + 1}. ${p1Name} vs ${p2Name} (${score})\n`
          })
          output += '\n'
        }
      })
      
      if (output.trim() === `Knockout Bracket for Tournament: ${r.data.tournamentName}`) {
        output += 'No knockout matches have been generated yet.\nComplete all group stage matches to generate the bracket.'
      }
      
      alert(output)
    } catch (error) {
      alert('Failed to fetch knockout bracket')
    }
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <CircularProgress size={40} />
        <Typography variant="h6" sx={{ color: '#b0bec5' }}>
          Verifying access...
        </Typography>
      </Box>
    )
  }

  // If not authenticated, the hook will redirect to /admin
  // This is just a fallback in case the redirect fails
  if (!isAuthenticated) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        flexDirection: 'column',
        gap: 2
      }}>
        <Typography variant="h6" sx={{ color: '#f44336' }}>
          Access Denied
        </Typography>
        <Typography variant="body2" sx={{ color: '#b0bec5' }}>
          Redirecting to login...
        </Typography>
      </Box>
    )
  }

  return (
    <Box className="admin-dashboard">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" className="dashboard-title">Admin Dashboard</Typography>
        <Button 
          variant="outlined" 
          color="error" 
          onClick={logout}
          sx={{ 
            borderColor: '#f44336',
            color: '#f44336',
            '&:hover': {
              borderColor: '#d32f2f',
              backgroundColor: 'rgba(244, 67, 54, 0.1)'
            }
          }}
        >
          Logout
        </Button>
      </Box>

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
                sx={{ mt: 1, mb: 2 }}
                className="dashboard-input"
              />
              
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#b0bec5' }}>
                Tournament Type
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Button 
                  variant={tournamentType === 'round_robin' ? "contained" : "outlined"}
                  onClick={() => {
                    setTournamentType('round_robin')
                    setThirdPlacePlayoff(false)
                  }}
                  sx={{ mr: 1, mb: 1 }}
                  size="small"
                >
                  Round Robin
                </Button>
                <Button 
                  variant={tournamentType === 'group_and_knockout' ? "contained" : "outlined"}
                  onClick={() => {
                    setTournamentType('group_and_knockout')
                    setThirdPlacePlayoff(true)
                  }}
                  size="small"
                  sx={{ mb: 1 }}
                >
                  Group + Knockout
                </Button>
              </Box>

              {tournamentType === 'group_and_knockout' && (
                <Box sx={{ mb: 2 }}>
                  <TextField 
                    fullWidth 
                    label="Teams per group" 
                    type="number"
                    value={teamsPerGroup} 
                    onChange={e => setTeamsPerGroup(Number(e.target.value))} 
                    inputProps={{ min: 3, max: 8 }}
                    sx={{ mb: 1 }}
                    size="small"
                  />
                  <TextField 
                    fullWidth 
                    label="Teams advancing per group" 
                    type="number"
                    value={teamsAdvancing} 
                    onChange={e => setTeamsAdvancing(Number(e.target.value))} 
                    inputProps={{ min: 1, max: teamsPerGroup - 1 }}
                    sx={{ mb: 1 }}
                    size="small"
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button 
                      variant={allowThirdPlace ? "contained" : "outlined"}
                      onClick={() => setAllowThirdPlace(!allowThirdPlace)}
                      size="small"
                      sx={{ textTransform: 'none' }}
                    >
                      Allow 3rd place teams: {allowThirdPlace ? 'Yes' : 'No'}
                    </Button>
                    <Button 
                      variant={thirdPlacePlayoff ? "contained" : "outlined"}
                      onClick={() => setThirdPlacePlayoff(!thirdPlacePlayoff)}
                      size="small"
                      sx={{ textTransform: 'none' }}
                    >
                      3rd place playoff: {thirdPlacePlayoff ? 'Yes' : 'No'}
                    </Button>
                  </Box>
                </Box>
              )}

              <Button 
                variant="contained" 
                fullWidth
                onClick={createTournament}
                className="dashboard-button"
                disabled={creatingTournament}
              >
                {creatingTournament ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                Create Tournament
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

          <Card className="dashboard-card" sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" className="card-title">All Players</Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#b0bec5' }}>
                Select a tournament first, then click "Add to selected" to add players
              </Typography>
              {allPlayers.length > 0 && (
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={addAllPlayersToTournament}
                  disabled={addPlayerLoading || !selectedTournament}
                  sx={{ mb: 2, backgroundColor: '#4caf50', '&:hover': { backgroundColor: '#388e3c' } }}
                >
                  {addPlayerLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
                  Add all to selected tournament
                </Button>
              )}
              <Box className="players-list">
                {allPlayers.map((p: any) => (
                  <Box key={p.id} className="player-item">
                    <span className="player-name">{p.name}</span>
                    <Button 
                      size="small" 
                      onClick={() => addPlayerToTournament(p.id)} 
                      disabled={addPlayerLoading || !selectedTournament}
                      className="player-action-button"
                      variant="outlined"
                    > 
                      {addPlayerLoading ? <CircularProgress size={12} /> : 'Add to selected'}
                    </Button>
                  </Box>
                ))}
                {allPlayers.length === 0 && (
                  <Typography variant="body2" sx={{ color: '#b0bec5', fontStyle: 'italic' }}>
                    No players created yet
                  </Typography>
                )}
              </Box>
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
                <Typography variant="body2" sx={{ color: '#81c784', fontWeight: 'bold' }}>
                  Type: {t.type === 'group_and_knockout' ? 'Group + Knockout' : 'Round Robin'}
                </Typography>
                {t.type === 'group_and_knockout' && (
                  <Typography variant="caption" sx={{ color: '#b0bec5', display: 'block' }}>
                    {t.teams_per_group} per group, {t.teams_advancing_per_group} advance
                    {t.allow_third_place_teams && ' + 3rd place teams'}
                    {t.third_place_playoff && ', 3rd place playoff'}
                  </Typography>
                )}
                <Box className="tournament-actions">
                  <Button 
                    sx={{ mr: 1 }} 
                    onClick={() => setSelectedTournament(t.id)}
                    className="action-button"
                    variant={selectedTournament === t.id ? "contained" : "outlined"}
                  >
                    {selectedTournament === t.id ? "Selected" : "Select"}
                  </Button>
                  {t.status!='completed' &&
                  <Button 
                    onClick={() => generateMatches(t.id)} 
                    disabled={generateLoading}
                    className="action-button"
                    variant="outlined"
                    sx={{ mr: 1 }}
                  >
                    {generateLoading ? <><CircularProgress size={14} sx={{ mr: 1 }} />Generating</> : 'Generate Matches'}
                  </Button>
                  }
                  <Button 
                    onClick={() => deleteTournament(t.id, t.name)} 
                    className="action-button"
                    variant="outlined"
                    color="error"
                  >
                    Delete
                  </Button>
                </Box>

                <Accordion 
                  expanded={expandedPlayers.has(t.id)} 
                  onChange={() => togglePlayersExpansion(t.id)}
                  sx={{ mt: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" className="section-subtitle">
                      Players in Tournament ({t.players?.length || 0})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box className="players-list">
                      {t.players?.map((p: any) => (
                        <Box key={p.id} className="player-item" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box>
                            <span className="player-name">{p.name}</span>
                            <Typography variant="caption" sx={{ color: '#81c784', display: 'block' }}>
                              In Tournament
                            </Typography>
                          </Box>
                          {t.status === 'pending' && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => removePlayerFromTournament(t.id, p.id, p.name)}
                              sx={{ ml: 1 }}
                            >
                              Remove
                            </Button>
                          )}
                        </Box>
                      ))}
                      {(!t.players || t.players.length === 0) && (
                        <Typography variant="body2" sx={{ color: '#b0bec5', fontStyle: 'italic' }}>
                          No players added to this tournament yet
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>

                <Accordion 
                  expanded={expandedMatches.has(t.id)} 
                  onChange={() => toggleMatchesExpansion(t.id)}
                  sx={{ mt: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" className="section-subtitle">
                      Matches ({t.matches?.length || 0})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box className="matches-list">
                      {t.matches?.sort((a: any, b: any) => {
                        // Define round order: final first, then semi, then group
                        const roundOrder = { final: 0, semi: 1, group: 2 }
                        const aOrder = roundOrder[a.round as keyof typeof roundOrder] ?? 3
                        const bOrder = roundOrder[b.round as keyof typeof roundOrder] ?? 3
                        if (aOrder !== bOrder) return aOrder - bOrder
                        // If same round, sort by id
                        return a.id - b.id
                      }).map((m: any) => (
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
                      {(!t.matches || t.matches.length === 0) && (
                        <Typography variant="body2" sx={{ color: '#b0bec5', fontStyle: 'italic' }}>
                          No matches generated yet
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
                <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => showStandings(t.id)}
                    className="standings-button"
                    size="small"
                  >
                    Show Standings
                  </Button>
                  {t.type === 'group_and_knockout' && (
                    <>
                      <Button 
                        variant="outlined" 
                        onClick={() => showGroupStandings(t.id)}
                        className="standings-button"
                        size="small"
                        sx={{ color: '#81c784', borderColor: '#81c784' }}
                      >
                        Group Tables
                      </Button>
                      <Button 
                        variant="outlined" 
                        onClick={() => showKnockoutBracket(t.id)}
                        className="standings-button"
                        size="small"
                        sx={{ color: '#ff9800', borderColor: '#ff9800' }}
                      >
                        Knockout Bracket
                      </Button>
                    </>
                  )}
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

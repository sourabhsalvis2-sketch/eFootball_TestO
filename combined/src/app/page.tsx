'use client'

import React, { useEffect, useState } from 'react'
import apiClient from '@/lib/api'
import { Typography, Card, CardContent, Grid, Button, Box, List, ListItem, ListItemText, Divider, CircularProgress, Collapse, IconButton, Chip } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupIcon from '@mui/icons-material/Group'
import StarIcon from '@mui/icons-material/Star'
import SportsIcon from '@mui/icons-material/Sports'

type Details = {
  standings?: any[] | null
  winner?: any | null
  loading?: boolean
  expanded?: boolean
}

export default function Home() {
  const [tournaments, setTournaments] = useState<any[]>([])
  const [details, setDetails] = useState<Record<number, Details>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await apiClient.get('/api/tournaments')
        if (!mounted) return
        if (Array.isArray(r.data)) {
          setTournaments(r.data)
          setLoadError(null)
          // fetch details for each tournament
          for (const t of r.data) {
            fetchDetails(t.id)
          }
        } else {
          console.error('Unexpected /api/tournaments response:', r.data)
          setTournaments([])
          setLoadError('Unexpected response from server')
        }
      } catch (err: any) {
        console.error('Failed to load tournaments', err)
        setTournaments([])
        setLoadError(err?.message || 'Network error')
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  async function fetchDetails(tid: number) {
    setDetails(d => ({ ...d, [tid]: { ...(d[tid] || {}), loading: true } }))
    try {
      // Get fresh tournament data to check current status
      const tournamentResponse = await apiClient.get(`/api/tournaments`)
      const tournament = tournamentResponse.data.find((t: any) => t.id === tid)
      
      const requests = [
        apiClient.get(`/api/tournaments/${tid}/standings`).then(r => r.data).catch(() => null)
      ]
      
      // Only fetch winner for completed tournaments
      if (tournament?.status === 'completed') {
        requests.push(
          apiClient.get(`/api/tournaments/${tid}/winner`).then(r => r.data).catch(() => null)
        )
      } else {
        requests.push(Promise.resolve(null)) // Return null for non-completed tournaments
      }
      
      const [s, w] = await Promise.all(requests)
      setDetails(d => ({ ...d, [tid]: { standings: s, winner: w, loading: false } }))
    } catch (e) {
      setDetails(d => ({ ...d, [tid]: { ...(d[tid] || {}), loading: false } }))
    }
  }

  function getMatchStatusClass(match: any) {
    if (match.status === 'completed') return 'match-status-completed'
    if (match.status === 'ongoing') return 'match-status-ongoing'
    return 'match-status-scheduled'
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <EmojiEventsIcon sx={{ fontSize: 16, color: '#4caf50' }} />
      case 'in_progress': return <SportsIcon sx={{ fontSize: 16, color: '#ff9800' }} />
      case 'pending': return <StarIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />
      default: return <StarIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />
    }
  }

  return (
    <div>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" sx={{ fontFamily: 'Orbitron', fontWeight: 700, color: '#00e5ff', textShadow: '0 0 20px rgba(0,229,255,0.5)' }}>
          ⚽ eFootball Dashboard
        </Typography>
        <Typography variant="h6" sx={{ color: '#b0bec5', mt: 1 }}>
          Tournament Management System
        </Typography>
      </Box>
      {loadError && <Typography color="error">{loadError}</Typography>}
      <Box className="tournaments-list">
        {tournaments.length === 0 && !loadError && <Typography>No tournaments yet</Typography>}
        {tournaments.map(t => {
          const det = details[t.id] || {}
          const playerLookup: Record<number, string> = {}
          for (const p of (t.players || [])) playerLookup[p.id] = p.name
          return (
            <Card key={t.id} className="tournament-card" elevation={6}>
              <CardContent>
                <Box className="tournament-header">
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SportsSoccerIcon sx={{ color: 'rgba(0,200,255,0.9)', fontSize: 24 }} />
                      <Typography variant="h5" sx={{ fontWeight: 700, color: '#ffffff' }}>{t.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                      {getStatusIcon(t.status)}
                      <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                        Status: <span style={{ color: '#00e5ff', fontWeight: 600 }}>{t.status.toUpperCase()}</span>
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Winner section in the middle */}
                  <Box sx={{ textAlign: 'center', flex: 1, mx: 2 }}>
                    {det.winner ? (
                      <Box>
                        <EmojiEventsIcon sx={{ color: '#ffd700', fontSize: 24, mb: 0.5 }} />
                        <Typography variant="h6" sx={{ color: '#ffd700', fontWeight: 700 }}>
                          Champion
                        </Typography>
                        <Typography variant="h5" sx={{ color: '#ffffff', fontWeight: 600 }}>
                          {det.winner.name}
                        </Typography>
                      </Box>
                    ) : (
                      <Box>
                        <EmojiEventsIcon sx={{ color: '#666', fontSize: 24, mb: 0.5 }} />
                        <Typography variant="body1" sx={{ color: '#b0bec5' }}>
                          {t.status === 'completed' ? 'No Winner' : 'Tournament in Progress'}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  
                  <Box sx={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <GroupIcon sx={{ color: '#00e5ff', fontSize: 20 }} />
                      <Typography variant="h6" sx={{ color: '#ffffff' }}>Players</Typography>
                      <Typography variant="h4" sx={{ color: '#00e5ff', fontWeight: 700 }}>{t.players?.length ?? 0}</Typography>
                    </Box>
                    <IconButton
                      onClick={() => setDetails(d => ({ ...d, [t.id]: { ...(d[t.id] || {}), expanded: !d[t.id]?.expanded } }))}
                      aria-label="expand"
                    >
                      <ExpandMoreIcon sx={{ transform: details[t.id]?.expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 300ms' }} />
                    </IconButton>
                  </Box>
                </Box>

                <Collapse in={!!details[t.id]?.expanded} timeout="auto">
                  <Box sx={{ mt: 2 }}>
                    {det.loading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={18} /> <Typography sx={{ ml: 1 }}>Loading details...</Typography></Box>
                    ) : (
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2">🏆 Winner</Typography>
                          <Box className="winner-box">
                            {det.winner ? (
                              <>
                                <EmojiEventsIcon className="winner-trophy" />
                                <Chip label={det.winner.name} color="success" />
                              </>
                            ) : (
                              <Typography sx={{ color: '#b0bec5' }}>TBD</Typography>
                            )}
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2">📊 Standings</Typography>
                          {det.standings && det.standings.length ? (
                            <List dense>
                              {det.standings.map((s, index) => (
                                <ListItem key={s.playerId} sx={{ 
                                  background: index === 0 ? 'linear-gradient(90deg, rgba(255,215,0,0.1), rgba(255,193,7,0.05))' : 'transparent',
                                  border: index === 0 ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent'
                                }}>
                                  <ListItemText 
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {index === 0 && <EmojiEventsIcon sx={{ color: '#ffd700', fontSize: 16 }} />}
                                        <span style={{ fontWeight: index < 3 ? 700 : 400 }}>
                                          #{index + 1} {s.name}
                                        </span>
                                      </Box>
                                    }
                                    secondary={`${s.points} pts — Goals Scored ${s.goalsFor} / Goals Conceeded ${s.goalsAgainst} / Goals Difference ${s.goalDiff}`} 
                                  />
                                </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#b0bec5' }}>No standings yet</Typography>
                          )}
                        </Grid>

                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2">⚽ Matches</Typography>
                          {Array.isArray(t.matches) && t.matches.length ? (
                            <List dense>
                              {t.matches.map((m: any) => (
                                <ListItem 
                                  key={m.id} 
                                  className={getMatchStatusClass(m)}
                                  sx={{ borderRadius: 1, mb: 0.5 }}
                                >
                                  <ListItemText 
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <SportsSoccerIcon sx={{ fontSize: 16, color: '#00e5ff' }} />
                                        {`${playerLookup[m.player1_id] ?? m.player1_id} vs ${playerLookup[m.player2_id] ?? m.player2_id} — ${m.score1 ?? '-'} : ${m.score2 ?? '-'}`}
                                      </Box>
                                    }
                                    secondary={`${m.round.toUpperCase()}`} 
                                  />
                                </ListItem>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#b0bec5' }}>No matches yet</Typography>
                          )}
                        </Grid>
                      </Grid>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </div>
  )
}

'use client'

import React, { useEffect, useState } from 'react'
import apiClient from '@/lib/api'
import { 
  Typography, Card, CardContent, Grid, Button, Box, List, ListItem, ListItemText, 
  Divider, CircularProgress, Collapse, IconButton, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import GroupIcon from '@mui/icons-material/Group'
import StarIcon from '@mui/icons-material/Star'
import SportsIcon from '@mui/icons-material/Sports'
import styles from './page.module.css'

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
      case 'completed': return <CheckCircleIcon sx={{ fontSize: 16, color: '#4caf50' }} />
      case 'in_progress': return <SportsIcon sx={{ fontSize: 16, color: '#ff9800' }} />
      case 'pending': return <StarIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />
      default: return <StarIcon sx={{ fontSize: 16, color: '#9e9e9e' }} />
    }
  }

  return (
    <div>
      <Box className={styles.pageHeader}>
        <Typography variant="h3" className={styles.mainTitle}>
          ⚽ eFootball Gadhinglaj
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
                <Box className={styles.tournamentHeader}>
                  {/* Left section - Tournament info */}
                  <Box className={styles.tournamentInfo}>
                    <Box className={styles.tournamentTitleSection}>
                      <SportsSoccerIcon className={styles.soccerIconSmall} />
                      <Typography variant="h5" className={styles.tournamentTitle}>
                        {t.name}
                      </Typography>
                    </Box>
                    <Box className={styles.tournamentStatusSection}>
                      {getStatusIcon(t.status)}
                      <Typography variant="body2" className={styles.statusText}>
                        Status: <span style={{ color: '#00e5ff', fontWeight: 600 }}>{t.status.toUpperCase()}</span>
                      </Typography>
                    </Box>
                  </Box>
                  
                  {/* Center section - Winner (hidden when expanded) */}
                  {!details[t.id]?.expanded && (
                    <Box className={styles.winnerSection}>
                      {det.winner ? (
                        <Box>
                          <EmojiEventsIcon className={styles.trophyIcon} />
                          <Typography variant="h6" className={styles.championTitle}>
                            Champion
                          </Typography>
                        <Typography variant="h5" className={styles.championName}>
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
                  )}
                  
                  {/* Right section - Players and Expand */}
                  <Box sx={{ 
                    textAlign: 'center', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 2,
                    flexShrink: 0,
                    order: { xs: 3, sm: 0 }
                  }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <GroupIcon sx={{ color: '#00e5ff', fontSize: { xs: 18, sm: 20 } }} />
                      <Typography variant="h6" sx={{ 
                        color: '#ffffff', 
                        fontSize: { xs: '0.875rem', sm: '1.25rem' } 
                      }}>
                        Players
                      </Typography>
                      <Typography variant="h4" sx={{ 
                        color: '#00e5ff', 
                        fontWeight: 700,
                        fontSize: { xs: '1.5rem', sm: '2.125rem' }
                      }}>
                        {t.players?.length ?? 0}
                      </Typography>
                    </Box>
                    <IconButton
                      onClick={() => setDetails(d => ({ ...d, [t.id]: { ...(d[t.id] || {}), expanded: !d[t.id]?.expanded } }))}
                      aria-label="expand"
                      sx={{ 
                        color: '#00e5ff',
                        '&:hover': { backgroundColor: 'rgba(0,229,255,0.1)' }
                      }}
                    >
                      <ExpandMoreIcon sx={{ 
                        transform: details[t.id]?.expanded ? 'rotate(180deg)' : 'rotate(0deg)', 
                        transition: 'transform 300ms',
                        fontSize: { xs: 24, sm: 28 }
                      }} />
                    </IconButton>
                  </Box>
                </Box>

                <Collapse in={!!details[t.id]?.expanded} timeout="auto">
                  <Box sx={{ mt: 2 }}>
                    {det.loading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center' }}><CircularProgress size={18} /> <Typography sx={{ ml: 1 }}>Loading details...</Typography></Box>
                    ) : (
                      <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
                        <Grid item xs={12} md={2}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                            🏆 Winner
                          </Typography>
                          <Box className="winner-box">
                            {det.winner ? (
                              <>
                                <Chip label={det.winner.name} color="success" sx={{ fontWeight: 600, fontSize: '1rem' }} />
                              </>
                            ) : (
                              <Typography sx={{ color: '#b0bec5' }}>TBD</Typography>
                            )}
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={5}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                            📊 Standings
                          </Typography>
                          {det.standings && det.standings.length ? (
                            <TableContainer 
                              component={Paper} 
                              sx={{ 
                                background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(13,27,42,0.95) 100%)',
                                border: '1px solid rgba(0,229,255,0.3)',
                                borderRadius: 2,
                                boxShadow: '0 8px 32px rgba(0,229,255,0.15)',
                                maxHeight: { xs: 300, sm: 400 },
                                overflow: 'auto',
                                '&::-webkit-scrollbar': {
                                  width: '6px',
                                },
                                '&::-webkit-scrollbar-track': {
                                  background: 'rgba(0,0,0,0.1)',
                                },
                                '&::-webkit-scrollbar-thumb': {
                                  background: 'rgba(0,229,255,0.3)',
                                  borderRadius: '3px',
                                },
                              }}
                            >
                              <Table size="small" stickyHeader>
                                <TableHead>
                                  <TableRow>
                                    <TableCell 
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      #
                                    </TableCell>
                                    <TableCell 
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      Player
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      Pts
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      P
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      W
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      D
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      L
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      GS
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      GC
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={{ 
                                        background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
                                        color: '#00e5ff',
                                        fontWeight: 700,
                                        fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                        borderBottom: '2px solid rgba(0,229,255,0.3)',
                                        padding: { xs: '6px 2px', sm: '8px 4px' }
                                      }}
                                    >
                                      GD
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {det.standings.map((s, index) => (
                                    <TableRow 
                                      key={s.playerId}
                                      sx={{
                                        background: index === 0 
                                          ? 'linear-gradient(90deg, rgba(255,215,0,0.15) 0%, rgba(255,193,7,0.08) 100%)'
                                          : index === 1
                                          ? 'linear-gradient(90deg, rgba(224,224,224,0.12) 0%, rgba(192,192,192,0.06) 100%)'
                                          : index === 2
                                          ? 'linear-gradient(90deg, rgba(205,127,50,0.1) 0%, rgba(184,115,51,0.05) 100%)'
                                          : 'transparent',
                                        border: index === 0 
                                          ? '1px solid rgba(255,215,0,0.4)' 
                                          : index === 1
                                          ? '1px solid rgba(224,224,224,0.3)'
                                          : '1px solid transparent',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                          background: 'rgba(0,229,255,0.08)',
                                          transform: 'translateX(4px)',
                                          boxShadow: '4px 0 12px rgba(0,229,255,0.2)',
                                        }
                                      }}
                                    >
                                      <TableCell 
                                        sx={{ 
                                          color: index === 0 ? '#ffd700' : index === 1 ? '#e0e0e0' : index === 2 ? '#cd7f32' : '#ffffff',
                                          fontWeight: index < 3 ? 700 : 400,
                                          fontSize: '0.875rem',
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {index + 1}
                                      </TableCell>
                                      <TableCell 
                                        sx={{ 
                                          color: '#ffffff',
                                          fontWeight: index < 3 ? 700 : 500,
                                          fontSize: '0.875rem',
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.name}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#00e5ff',
                                          fontWeight: 700,
                                          fontSize: '0.875rem',
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.points}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#b0bec5',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.played}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#4caf50',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          fontWeight: 600,
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.wins}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#ff9800',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          fontWeight: 600,
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.draws}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#f44336',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          fontWeight: 600,
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.losses}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#81c784',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          fontWeight: 600,
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.goalsFor}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: '#e57373',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          fontWeight: 600,
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.goalsAgainst}
                                      </TableCell>
                                      <TableCell 
                                        align="center"
                                        sx={{ 
                                          color: s.goalDiff >= 0 ? '#4caf50' : '#f44336',
                                          fontSize: { xs: '0.6rem', sm: '0.75rem' },
                                          fontWeight: 700,
                                          padding: { xs: '4px 2px', sm: '6px 4px' },
                                          borderBottom: '1px solid rgba(255,255,255,0.1)'
                                        }}
                                      >
                                        {s.goalDiff >= 0 ? '+' : ''}{s.goalDiff}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Typography variant="body2" sx={{ color: '#b0bec5' }}>No standings yet</Typography>
                          )}
                        </Grid>

                        <Grid item xs={12} md={5}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>⚽ Matches</Typography>
                          {Array.isArray(t.matches) && t.matches.length ? (
                            <List dense>
                              {t.matches.sort((a: any, b: any) => {
                                // Define round order: final first, then semi, then group
                                const roundOrder = { final: 0, semi: 1, group: 2 }
                                const aOrder = roundOrder[a.round as keyof typeof roundOrder] ?? 3
                                const bOrder = roundOrder[b.round as keyof typeof roundOrder] ?? 3
                                if (aOrder !== bOrder) return aOrder - bOrder
                                // If same round, sort by id
                                return a.id - b.id
                              }).map((m: any) => (
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

'use client'

import React, { useEffect, useState, useCallback } from 'react'
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
  runnerUp?: any | null
  thirdPlace?: any | null
  loading?: boolean
  expanded?: boolean
  showAllMatches?: boolean
}

const standingsHeaderCellSx = {
  background: 'linear-gradient(135deg, rgba(0,229,255,0.1) 0%, rgba(13,71,161,0.1) 100%)',
  color: '#00e5ff',
  fontWeight: 700,
  fontSize: { xs: '0.6rem', sm: '0.75rem' },
  borderBottom: '2px solid rgba(0,229,255,0.3)',
  padding: { xs: '6px 2px', sm: '8px 4px' }
};

export default function Home() {
  const [tournaments, setTournaments] = useState<any[]>([])
  const [details, setDetails] = useState<Record<number, Details>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetchingDetails, setFetchingDetails] = useState<Set<number>>(new Set())

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const r = await apiClient.get('/api/tournaments')
        if (!mounted) return
        if (Array.isArray(r.data)) {
          setTournaments(r.data)
          console.log('Loaded tournaments:', r.data)
          setLoadError(null)
          // fetch details for each tournament, pass tournament data to avoid race condition
          for (const t of r.data) {
            fetchDetails(t.id, t)
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

  const toggleExpanded = useCallback((tournamentId: number) => {
    setDetails(d => ({
      ...d,
      [tournamentId]: {
        ...(d[tournamentId] || {}),
        expanded: !d[tournamentId]?.expanded
      }
    }))
  }, [])

  async function fetchDetails(tid: number, tournamentData?: any) {
    // Prevent concurrent fetches for the same tournament
    if (fetchingDetails.has(tid)) return

    setFetchingDetails(prev => {
      const newSet = new Set(prev)
      newSet.add(tid)
      return newSet
    })
    setDetails(d => ({ ...d, [tid]: { ...(d[tid] || {}), loading: true } }))

    try {
      // Use passed tournament data or find in current tournaments state
      const tournament = tournamentData || tournaments.find(t => t.id === tid)

      const requests = [
        apiClient.get(`/api/tournaments/${tid}/standings`).then(r => r.data).catch(() => null)
      ]

      // Only fetch winner, runner-up, and third place for completed tournaments
      if (tournament?.status === 'completed') {
        requests.push(
          apiClient.get(`/api/tournaments/${tid}/winner`).then(r => r.data).catch(() => null),
          apiClient.get(`/api/tournaments/${tid}/runner-up`).then(r => r.data).catch(() => null)
        )
        
        // Only fetch third place for tournaments with third place playoff enabled
        if (tournament?.type === 'group_and_knockout' && tournament?.third_place_playoff) {
          requests.push(
            apiClient.get(`/api/tournaments/${tid}/third-place`).then(r => r.data).catch(() => null)
          )
        } else {
          requests.push(Promise.resolve(null)) // third place not applicable
        }
      } else {
        requests.push(
          Promise.resolve(null), // winner
          Promise.resolve(null), // runner-up
          Promise.resolve(null)  // third place
        )
      }

      const [s, w, ru, tp] = await Promise.all(requests)
      setDetails(d => ({
        ...d,
        [tid]: {
          ...(d[tid] || {}), // Preserve existing state like expanded
          standings: s,
          winner: w,
          runnerUp: ru,
          thirdPlace: tp,
          loading: false
        }
      }))
    } catch (e) {
      setDetails(d => ({
        ...d,
        [tid]: {
          ...(d[tid] || {}), // Preserve existing state like expanded
          loading: false
        }
      }))
    } finally {
      setFetchingDetails(prev => {
        const newSet = new Set(prev)
        newSet.delete(tid)
        return newSet
      })
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

          // Group standings by group name
          const groupedStandings: Record<string, any[]> = (det.standings || []).reduce((acc, s) => {
            const groupName = s.group || "Overall"; // Default if no group info
            if (!acc[groupName]) {
              acc[groupName] = [];
            }
            acc[groupName].push(s);
            console.log('Grouped Standings: ', acc);
            return acc;

          }, {});


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

                  {/* Center section - Top 3 Results (hidden when expanded) */}
                  {!details[t.id]?.expanded && (
                    <Box className={styles.winnerSection}>
                      {det.winner ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <EmojiEventsIcon className={styles.trophyIcon} />
                            <Typography variant="h6" className={styles.championTitle}>
                              Results
                            </Typography>
                          </Box>
                          
                          {/* Winner */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <span style={{ fontSize: '1.2rem' }}>🏆</span>
                            <Typography variant="body1" sx={{ fontWeight: 600, color: '#ffd700' }}>
                              {det.winner.name}
                            </Typography>
                          </Box>
                          
                          {/* Runner-up */}
                          {det.runnerUp && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <span style={{ fontSize: '1.1rem' }}>🥈</span>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: '#c0c0c0' }}>
                                {det.runnerUp.name}
                              </Typography>
                            </Box>
                          )}
                          
                          {/* Third place */}
                          {det.thirdPlace && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <span style={{ fontSize: '1.1rem' }}>🥉</span>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: '#cd7f32' }}>
                                {det.thirdPlace.name}
                              </Typography>
                            </Box>
                          )}
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
                      onClick={() => toggleExpanded(t.id)}
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
                        <Grid item xs={12} md={3}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                            🏆 Results
                          </Typography>
                          <Box className="winner-box">
                            {det.winner ? (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span>🏆</span>
                                  <Chip label={det.winner.name} color="success" sx={{ fontWeight: 600, fontSize: '0.9rem' }} />
                                </Box>
                                {det.runnerUp && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <span>🥈</span>
                                    <Chip label={det.runnerUp.name} variant="outlined" sx={{ fontWeight: 500, fontSize: '0.85rem', borderColor: '#c0c0c0', color: '#c0c0c0' }} />
                                  </Box>
                                )}
                                {det.thirdPlace && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <span>🥉</span>
                                    <Chip label={det.thirdPlace.name} variant="outlined" sx={{ fontWeight: 500, fontSize: '0.85rem', borderColor: '#cd7f32', color: '#cd7f32' }} />
                                  </Box>
                                )}
                              </Box>
                            ) : (
                              <Typography sx={{ color: '#b0bec5' }}>TBD</Typography>
                            )}
                          </Box>
                        </Grid>

                        <Grid item xs={12} md={4}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                            📊 Standings
                          </Typography>
                          {Object.keys(groupedStandings).length > 0 ? (
                            Object.entries(groupedStandings).map(([groupName, standings]) => (
                              <Box key={groupName} sx={{ mb: 4 }}>
                                <Typography variant="h6" sx={{ color: '#00e5ff', mb: 1 }}>
                                  {groupName}
                                </Typography>
                                <TableContainer
                                  component={Paper}
                                  sx={{
                                    background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(13,27,42,0.95) 100%)',
                                    border: '1px solid rgba(0,229,255,0.3)',
                                    borderRadius: 2,
                                    boxShadow: '0 8px 32px rgba(0,229,255,0.15)',
                                  }}
                                >
                                  <Table stickyHeader>
                                    <TableHead>
                                      <TableRow>
                                    <TableCell 
                                      sx={standingsHeaderCellSx}
                                    >
                                      #
                                    </TableCell>
                                    <TableCell 
                                      sx={standingsHeaderCellSx}
                                    >
                                      Player
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      Pts
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      P
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      W
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      D
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      L
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      GS
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      GC
                                    </TableCell>
                                    <TableCell 
                                      align="center"
                                      sx={standingsHeaderCellSx}
                                    >
                                      GD
                                    </TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {standings.map((s: any, index: number) => (
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
                              </Box>
                            ))
                          ) : (
                            <Typography variant="body2" sx={{ color: '#b0bec5' }}>No standings yet</Typography>
                          )}
                        </Grid>

                        <Grid item xs={12} md={5}>
                          <Typography variant="subtitle2" sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>⚽ Matches</Typography>
                          {Array.isArray(t.matches) && t.matches.length ? (
                            (() => {
                              // Sort matches as before
                              const sortedMatches = [...t.matches].sort((a: any, b: any) => {
                                // Define round order: final first, then third-place, semi, quarter, then group
                                const roundOrder = { 
                                  final: 0, 
                                  'third-place': 1, 
                                  semi: 2, 
                                  quarter: 3, 
                                  'round-of-16': 4,
                                  group: 5 
                                }
                                const aOrder = roundOrder[a.round as keyof typeof roundOrder] ?? 6
                                const bOrder = roundOrder[b.round as keyof typeof roundOrder] ?? 6
                                if (aOrder !== bOrder) return aOrder - bOrder
                                return a.id - b.id
                              });
                              // Split matches - include quarter and third-place in main matches
                              const mainMatches = sortedMatches.filter((m: any) => 
                                m.round === 'final' || m.round === 'semi' || m.round === 'quarter' || m.round === 'third-place' || m.round === 'round-of-16'
                              );
                              const otherMatches = sortedMatches.filter((m: any) => 
                                m.round !== 'final' && m.round !== 'semi' && m.round !== 'quarter' && m.round !== 'third-place' && m.round !== 'round-of-16'
                              );
                              const expanded = details[t.id]?.showAllMatches;
                              return (
                                <>
                                  <List dense>
                                    {mainMatches.map((m: any) => (
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
                                    {expanded && otherMatches.map((m: any) => (
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
                                  {otherMatches.length > 0 && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      sx={{ mt: 1, color: '#00e5ff', borderColor: '#00e5ff' }}
                                      onClick={() => setDetails(d => ({
                                        ...d,
                                        [t.id]: {
                                          ...(d[t.id] || {}),
                                          showAllMatches: !d[t.id]?.showAllMatches
                                        }
                                      }))}
                                    >
                                      {expanded ? 'Hide Group Matches' : 'Show All Matches'}
                                    </Button>
                                  )}
                                </>
                              );
                            })()
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
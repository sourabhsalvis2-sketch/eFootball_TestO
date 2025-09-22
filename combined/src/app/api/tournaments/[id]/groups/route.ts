import { NextRequest, NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const tournamentId = parseInt(resolvedParams.id)
    
    if (isNaN(tournamentId)) {
      return NextResponse.json(
        { error: 'Invalid tournament ID' },
        { status: 400 }
      )
    }

    // Get tournament details
    const tournament = await DatabaseService.getOne('SELECT * FROM tournaments WHERE id = ?', [tournamentId])
    if (!tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Get group standings based on tournament type
    if (tournament.type === 'group_and_knockout') {
      const groupStandings = await DatabaseService.computeGroupStandings(tournamentId, tournament)
      return NextResponse.json({
        tournamentId,
        tournamentName: tournament.name,
        tournamentType: tournament.type,
        groupStandings
      })
    } else {
      // For legacy round robin tournaments, convert to group format
      const standings = await DatabaseService.computeStandings(tournamentId)
      
      // Group standings by existing group field
      const grouped: Record<string, typeof standings> = {}
      for (const stat of standings) {
        if (!grouped[stat.group]) {
          grouped[stat.group] = []
        }
        grouped[stat.group].push(stat)
      }

      const groupStandings = Object.entries(grouped)
        .sort(([groupNameA], [groupNameB]) => groupNameA.localeCompare(groupNameB))
        .map(([groupName, players]) => ({
          groupLetter: groupName.replace('GROUP ', ''),
          groupName,
          players: players.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor)
        }))

      return NextResponse.json({
        tournamentId,
        tournamentName: tournament.name,
        tournamentType: tournament.type,
        groupStandings
      })
    }
  } catch (error) {
    console.error('Get group standings error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch group standings' },
      { status: 500 }
    )
  }
}
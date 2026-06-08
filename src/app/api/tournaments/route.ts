import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { createTournament, NUM_TEAMS } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { teams, date } = await req.json();
    if (!Array.isArray(teams) || teams.length !== NUM_TEAMS) {
      return NextResponse.json({ error: 'Invalid input: need 6 teams with 2 players each' }, { status: 400 });
    }

    for (const team of teams) {
      if (!team?.player1?.trim() || !team?.player2?.trim()) {
        return NextResponse.json({ error: 'Each team needs 2 player names' }, { status: 400 });
      }
    }

    const active = await sql<{ c: number }[]>`select count(*)::int as c from tournaments where is_finalized=false`;
    if ((active[0]?.c || 0) > 0) {
      return NextResponse.json({ error: 'active_tournament_exists' }, { status: 409 });
    }

    const t = createTournament(teams, date);

    await sql`insert into tournaments (id, access_code, date, current_round, is_finalized)
      values (${t.id}, ${''}, ${t.date}, ${t.currentRound}, ${t.isFinalized})`;

    for (const p of t.players) {
      await sql`insert into players (tournament_id, id, name, team_id, total_score)
        values (${t.id}, ${p.id}, ${p.name}, ${p.teamId}, 0)`;
    }

    for (const m of t.matches) {
      await sql`insert into matches (
        tournament_id, id, round, court, team_a_id, team_b_id,
        team_a_p1, team_a_p2, team_b_p1, team_b_p2,
        score_a, score_b, completed
      ) values (
        ${t.id}, ${m.id}, ${m.round}, ${m.court}, ${m.teamAId}, ${m.teamBId},
        ${m.teamA.player1}, ${m.teamA.player2}, ${m.teamB.player1}, ${m.teamB.player2},
        ${m.scoreA}, ${m.scoreB}, ${m.completed}
      )`;
    }

    await broadcastTournamentUpdate(t.id, t);
    return NextResponse.json(t);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { assembleTournament } from '@/lib/tournamentRepo';
import { validateScore, getWinnerTeam, NUM_ROUNDS } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await ensureSchema();
    const { matchId, scoreA, scoreB } = await req.json();
    if (!validateScore(Number(scoreA), Number(scoreB))) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const [match] = await sql<any[]>`select * from matches where tournament_id=${id} and id=${matchId} limit 1`;
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const winner = getWinnerTeam(Number(scoreA), Number(scoreB));
    await sql`update matches set score_a=${scoreA}, score_b=${scoreB}, completed=true, winner_team=${winner}
      where tournament_id=${id} and id=${matchId}`;

    const round = match.round as number;
    const currentRoundMatches = await sql<{ completed: boolean }[]>`
      select completed from matches where tournament_id=${id} and round=${round}`;
    const roundCompleted = currentRoundMatches.every((m: { completed: boolean }) => m.completed === true);
    if (roundCompleted) {
      const [trow] = await sql<any[]>`select current_round from tournaments where id=${id}`;
      const currentRound = Number(trow?.current_round || 1);
      if (currentRound === round && currentRound < NUM_ROUNDS) {
        await sql`update tournaments set current_round=${currentRound + 1} where id=${id}`;
      }
    }

    const updated = await assembleTournament(id);
    if (updated) {
      await broadcastTournamentUpdate(id, updated, {
        matchId: Number(matchId),
        round: match.round as number,
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
      });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

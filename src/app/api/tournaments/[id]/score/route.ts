import { after, NextResponse } from 'next/server';
import { ensureTournamentMeta, sql } from '@/lib/db';
import { validateScore, getWinnerTeam, syncPlayingCourts, stampOpenMatchStarts } from '@/lib/gameLogic';
import { assembleTournament, persistMatchCourts, persistMatchNumbers, persistOpenMatchStarts, snapshotMatchCourts } from '@/lib/tournamentRepo';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await ensureTournamentMeta();
    const { matchId, scoreA, scoreB } = await req.json();
    if (!validateScore(Number(scoreA), Number(scoreB))) {
      return NextResponse.json({ error: 'Invalid score' }, { status: 400 });
    }

    const [match] = await sql<{ round: number; court: number }[]>`
      select round, court from matches where tournament_id=${id} and id=${matchId} limit 1`;
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const winner = getWinnerTeam(Number(scoreA), Number(scoreB));
    const now = new Date();
    // SET expressions read the pre-update row, so re-scoring keeps its finish_order and end time.
    await sql`update matches set score_a=${scoreA}, score_b=${scoreB}, completed=true, winner_team=${winner},
      finish_order = case when completed then finish_order else (
        select coalesce(max(finish_order), 0) + 1
        from matches
        where tournament_id = ${id} and id <> ${matchId}
      ) end,
      ended_at = case
        when completed then ended_at
        when started_at is not null then ${now}
        else ended_at
      end
      where tournament_id=${id} and id=${matchId}`;

    const round = Number(match.round);
    await sql`
      update tournaments t
      set current_round = t.current_round + 1
      where t.id = ${id}
        and t.current_round = ${round}
        and not exists (
          select 1 from matches where tournament_id = ${id} and round = ${round} and completed = false
        )
        and t.current_round < (
          select coalesce(max(round), 1) from matches where tournament_id = ${id}
        )`;

    const freedCourt = Number(match.court) || undefined;
    const updated = await assembleTournament(id);
    if (updated) {
      const before = snapshotMatchCourts(updated.matches);
      syncPlayingCourts(updated, { freedCourt });
      await persistMatchCourts(id, updated.matches, before);
      await persistMatchNumbers(id, updated.matches);
      if (updated.startedAt) {
        stampOpenMatchStarts(updated, now.toISOString());
        await persistOpenMatchStarts(id, now);
      }
      after(() =>
        broadcastTournamentUpdate(id, updated, {
          matchId: Number(matchId),
          round,
          scoreA: Number(scoreA),
          scoreB: Number(scoreB),
        })
      );
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

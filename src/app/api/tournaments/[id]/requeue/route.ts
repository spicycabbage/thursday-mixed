import { NextResponse } from 'next/server';
import { ensureTournamentMeta, sql } from '@/lib/db';
import { assembleTournament } from '@/lib/tournamentRepo';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { matchId } = await req.json();
    const numericMatchId = Number(matchId);
    if (!Number.isInteger(numericMatchId)) {
      return NextResponse.json({ error: 'Invalid match' }, { status: 400 });
    }

    await ensureTournamentMeta();

    const [tournament] = await sql<{ is_finalized: boolean }[]>`
      select is_finalized from tournaments where id = ${id} limit 1
    `;
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (tournament.is_finalized) {
      return NextResponse.json({ error: 'Tournament is finalized' }, { status: 400 });
    }

    const [match] = await sql<{ id: number; completed: boolean }[]>`
      select id, completed from matches where tournament_id = ${id} and id = ${numericMatchId} limit 1
    `;
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    if (!match.completed) {
      return NextResponse.json({ error: 'Match is already in the queue' }, { status: 400 });
    }

    const [orderRow] = await sql<{ next_order: number }[]>`
      select coalesce(max(case when queue_order > 0 then queue_order else id end), 0) + 1 as next_order
      from matches
      where tournament_id = ${id}
    `;
    const nextOrder = Number(orderRow?.next_order ?? numericMatchId);

    await sql`
      update matches
      set score_a = null,
          score_b = null,
          completed = false,
          winner_team = null,
          queue_order = ${nextOrder}
      where tournament_id = ${id} and id = ${numericMatchId}
    `;

    const [roundRow] = await sql<{ min_round: number }[]>`
      select coalesce(min(round), 1)::int as min_round
      from matches
      where tournament_id = ${id} and completed = false
    `;
    await sql`
      update tournaments
      set current_round = ${Number(roundRow?.min_round ?? 1)}
      where id = ${id}
    `;

    const updated = await assembleTournament(id);
    if (updated) await broadcastTournamentUpdate(id, updated);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

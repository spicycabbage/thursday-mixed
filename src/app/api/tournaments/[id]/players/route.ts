import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { assembleTournament } from '@/lib/tournamentRepo';
import { NUM_TEAMS, normalizeName } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await ensureSchema();

    const [tournament] = await sql`select id from tournaments where id=${id} limit 1`;
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const { teams } = await req.json();
    if (!Array.isArray(teams) || teams.length !== NUM_TEAMS) {
      return NextResponse.json({ error: 'Invalid teams: need 6 teams with 2 players each' }, { status: 400 });
    }

    for (let i = 0; i < NUM_TEAMS; i++) {
      const teamId = i + 1;
      const player1Id = i * 2 + 1;
      const player2Id = i * 2 + 2;
      await sql`update players set name=${normalizeName(teams[i].player1)} where tournament_id=${id} and id=${player1Id}`;
      await sql`update players set name=${normalizeName(teams[i].player2)} where tournament_id=${id} and id=${player2Id}`;
    }

    const updated = await assembleTournament(id);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to fetch updated tournament' }, { status: 500 });
    }
    await broadcastTournamentUpdate(id, updated);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

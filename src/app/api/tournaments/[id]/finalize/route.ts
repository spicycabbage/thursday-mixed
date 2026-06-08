import { NextResponse } from 'next/server';
import { ensureSchema, sql } from '@/lib/db';
import { assembleTournament } from '@/lib/tournamentRepo';
import { analyticsCache } from '@/lib/cache';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await ensureSchema();
    await sql`update tournaments set is_finalized=true where id=${id}`;
    analyticsCache.clear();
    const updated = await assembleTournament(id);
    if (!updated) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }
    await broadcastTournamentUpdate(id, updated);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}



import { after, NextResponse } from 'next/server';
import { ensureTournamentMeta, sql } from '@/lib/db';
import { stampOpenMatchStarts } from '@/lib/gameLogic';
import { assembleTournament, persistOpenMatchStarts } from '@/lib/tournamentRepo';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await ensureTournamentMeta();

    const [existing] = await sql<{ is_finalized: boolean; started_at: Date | string | null }[]>`
      select is_finalized, started_at from tournaments where id = ${id} limit 1
    `;
    if (!existing) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    if (existing.is_finalized) {
      return NextResponse.json({ error: 'Tournament is finalized' }, { status: 400 });
    }

    const now = new Date();
    const alreadyStarted = existing.started_at != null;
    if (!alreadyStarted) {
      await sql`
        update tournaments
        set started_at = ${now}
        where id = ${id} and started_at is null
      `;
    }

    const updated = await assembleTournament(id);
    if (updated?.startedAt && !alreadyStarted) {
      const at = new Date(updated.startedAt);
      stampOpenMatchStarts(updated, at.toISOString());
      await persistOpenMatchStarts(id, at);
      after(() => broadcastTournamentUpdate(id, updated));
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

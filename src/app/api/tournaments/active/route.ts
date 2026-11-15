import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { eventTypeOf } from '@/lib/gameLogic';

export async function GET() {
  try {
    const rows = await sql<{ id: string; name: string; event_type: string }[]>`
      select id, name, event_type from tournaments
      where is_finalized = false
      order by created_at desc`;
    const tournaments = rows.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      eventType: eventTypeOf(row.event_type),
    }));
    return NextResponse.json({
      active: tournaments.length > 0,
      tournament: tournaments[0] ?? null,
      tournaments,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ active: false, tournament: null, tournaments: [], error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sql, DbTournamentRow } from '@/lib/db';
import { assembleTournaments } from '@/lib/tournamentRepo';

export async function GET(req: NextRequest) {
  try {
    const summaryOnly = req.nextUrl.searchParams.get('summary') === '1';
    const rows = await sql<DbTournamentRow[]>`
      SELECT t.*
      FROM tournaments t
      WHERE t.is_finalized = true
      ORDER BY t.date DESC
    `;

    if (rows.length === 0) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    if (summaryOnly) {
      return NextResponse.json(
        rows.map((tr) => ({
          id: tr.id,
          date: tr.date,
          name: tr.name ?? '',
          eventType: tr.event_type ?? 'XD',
        })),
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const tournaments = await assembleTournaments(rows);

    return NextResponse.json(tournaments, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

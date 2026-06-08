import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, sql, DbTournamentRow } from '@/lib/db';
import { assembleTournaments } from '@/lib/tournamentRepo';

const HISTORY_QUERY = sql<DbTournamentRow[]>`
  SELECT t.*
  FROM tournaments t
  WHERE t.is_finalized = true
     OR NOT EXISTS (
       SELECT 1 FROM matches m
       WHERE m.tournament_id = t.id AND m.completed = false
     )
  ORDER BY t.date DESC
`;

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();

    const summaryOnly = req.nextUrl.searchParams.get('summary') === '1';
    const rows = await HISTORY_QUERY;

    if (rows.length === 0) {
      return NextResponse.json([]);
    }

    if (summaryOnly) {
      return NextResponse.json(
        rows.map((tr) => ({ id: tr.id, date: tr.date })),
        { headers: { 'Cache-Control': 'private, max-age=60' } }
      );
    }

    const tournaments = await assembleTournaments(rows);

    return NextResponse.json(tournaments, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

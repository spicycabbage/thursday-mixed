import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { analyticsCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

export async function GET() {
  try {
    const cached = analyticsCache.get<string[]>(CACHE_KEYS.ALL_PLAYERS);
    if (cached) {
      return NextResponse.json({ players: cached });
    }

    const rows = await sql<{ name: string }[]>`
      SELECT name
      FROM (
        SELECT
          lower(trim(p.name)) AS name_key,
          (array_agg(trim(p.name) ORDER BY t.created_at DESC, length(trim(p.name)) DESC))[1] AS name
        FROM players p
        JOIN tournaments t ON t.id = p.tournament_id
        WHERE trim(p.name) <> ''
        GROUP BY lower(trim(p.name))
      ) names
      ORDER BY name
    `;
    const players = rows.map((row) => row.name);
    analyticsCache.set(CACHE_KEYS.ALL_PLAYERS, players, CACHE_TTL);
    return NextResponse.json(
      { players },
      { headers: { 'Cache-Control': 'private, max-age=60' } }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ players: [], error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { analyticsCache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
import { isEventType } from '@/lib/gameLogic';

interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winPercentage: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year') || 'all';
    const eventParam = searchParams.get('event');
    const event = eventParam && isEventType(eventParam) ? eventParam : 'all';
    
    // Check cache first
    const cacheKey = `${CACHE_KEYS.PLAYER_STATS}:${year}:${event}`;
    const cachedStats = analyticsCache.get<PlayerStats[]>(cacheKey);
    if (cachedStats) {
      return NextResponse.json(cachedStats, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }
    
    const yearFilter =
      year !== 'all' && /^\d{4}$/.test(year) ? sql`AND t.date LIKE ${`${year}-%`}` : sql``;
    const eventFilter = event === 'all' ? sql`` : sql`AND t.event_type = ${event}`;

    const playerStats = await sql<{
      name: string;
      wins: number;
      losses: number;
      total_matches: number;
      win_percentage: number;
    }[]>`
      WITH player_matches AS (
        SELECT
          lower(trim(p.name)) AS name_key,
          trim(p.name) AS raw_name,
          CASE WHEN m.winner_team = 'A' THEN 1 ELSE 0 END AS is_win
        FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN players p ON p.tournament_id = m.tournament_id
          AND p.id IN (m.team_a_p1, m.team_a_p2)
        WHERE t.is_finalized = true
          AND m.completed = true
          AND m.winner_team IS NOT NULL
          ${yearFilter}
          ${eventFilter}

        UNION ALL

        SELECT
          lower(trim(p.name)) AS name_key,
          trim(p.name) AS raw_name,
          CASE WHEN m.winner_team = 'B' THEN 1 ELSE 0 END AS is_win
        FROM matches m
        JOIN tournaments t ON m.tournament_id = t.id
        JOIN players p ON p.tournament_id = m.tournament_id
          AND p.id IN (m.team_b_p1, m.team_b_p2)
        WHERE t.is_finalized = true
          AND m.completed = true
          AND m.winner_team IS NOT NULL
          ${yearFilter}
          ${eventFilter}
      )
      SELECT
        (array_agg(raw_name ORDER BY length(raw_name) DESC, raw_name))[1] AS name,
        SUM(is_win)::integer AS wins,
        (COUNT(*) - SUM(is_win))::integer AS losses,
        COUNT(*)::integer AS total_matches,
        CASE
          WHEN COUNT(*) > 0 THEN ROUND((SUM(is_win)::float / COUNT(*)) * 100)::integer
          ELSE 0
        END AS win_percentage
      FROM player_matches
      GROUP BY name_key
      ORDER BY win_percentage DESC, total_matches DESC
    `;

    // Convert to the expected format
    const formattedStats: PlayerStats[] = playerStats.map((stat: {
      name: string;
      wins: number;
      losses: number;
      total_matches: number;
      win_percentage: number;
    }) => ({
      name: stat.name,
      wins: stat.wins,
      losses: stat.losses,
      totalMatches: stat.total_matches,
      winPercentage: stat.win_percentage
    }));

    // Cache the results
    analyticsCache.set(cacheKey, formattedStats, CACHE_TTL);

    return NextResponse.json(formattedStats, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

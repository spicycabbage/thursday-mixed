import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { analyticsCache, CACHE_TTL } from '@/lib/cache';
import { isEventType, nameKey, normalizeName } from '@/lib/gameLogic';

interface PlayerMatch {
  date: string;
  tournamentName: string;
  eventType: string;
  round: number;
  partner: string;
  opponent1: string;
  opponent2: string;
  playerScore: number;
  opponentScore: number;
  won: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const playerName = request.nextUrl.searchParams.get('player') ?? '';
    if (!playerName.trim()) {
      return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
    }

    const eventParam = request.nextUrl.searchParams.get('event');
    const event = eventParam && isEventType(eventParam) ? eventParam : null;
    const eventFilter = event ? sql`AND t.event_type = ${event}` : sql``;
    const key = nameKey(normalizeName(playerName));
    const cacheKey = `player-matches:${key}:${event ?? 'all'}`;
    const cached = analyticsCache.get<PlayerMatch[]>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    const rows = await sql<{
      date: string;
      tournament_name: string;
      event_type: string;
      round: number;
      partner: string;
      opponent1: string;
      opponent2: string;
      player_score: number;
      opponent_score: number;
      won: boolean;
    }[]>`
      SELECT
        t.date,
        t.name AS tournament_name,
        t.event_type,
        m.round,
        partner.name AS partner,
        opp1.name AS opponent1,
        opp2.name AS opponent2,
        CASE
          WHEN p.id = m.team_a_p1 OR p.id = m.team_a_p2 THEN m.score_a
          ELSE m.score_b
        END AS player_score,
        CASE
          WHEN p.id = m.team_a_p1 OR p.id = m.team_a_p2 THEN m.score_b
          ELSE m.score_a
        END AS opponent_score,
        CASE
          WHEN (p.id = m.team_a_p1 OR p.id = m.team_a_p2) AND m.winner_team = 'A' THEN true
          WHEN (p.id = m.team_b_p1 OR p.id = m.team_b_p2) AND m.winner_team = 'B' THEN true
          ELSE false
        END AS won
      FROM matches m
      JOIN tournaments t ON t.id = m.tournament_id
      JOIN players p ON p.tournament_id = m.tournament_id
        AND lower(trim(p.name)) = ${key}
        AND p.id IN (m.team_a_p1, m.team_a_p2, m.team_b_p1, m.team_b_p2)
      JOIN players partner ON partner.tournament_id = m.tournament_id
        AND partner.id = CASE
          WHEN p.id = m.team_a_p1 THEN m.team_a_p2
          WHEN p.id = m.team_a_p2 THEN m.team_a_p1
          WHEN p.id = m.team_b_p1 THEN m.team_b_p2
          ELSE m.team_b_p1
        END
      JOIN players opp1 ON opp1.tournament_id = m.tournament_id
        AND opp1.id = CASE
          WHEN p.id = m.team_a_p1 OR p.id = m.team_a_p2 THEN m.team_b_p1
          ELSE m.team_a_p1
        END
      JOIN players opp2 ON opp2.tournament_id = m.tournament_id
        AND opp2.id = CASE
          WHEN p.id = m.team_a_p1 OR p.id = m.team_a_p2 THEN m.team_b_p2
          ELSE m.team_a_p2
        END
      WHERE t.is_finalized = true
        AND m.completed = true
        AND m.score_a IS NOT NULL
        AND m.score_b IS NOT NULL
        ${eventFilter}
      ORDER BY t.date DESC, m.round DESC, m.id DESC
    `;

    const matches: PlayerMatch[] = rows.map((row) => ({
      date: row.date,
      tournamentName: row.tournament_name ?? '',
      eventType: row.event_type ?? 'XD',
      round: row.round,
      partner: row.partner,
      opponent1: row.opponent1,
      opponent2: row.opponent2,
      playerScore: row.player_score,
      opponentScore: row.opponent_score,
      won: row.won,
    }));

    analyticsCache.set(cacheKey, matches, CACHE_TTL);
    return NextResponse.json(matches, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

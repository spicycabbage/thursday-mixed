import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminSecret, hasAdminCookie } from '@/lib/adminAuth';
import { ensureSchema, ensureTournamentMeta, sql } from '@/lib/db';
import { createTournament, duplicateNameKeys, EVENT_TYPE_LABELS, isEventType, isTeamCount, nameKey, normalizeName } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: NextRequest) {
  try {
    const secret = adminSecret();
    if (!secret || !hasAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value, secret)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    await ensureSchema();
    await ensureTournamentMeta();
    const { teams, date, name, eventType } = await req.json();
    if (!Array.isArray(teams) || !isTeamCount(teams.length)) {
      return NextResponse.json({ error: 'Invalid input: need 6, 7, 8, or 9 teams with 2 players each' }, { status: 400 });
    }
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length > 40) {
      return NextResponse.json({ error: 'Tournament name is too long' }, { status: 400 });
    }
    if (typeof eventType !== 'string' || !isEventType(eventType)) {
      return NextResponse.json({ error: 'Event type must be MD, WD, or XD' }, { status: 400 });
    }

    const typedNames = teams.flatMap((team: { player1?: string; player2?: string }) => [
      normalizeName(team?.player1 ?? ''),
      normalizeName(team?.player2 ?? ''),
    ]);
    if (typedNames.some((playerName) => !playerName)) {
      return NextResponse.json({ error: 'Each team needs 2 player names' }, { status: 400 });
    }
    if (duplicateNameKeys(typedNames).length > 0) {
      return NextResponse.json({ error: 'Player names must be unique' }, { status: 400 });
    }

    const keys = typedNames.map((playerName) => nameKey(playerName));
    const known = await sql<{ name_key: string; name: string }[]>`
      SELECT name_key, name
      FROM (
        SELECT
          lower(trim(name)) AS name_key,
          (array_agg(trim(name) ORDER BY length(trim(name)) DESC))[1] AS name
        FROM players
        WHERE lower(trim(name)) IN ${sql(keys)}
        GROUP BY lower(trim(name))
      ) known_names
    `;
    const knownByKey = new Map(known.map((row) => [row.name_key, row.name]));
    const canonicalTeams = teams.map((team: { player1?: string; player2?: string }) => ({
      player1: knownByKey.get(nameKey(team.player1 ?? '')) ?? normalizeName(team.player1 ?? ''),
      player2: knownByKey.get(nameKey(team.player2 ?? '')) ?? normalizeName(team.player2 ?? ''),
    }));

    const t = createTournament(canonicalTeams, date, {
      name: trimmedName || EVENT_TYPE_LABELS[eventType],
      eventType,
    });

    await sql`insert into tournaments (id, access_code, name, event_type, date, current_round, is_finalized)
      values (${t.id}, ${''}, ${t.name}, ${t.eventType}, ${t.date}, ${t.currentRound}, ${t.isFinalized})`;

    for (const p of t.players) {
      await sql`insert into players (tournament_id, id, name, team_id, total_score)
        values (${t.id}, ${p.id}, ${p.name}, ${p.teamId}, 0)`;
    }

    for (const m of t.matches) {
      await sql`insert into matches (
        tournament_id, id, round, court, team_a_id, team_b_id,
        team_a_p1, team_a_p2, team_b_p1, team_b_p2,
        score_a, score_b, completed
      ) values (
        ${t.id}, ${m.id}, ${m.round}, ${m.court}, ${m.teamAId}, ${m.teamBId},
        ${m.teamA.player1}, ${m.teamA.player2}, ${m.teamB.player1}, ${m.teamB.player2},
        ${m.scoreA}, ${m.scoreB}, ${m.completed}
      )`;
    }

    await broadcastTournamentUpdate(t.id, t);
    return NextResponse.json(t);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

import { after, NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminSecret, hasAdminCookie } from '@/lib/adminAuth';
import { ensureSchema, ensureTournamentMeta, sql } from '@/lib/db';
import { createTournament, duplicateNameKeys, EVENT_TYPE_LABELS, isEventType, isSinglesEvent, isTeamCount, nameKey, normalizeCourtNumbers, normalizeName, toPgIntArray } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: NextRequest) {
  try {
    const secret = adminSecret();
    if (!secret || !hasAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value, secret)) {
      return NextResponse.json({ error: 'Admin only' }, { status: 401 });
    }

    await ensureSchema();
    await ensureTournamentMeta();
    const { teams, date, name, eventType, courtNumbers: rawCourtNumbers } = await req.json();
    if (!Array.isArray(teams) || !isTeamCount(teams.length)) {
      return NextResponse.json({ error: 'Invalid input: need 6, 7, 8, or 9 entries' }, { status: 400 });
    }
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length > 40) {
      return NextResponse.json({ error: 'Tournament name is too long' }, { status: 400 });
    }
    if (typeof eventType !== 'string' || !isEventType(eventType)) {
      return NextResponse.json({ error: 'Event type must be MD, WD, XD, MS, or WS' }, { status: 400 });
    }
    const singles = isSinglesEvent(eventType);

    const typedNames = teams.flatMap((team: { player1?: string; player2?: string }) => {
      const names = [normalizeName(team?.player1 ?? '')];
      if (!singles) names.push(normalizeName(team?.player2 ?? ''));
      return names;
    });
    if (typedNames.some((playerName) => !playerName)) {
      return NextResponse.json(
        { error: singles ? 'Each player needs a name' : 'Each team needs 2 player names' },
        { status: 400 }
      );
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
      player2: singles
        ? ''
        : (knownByKey.get(nameKey(team.player2 ?? '')) ?? normalizeName(team.player2 ?? '')),
    }));

    const courtNumbers = normalizeCourtNumbers(rawCourtNumbers, teams.length);
    if (!courtNumbers) {
      return NextResponse.json({ error: 'Enter a unique court number for each court' }, { status: 400 });
    }

    const t = createTournament(canonicalTeams, date, {
      name: trimmedName || EVENT_TYPE_LABELS[eventType],
      eventType,
      courtNumbers,
    });

    await sql`insert into tournaments (id, access_code, name, event_type, date, current_round, is_finalized, court_numbers)
      values (${t.id}, ${''}, ${t.name}, ${t.eventType}, ${t.date}, ${t.currentRound}, ${t.isFinalized}, ${toPgIntArray(courtNumbers)}::int[])`;

    const playerRows = t.players.map((p) => ({
      tournament_id: t.id,
      id: p.id,
      name: p.name,
      team_id: p.teamId,
      total_score: 0,
    }));
    await sql`insert into players ${sql(playerRows, 'tournament_id', 'id', 'name', 'team_id', 'total_score')}`;

    const matchRows = t.matches.map((m) => ({
      tournament_id: t.id,
      id: m.id,
      round: m.round,
      court: m.court,
      team_a_id: m.teamAId,
      team_b_id: m.teamBId,
      team_a_p1: m.teamA.player1,
      team_a_p2: m.teamA.player2,
      team_b_p1: m.teamB.player1,
      team_b_p2: m.teamB.player2,
      score_a: m.scoreA,
      score_b: m.scoreB,
      completed: m.completed,
      streak_a: m.streakA ?? 0,
      streak_b: m.streakB ?? 0,
      match_number: m.matchNumber ?? 0,
    }));
    await sql`insert into matches ${sql(
      matchRows,
      'tournament_id', 'id', 'round', 'court', 'team_a_id', 'team_b_id',
      'team_a_p1', 'team_a_p2', 'team_b_p1', 'team_b_p2',
      'score_a', 'score_b', 'completed', 'streak_a', 'streak_b', 'match_number'
    )}`;

    after(() => broadcastTournamentUpdate(t.id, t));
    return NextResponse.json(t);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

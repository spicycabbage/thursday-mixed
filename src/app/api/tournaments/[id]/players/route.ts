import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { assembleTournament } from '@/lib/tournamentRepo';
import { duplicateNameKeys, isTeamCount, nameKey, normalizeName } from '@/lib/gameLogic';
import { broadcastTournamentUpdate } from '@/lib/realtime/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const [tournament] = await sql`select id from tournaments where id=${id} limit 1`;
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const { teams } = await req.json();
    const [playerCount] = await sql<{ c: number }[]>`
      select count(*)::int as c from players where tournament_id=${id}`;
    const teamCount = (playerCount?.c ?? 0) / 2;
    if (!Array.isArray(teams) || !isTeamCount(teamCount) || teams.length !== teamCount) {
      return NextResponse.json({ error: 'Invalid teams: player list must match the tournament size' }, { status: 400 });
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
        WHERE tournament_id <> ${id}
          AND lower(trim(name)) IN ${sql(keys)}
        GROUP BY lower(trim(name))
      ) known_names
    `;
    const knownByKey = new Map(known.map((row) => [row.name_key, row.name]));

    for (let i = 0; i < teamCount; i++) {
      const player1Id = i * 2 + 1;
      const player2Id = i * 2 + 2;
      const player1 = knownByKey.get(nameKey(teams[i].player1)) ?? normalizeName(teams[i].player1);
      const player2 = knownByKey.get(nameKey(teams[i].player2)) ?? normalizeName(teams[i].player2);
      await sql`update players set name=${player1} where tournament_id=${id} and id=${player1Id}`;
      await sql`update players set name=${player2} where tournament_id=${id} and id=${player2Id}`;
    }

    const updated = await assembleTournament(id);
    if (!updated) {
      return NextResponse.json({ error: 'Failed to fetch updated tournament' }, { status: 500 });
    }
    await broadcastTournamentUpdate(id, updated);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

import { sql, DbTournamentRow, ensureTournamentMeta } from '@/lib/db';

import {

  Tournament,

  Team,

  Player,

  Match,

  getTeamLabel,

  getTeamIdForPlayer,

  recomputeAllStats,

  assignMatchNumbers,

  normalizeName,

  eventTypeOf,

  isSinglesEvent,

  toPgIntArray,

  syncPlayoffBracket,

  syncPlayingCourts,

  stampOpenMatchStarts,

  playoffStageOf,

} from '@/lib/gameLogic';



type DbPlayerRow = {

  tournament_id: string;

  id: number;

  name: string;

  team_id: number;

  total_score: number;

};



type DbMatchRow = {

  tournament_id: string;

  id: number;

  round: number;

  court: number;

  team_a_id: number;

  team_b_id: number;

  team_a_p1: number;

  team_a_p2: number;

  team_b_p1: number;

  team_b_p2: number;

  score_a: number | null;

  score_b: number | null;

  completed: boolean;

  winner_team?: string | null;

  queue_order?: number | null;

  finish_order?: number | null;

  streak_a?: number | null;

  streak_b?: number | null;

  started_at?: string | Date | null;

  ended_at?: string | Date | null;

  match_number?: number | null;

  stage?: string | null;

};



function groupByTournamentId<T extends { tournament_id: string }>(rows: T[]): Map<string, T[]> {

  const map = new Map<string, T[]>();

  for (const row of rows) {

    const list = map.get(row.tournament_id);

    if (list) list.push(row);

    else map.set(row.tournament_id, [row]);

  }

  return map;

}



function toIsoTimestamp(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function buildTournamentFromRows(

  tr: DbTournamentRow,

  players: Omit<DbPlayerRow, 'tournament_id'>[],

  matches: Omit<DbMatchRow, 'tournament_id'>[]

): Tournament {

  const teamCount = players.reduce((max, player) => {

    const teamId = player.team_id || getTeamIdForPlayer(player.id);

    return Math.max(max, teamId);

  }, 0);



  const teams: Team[] = Array.from({ length: teamCount }, (_, i) => {

    const teamId = i + 1;

    const teamPlayers = players.filter(

      (p) => (p.team_id || getTeamIdForPlayer(p.id)) === teamId

    );

    return {

      id: teamId,

      label: getTeamLabel(teamId),

      player1Id: teamPlayers[0]?.id ?? (teamId - 1) * 2 + 1,

      player2Id: isSinglesEvent(tr.event_type)
        ? 0
        : (teamPlayers[1]?.id ?? (teamId - 1) * 2 + 2),

      wins: 0,

      losses: 0,

      pointsFor: 0,

      pointsAgainst: 0,

      pointDiff: 0,

    };

  });



  const playerList: Player[] = players.map((p) => ({

    id: p.id,

    name: normalizeName(p.name),

    teamId: p.team_id || getTeamIdForPlayer(p.id),

    wins: 0,

    losses: 0,

    pointsFor: 0,

    pointsAgainst: 0,

    pointDiff: 0,

  }));



  const matchList: Match[] = matches.map((m) => ({

    id: m.id,

    round: m.round,

    court: m.court,

    teamAId: m.team_a_id,

    teamBId: m.team_b_id,

    teamA: { player1: m.team_a_p1, player2: m.team_a_p2 },

    teamB: { player1: m.team_b_p1, player2: m.team_b_p2 },

    scoreA: m.score_a,

    scoreB: m.score_b,

    completed: m.completed,

    startedAt: toIsoTimestamp(m.started_at),

    endedAt: toIsoTimestamp(m.ended_at),

    matchNumber: m.match_number && m.match_number > 0 ? m.match_number : undefined,

    queueOrder: m.queue_order && m.queue_order > 0 ? m.queue_order : m.id,

    finishOrder: m.finish_order && m.finish_order > 0 ? m.finish_order : undefined,

    streakA: m.streak_a && m.streak_a > 0 ? m.streak_a : undefined,

    streakB: m.streak_b && m.streak_b > 0 ? m.streak_b : undefined,

    winnerTeam:

      m.winner_team === 'A' || m.winner_team === 'B' ? (m.winner_team as 'A' | 'B') : null,

    stage: playoffStageOf(m.stage),

  }));



  let tournament: Tournament = {

    id: tr.id,

    name: tr.name ?? '',

    eventType: eventTypeOf(tr.event_type),

    date: tr.date,

    teams,

    players: playerList,

    matches: matchList,

    currentRound: tr.current_round,

    isFinalized: tr.is_finalized,

    createdAt: new Date(tr.created_at),

    startedAt: toIsoTimestamp(tr.started_at),
    courtNumbers: Array.isArray(tr.court_numbers) ? tr.court_numbers : undefined,

  };



  recomputeAllStats(tournament);

  assignMatchNumbers(tournament);

  tournament.currentRound = tr.current_round;



  return tournament;

}



export async function assembleTournament(id: string): Promise<Tournament | null> {
  await ensureTournamentMeta();
  const rows = await sql<{
    tournament: DbTournamentRow;
    players: Omit<DbPlayerRow, 'tournament_id'>[];
    matches: Omit<DbMatchRow, 'tournament_id'>[];
  }[]>`
    select
      to_jsonb(t) as tournament,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'team_id', coalesce(p.team_id, ceil(p.id::float / 2)::int),
          'total_score', p.total_score
        ) order by p.id)
        from players p
        where p.tournament_id = t.id
      ), '[]'::jsonb) as players,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'round', m.round,
          'court', coalesce(m.court, 1),
          'team_a_id', coalesce(m.team_a_id, ceil(m.team_a_p1::float / 2)::int),
          'team_b_id', coalesce(m.team_b_id, ceil(m.team_b_p1::float / 2)::int),
          'team_a_p1', m.team_a_p1,
          'team_a_p2', m.team_a_p2,
          'team_b_p1', m.team_b_p1,
          'team_b_p2', m.team_b_p2,
          'score_a', m.score_a,
          'score_b', m.score_b,
          'completed', m.completed,
          'winner_team', m.winner_team,
          'queue_order', coalesce(m.queue_order, 0),
          'finish_order', coalesce(m.finish_order, 0),
          'streak_a', coalesce(m.streak_a, 0),
          'streak_b', coalesce(m.streak_b, 0),
          'started_at', m.started_at,
          'ended_at', m.ended_at,
          'match_number', coalesce(m.match_number, 0),
          'stage', coalesce(m.stage, '')
        ) order by m.id)
        from matches m
        where m.tournament_id = t.id
      ), '[]'::jsonb) as matches
    from tournaments t
    where t.id = ${id}
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;
  const needsNumbers = row.matches.some((match) => Number(match.court) > 0 && !(Number(match.match_number) > 0));
  const tournament = buildTournamentFromRows(row.tournament, row.players, row.matches);
  if (needsNumbers) await persistMatchNumbers(id, tournament.matches);
  if (!tournament.isFinalized && syncPlayoffBracket(tournament)) {
    syncPlayingCourts(tournament);
    if (tournament.startedAt) stampOpenMatchStarts(tournament, new Date().toISOString());
    await persistPlayoffMatches(id, tournament.matches);
    await persistMatchCourts(id, tournament.matches);
    await persistMatchNumbers(id, tournament.matches);
    if (tournament.startedAt) await persistOpenMatchStarts(id, new Date());
    await sql`update tournaments set current_round = ${tournament.currentRound} where id = ${id}`;
  }
  return tournament;
}



/** Bulk-load tournaments in 3 queries total instead of 3 per tournament. */

export async function assembleTournaments(rows: DbTournamentRow[]): Promise<Tournament[]> {
  await ensureTournamentMeta();

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);



  const players = await sql<DbPlayerRow[]>`

    select tournament_id, id, name, coalesce(team_id, ceil(id::float / 2)::int) as team_id, total_score

    from players where tournament_id in ${sql(ids)}

    order by tournament_id, id asc`;



  const matches = await sql<DbMatchRow[]>`

    select tournament_id, id, round, coalesce(court, 1) as court,

      coalesce(team_a_id, ceil(team_a_p1::float / 2)::int) as team_a_id,

      coalesce(team_b_id, ceil(team_b_p1::float / 2)::int) as team_b_id,

      team_a_p1, team_a_p2, team_b_p1, team_b_p2,

      score_a, score_b, completed, winner_team, coalesce(queue_order, 0) as queue_order,

      coalesce(finish_order, 0) as finish_order,

      coalesce(streak_a, 0) as streak_a, coalesce(streak_b, 0) as streak_b,

      started_at, ended_at, coalesce(match_number, 0) as match_number,

      coalesce(stage, '') as stage

    from matches where tournament_id in ${sql(ids)}

    order by tournament_id, id asc`;



  const playersById = groupByTournamentId(players);

  const matchesById = groupByTournamentId(matches);



  return rows.map((tr) => {

    const tPlayers = playersById.get(tr.id) ?? [];

    const tMatches = matchesById.get(tr.id) ?? [];

    return buildTournamentFromRows(

      tr,

      tPlayers.map(({ tournament_id: _, ...p }) => p),

      tMatches.map(({ tournament_id: _, ...m }) => m)

    );

  });

}

export type MatchCourtSnapshot = Map<number, string>;

function courtKey(match: Match): string {
  return `${match.court}|${match.streakA ?? 0}|${match.streakB ?? 0}`;
}

export function snapshotMatchCourts(matches: Match[]): MatchCourtSnapshot {
  return new Map(matches.map((match) => [match.id, courtKey(match)]));
}

/** Writes court/streak changes in one statement, skipping matches that match `before`. */
export async function persistMatchCourts(
  tournamentId: string,
  matches: Match[],
  before?: MatchCourtSnapshot
): Promise<void> {
  const changed = before
    ? matches.filter((match) => before.get(match.id) !== courtKey(match))
    : matches;
  if (changed.length === 0) return;

  await sql`
    update matches m
    set court = v.court, streak_a = v.streak_a, streak_b = v.streak_b
    from unnest(
      ${toPgIntArray(changed.map((match) => match.id))}::int[],
      ${toPgIntArray(changed.map((match) => match.court))}::int[],
      ${toPgIntArray(changed.map((match) => match.streakA ?? 0))}::int[],
      ${toPgIntArray(changed.map((match) => match.streakB ?? 0))}::int[]
    ) as v(id, court, streak_a, streak_b)
    where m.tournament_id = ${tournamentId} and m.id = v.id`;
}

/** Writes the play-order number. 0 means the match is still in the queue. */
export async function persistMatchNumbers(tournamentId: string, matches: Match[]): Promise<void> {
  if (matches.length === 0) return;
  await sql`
    update matches m
    set match_number = v.match_number
    from unnest(
      ${toPgIntArray(matches.map((match) => match.id))}::int[],
      ${toPgIntArray(matches.map((match) => match.matchNumber ?? 0))}::int[]
    ) as v(id, match_number)
    where m.tournament_id = ${tournamentId} and m.id = v.id`;
}

function asTimestamp(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Inserts, updates, or deletes knockout matches so the database matches the bracket. */
export async function persistPlayoffMatches(tournamentId: string, matches: Match[]): Promise<void> {
  const playoff = matches.filter((match) => match.stage);
  if (playoff.length === 0) {
    await sql`delete from matches where tournament_id = ${tournamentId} and stage <> ''`;
    return;
  }

  await sql`
    delete from matches
    where tournament_id = ${tournamentId}
      and stage <> ''
      and id <> all(${toPgIntArray(playoff.map((match) => match.id))}::int[])
  `;

  for (const match of playoff) {
    const startedAt = asTimestamp(match.startedAt);
    const endedAt = asTimestamp(match.endedAt);
    await sql`
      insert into matches (
        tournament_id, id, round, court, team_a_id, team_b_id,
        team_a_p1, team_a_p2, team_b_p1, team_b_p2,
        score_a, score_b, completed, winner_team, stage,
        queue_order, finish_order, streak_a, streak_b, match_number,
        started_at, ended_at
      ) values (
        ${tournamentId}, ${match.id}, ${match.round}, ${match.court},
        ${match.teamAId}, ${match.teamBId},
        ${match.teamA.player1}, ${match.teamA.player2},
        ${match.teamB.player1}, ${match.teamB.player2},
        ${match.scoreA}, ${match.scoreB}, ${match.completed},
        ${match.winnerTeam ?? null}, ${match.stage ?? ''},
        ${match.queueOrder ?? 0}, ${match.finishOrder ?? 0},
        ${match.streakA ?? 0}, ${match.streakB ?? 0},
        ${match.matchNumber ?? 0},
        ${startedAt}, ${endedAt}
      )
      on conflict (tournament_id, id) do update set
        round = excluded.round,
        court = excluded.court,
        team_a_id = excluded.team_a_id,
        team_b_id = excluded.team_b_id,
        team_a_p1 = excluded.team_a_p1,
        team_a_p2 = excluded.team_a_p2,
        team_b_p1 = excluded.team_b_p1,
        team_b_p2 = excluded.team_b_p2,
        score_a = excluded.score_a,
        score_b = excluded.score_b,
        completed = excluded.completed,
        winner_team = excluded.winner_team,
        stage = excluded.stage,
        queue_order = excluded.queue_order,
        finish_order = excluded.finish_order,
        streak_a = excluded.streak_a,
        streak_b = excluded.streak_b,
        match_number = excluded.match_number,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at
    `;
  }
}

/** Start clock for matches that are on a court and have not started yet. */
export async function persistOpenMatchStarts(tournamentId: string, at: Date): Promise<void> {
  await sql`
    update matches
    set started_at = ${at}
    where tournament_id = ${tournamentId}
      and completed = false
      and court > 0
      and started_at is null
  `;
}

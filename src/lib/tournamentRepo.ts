import { sql, DbTournamentRow, ensureTournamentMeta } from '@/lib/db';

import {

  Tournament,

  Team,

  Player,

  Match,

  getTeamLabel,

  getTeamIdForPlayer,

  recomputeAllStats,

  normalizeName,

  eventTypeOf,

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

      player2Id: teamPlayers[1]?.id ?? (teamId - 1) * 2 + 2,

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

    queueOrder: m.queue_order && m.queue_order > 0 ? m.queue_order : m.id,

    winnerTeam:

      m.winner_team === 'A' || m.winner_team === 'B' ? (m.winner_team as 'A' | 'B') : null,

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
    courtNumbers: Array.isArray(tr.court_numbers) ? tr.court_numbers : undefined,

  };



  recomputeAllStats(tournament);

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
          'queue_order', coalesce(m.queue_order, 0)
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
  return buildTournamentFromRows(row.tournament, row.players, row.matches);
}



/** Bulk-load tournaments in 3 queries total instead of 3 per tournament. */

export async function assembleTournaments(rows: DbTournamentRow[]): Promise<Tournament[]> {

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

      score_a, score_b, completed, winner_team

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

export async function persistMatchCourts(tournamentId: string, matches: Match[]): Promise<void> {
  for (const match of matches) {
    await sql`update matches set court = ${match.court} where tournament_id = ${tournamentId} and id = ${match.id}`;
  }
}

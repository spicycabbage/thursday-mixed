import { ensureSchema, sql, DbTournamentRow } from '@/lib/db';

import {

  Tournament,

  Team,

  Player,

  Match,

  getTeamLabel,

  getTeamIdForPlayer,

  updateMatchScore,

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

  const teams: Team[] = Array.from({ length: 6 }, (_, i) => {

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

    name: p.name,

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

    winnerTeam:

      m.winner_team === 'A' || m.winner_team === 'B' ? (m.winner_team as 'A' | 'B') : null,

  }));



  let tournament: Tournament = {

    id: tr.id,

    date: tr.date,

    teams,

    players: playerList,

    matches: matchList,

    currentRound: tr.current_round,

    isFinalized: tr.is_finalized,

    createdAt: new Date(tr.created_at),

  };



  for (const m of tournament.matches) {

    if (m.completed && m.scoreA != null && m.scoreB != null) {

      tournament = updateMatchScore(tournament, m.id, m.scoreA, m.scoreB, true);

    }

  }

  tournament.currentRound = tr.current_round;



  return tournament;

}



export async function assembleTournament(id: string): Promise<Tournament | null> {

  await ensureSchema();

  const rows = await sql<DbTournamentRow[]>`select * from tournaments where id=${id} limit 1`;

  const tr = rows[0];

  if (!tr) return null;



  const players = await sql<Omit<DbPlayerRow, 'tournament_id'>[]>`

    select id, name, coalesce(team_id, ceil(id::float / 2)::int) as team_id, total_score

    from players where tournament_id=${id} order by id asc`;



  const matches = await sql<Omit<DbMatchRow, 'tournament_id'>[]>`

    select id, round, coalesce(court, 1) as court,

      coalesce(team_a_id, ceil(team_a_p1::float / 2)::int) as team_a_id,

      coalesce(team_b_id, ceil(team_b_p1::float / 2)::int) as team_b_id,

      team_a_p1, team_a_p2, team_b_p1, team_b_p2,

      score_a, score_b, completed, winner_team

    from matches where tournament_id=${id} order by id asc`;



  return buildTournamentFromRows(tr, players, matches);

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



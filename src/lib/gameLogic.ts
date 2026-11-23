export const TEAM_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const TEAM_COUNTS = [6, 7, 8, 9] as const;
export const NUM_TEAMS = 6;
export const NUM_PLAYERS = 12;
export const NUM_ROUNDS = 8;
export const NUM_MATCHES = 15;
export const MAX_FINISH_PLACES = 8;

export type TeamLabel = (typeof TEAM_LABELS)[number];
export type TeamCount = (typeof TEAM_COUNTS)[number];

export interface Player {
  id: number;
  name: string;
  teamId: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank?: number;
}

export interface Team {
  id: number;
  label: TeamLabel;
  player1Id: number;
  player2Id: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank?: number;
}

export interface Match {
  id: number;
  round: number;
  court: number;
  teamAId: number;
  teamBId: number;
  teamA: { player1: number; player2: number };
  teamB: { player1: number; player2: number };
  scoreA: number | null;
  scoreB: number | null;
  completed: boolean;
  winnerTeam?: 'A' | 'B' | null;
  queueOrder?: number;
  finishOrder?: number;
  streakA?: number;
  streakB?: number;
  /** Handed out when the match reaches Playing Now. Absent while it is still in the queue. */
  matchNumber?: number;
  /** Set when the match is placed on a court after the tournament has started. */
  startedAt?: string;
  /** Set the first time a score is submitted for a match that had started. */
  endedAt?: string;
}

export type EventType = 'MD' | 'WD' | 'XD' | 'MS' | 'WS';

export const DOUBLES_EVENT_TYPES: EventType[] = ['MD', 'WD', 'XD'];
export const SINGLES_EVENT_TYPES: EventType[] = ['MS', 'WS'];
export const EVENT_TYPES: EventType[] = [...DOUBLES_EVENT_TYPES, ...SINGLES_EVENT_TYPES];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: 'Mixed Doubles',
  MS: "Men's Singles",
  WS: "Women's Singles",
};

export function isEventType(value: string): value is EventType {
  return (EVENT_TYPES as readonly string[]).includes(value);
}

export function isSinglesEvent(value: string | null | undefined): boolean {
  return value === 'MS' || value === 'WS';
}

export function formatSideNames(primary: string, partner?: string | null): string {
  const a = primary.trim();
  const b = (partner ?? '').trim();
  if (a && b) return `${a} & ${b}`;
  return a || b;
}

export function eventTypeOf(value: string | null | undefined): EventType {
  return value && isEventType(value) ? value : 'XD';
}

export interface Tournament {
  id: string;
  name: string;
  eventType: EventType;
  date: string;
  teams: Team[];
  players: Player[];
  matches: Match[];
  currentRound: number;
  isFinalized: boolean;
  createdAt: Date;
  courtNumbers?: number[];
  /** When Start was pressed. Absent until the tournament officially begins. */
  startedAt?: string;
}

export interface TeamRegistration {
  player1: string;
  player2: string;
}

export function isTeamCount(value: number): value is TeamCount {
  return (TEAM_COUNTS as readonly number[]).includes(value);
}

export function courtCountForTeams(teamCount: number): number {
  return teamCount === 9 ? 3 : 2;
}


export const UNASSIGNED_COURT = 0;

export function defaultCourtNumbers(teamCount: number): number[] {
  return Array.from({ length: courtCountForTeams(teamCount) }, (_, index) => index + 1);
}

export function normalizeCourtNumbers(input: unknown, teamCount: number): number[] | null {
  const count = courtCountForTeams(teamCount);
  if (input == null) return defaultCourtNumbers(teamCount);
  if (!Array.isArray(input) || input.length !== count) return null;
  const nums = input.map((value) => {
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
    return NaN;
  });
  if (nums.some((value) => !Number.isInteger(value) || value < 1 || value > 999)) return null;
  if (new Set(nums).size !== nums.length) return null;
  return nums;
}

/** Postgres int[] literal. The sql client has fetch_types off, so a JS array is sent as "1,2,3" and Postgres rejects it as a malformed array. */
export function toPgIntArray(values: number[]): string {
  if (!Array.isArray(values) || values.length === 0 || values.some((value) => !Number.isInteger(value))) {
    throw new Error('Invalid integer array');
  }
  return `{${values.join(',')}}`;
}

export function getCourtNumbers(tournament: {
  teams: { length: number };
  courtNumbers?: number[] | null;
}): number[] {
  const fallback = defaultCourtNumbers(tournament.teams.length || 6);
  const nums = tournament.courtNumbers;
  if (!Array.isArray(nums) || nums.length !== fallback.length) return fallback;
  if (nums.some((value) => !Number.isInteger(value) || value < 1)) return fallback;
  return nums;
}

export function formatCourtLabel(court: number, short = false): string | null {
  if (!court || court <= 0) return null;
  return short ? `Ct ${court}` : `Court ${court}`;
}

export function syncPlayingCourts(
  tournament: Tournament,
  options?: { freedCourt?: number }
): Tournament {
  const courtNumbers = getCourtNumbers(tournament);
  const { spotlight } = getDesktopSpotlightMatches(tournament.matches, courtNumbers.length);
  const spotlightIds = new Set(spotlight.map((match) => match.id));

  for (const match of tournament.matches) {
    if (!match.completed && !spotlightIds.has(match.id)) {
      match.court = UNASSIGNED_COURT;
      match.streakA = undefined;
      match.streakB = undefined;
    }
  }

  const used = new Set<number>();
  const needsCourt: Match[] = [];
  for (const match of spotlight) {
    if (match.court && courtNumbers.includes(match.court) && !used.has(match.court)) {
      used.add(match.court);
    } else {
      needsCourt.push(match);
    }
  }

  const free = courtNumbers.filter((court) => !used.has(court));
  if (options?.freedCourt && free.includes(options.freedCourt)) {
    free.splice(free.indexOf(options.freedCourt), 1);
    free.unshift(options.freedCourt);
  }

  for (const match of needsCourt) {
    const next = free.shift();
    if (next != null) match.court = next;
  }

  for (const match of spotlight) {
    if (!match.court) continue;
    if ((match.streakA ?? 0) > 0 && (match.streakB ?? 0) > 0) continue;
    match.streakA = nextRun(tournament.matches, match.teamAId);
    match.streakB = nextRun(tournament.matches, match.teamBId);
  }

  assignMatchNumbers(tournament);
  return tournament;
}

/** Number matches that are on a court. Queue matches stay unnumbered. */
export function assignMatchNumbers(tournament: Tournament): void {
  let next = 0;
  for (const match of tournament.matches) {
    if ((match.matchNumber ?? 0) > next) next = match.matchNumber ?? 0;
  }

  const pending = tournament.matches.filter((match) => match.court > 0 && !(match.matchNumber && match.matchNumber > 0));
  pending.sort((a, b) => {
    const aStart = a.startedAt ? Date.parse(a.startedAt) : Number.NaN;
    const bStart = b.startedAt ? Date.parse(b.startedAt) : Number.NaN;
    const aHasStart = !Number.isNaN(aStart);
    const bHasStart = !Number.isNaN(bStart);
    if (aHasStart !== bHasStart) return aHasStart ? -1 : 1;
    if (aHasStart && bHasStart && aStart !== bStart) return aStart - bStart;
    const aFinish = a.finishOrder ?? 0;
    const bFinish = b.finishOrder ?? 0;
    if (aFinish !== bFinish) {
      if (aFinish === 0) return 1;
      if (bFinish === 0) return -1;
      return aFinish - bFinish;
    }
    return a.id - b.id;
  });

  for (const match of pending) {
    next += 1;
    match.matchNumber = next;
  }
}

/** Give a start time to every match that is on a court and does not have one yet. */
export function stampOpenMatchStarts(tournament: Tournament, at: string): void {
  if (!tournament.startedAt) return;
  for (const match of tournament.matches) {
    if (!match.completed && match.court > 0 && !match.startedAt) {
      match.startedAt = at;
    }
  }
}

export function startTournament(tournament: Tournament, at = new Date().toISOString()): Tournament {
  if (tournament.startedAt || tournament.isFinalized) return tournament;
  const next: Tournament = {
    ...tournament,
    teams: tournament.teams.map((team) => ({ ...team })),
    players: tournament.players.map((player) => ({ ...player })),
    matches: tournament.matches.map((match) => ({ ...match })),
    startedAt: at,
  };
  stampOpenMatchStarts(next, at);
  return next;
}

/** Relabel stored court numbers, including already-finished matches. */
export function relabelCourtNumbers(tournament: Tournament, nextNumbers: number[]): Tournament {
  const previous = getCourtNumbers(tournament);
  if (previous.length !== nextNumbers.length) {
    tournament.courtNumbers = nextNumbers;
    return syncPlayingCourts(tournament);
  }
  const mapped = new Map(previous.map((court, index) => [court, nextNumbers[index]]));
  for (const match of tournament.matches) {
    const next = mapped.get(match.court);
    if (next != null) match.court = next;
  }
  tournament.courtNumbers = nextNumbers;
  return tournament;
}

export function matchCountForTeams(teamCount: number): number {
  if (!isTeamCount(teamCount)) {
    throw new Error('Tournament must have 6, 7, 8, or 9 teams');
  }
  return (teamCount * (teamCount - 1)) / 2;
}

export function getTournamentRoundCount(matches: { round: number }[]): number {
  return matches.reduce((max, match) => Math.max(max, match.round), 1);
}

type CourtMatchup = { teamA: number; teamB: number; court: number };

function circlePairings(teamCount: number): [number, number][][] {
  const ids: (number | null)[] = Array.from({ length: teamCount }, (_, index) => index + 1);
  if (teamCount % 2 === 1) ids.push(null);
  const count = ids.length;
  const rotation = ids.slice();
  const rounds: [number, number][][] = [];

  for (let round = 0; round < count - 1; round++) {
    const matches: [number, number][] = [];
    for (let index = 0; index < count / 2; index++) {
      const teamA = rotation[index];
      const teamB = rotation[count - 1 - index];
      if (teamA != null && teamB != null) matches.push([teamA, teamB]);
    }
    rounds.push(matches);
    const fixed = rotation[0];
    const rest = rotation.slice(1);
    const moved = rest.pop();
    if (moved !== undefined) rest.unshift(moved);
    rotation.splice(0, rotation.length, fixed, ...rest);
  }

  return rounds;
}

function packOntoCourts(pairings: [number, number][][], courtCount: number): CourtMatchup[][] {
  let queue = pairings.flat();
  const rounds: CourtMatchup[][] = [];

  while (queue.length > 0) {
    const round: [number, number][] = [];
    const used = new Set<number>();
    const deferred: [number, number][] = [];

    for (const pairing of queue) {
      const [teamA, teamB] = pairing;
      if (round.length < courtCount && !used.has(teamA) && !used.has(teamB)) {
        round.push(pairing);
        used.add(teamA);
        used.add(teamB);
      } else {
        deferred.push(pairing);
      }
    }

    rounds.push(
      round.map(([teamA, teamB], courtIndex) => ({
        teamA,
        teamB,
        court: courtIndex + 1,
      }))
    );
    queue = deferred;
  }

  return rounds;
}

// 6-team round robin: 15 matches across 8 rounds (2 courts)
export const ROUND_MATCHUPS: CourtMatchup[][] = [
  // Round 1: A-F, B-E
  [{ teamA: 1, teamB: 6, court: 1 }, { teamA: 2, teamB: 5, court: 2 }],
  // Round 2: C-D, A-E
  [{ teamA: 3, teamB: 4, court: 1 }, { teamA: 1, teamB: 5, court: 2 }],
  // Round 3: B-F, C-A
  [{ teamA: 2, teamB: 6, court: 1 }, { teamA: 3, teamB: 1, court: 2 }],
  // Round 4: D-E, B-C
  [{ teamA: 4, teamB: 5, court: 1 }, { teamA: 2, teamB: 3, court: 2 }],
  // Round 5: A-D, F-E
  [{ teamA: 1, teamB: 4, court: 1 }, { teamA: 6, teamB: 5, court: 2 }],
  // Round 6: B-D, C-F
  [{ teamA: 2, teamB: 4, court: 1 }, { teamA: 3, teamB: 6, court: 2 }],
  // Round 7: A-B, D-F
  [{ teamA: 1, teamB: 2, court: 1 }, { teamA: 4, teamB: 6, court: 2 }],
  // Round 8: C-E
  [{ teamA: 3, teamB: 5, court: 1 }],
];

export function buildRoundMatchups(teamCount: number): CourtMatchup[][] {
  if (!isTeamCount(teamCount)) {
    throw new Error('Tournament must have 6, 7, 8, or 9 teams');
  }
  switch (teamCount) {
    case 6:
      return ROUND_MATCHUPS;
    case 7:
    case 8:
    case 9:
      return packOntoCourts(circlePairings(teamCount), courtCountForTeams(teamCount));
    default: {
      const unexpected: never = teamCount;
      return unexpected;
    }
  }
}

export const DEFAULT_PLAYER_NAMES = [
  'Jason', 'JasonNg', 'Mike', 'Kim', 'Alex', 'Ray', 'Steven', 'Josh',
  'Justin', 'Stevie', 'Eddie', 'Yorkie', 'Tonny', 'Wilson', 'Victor',
  'Ian', 'Trevor', 'Jim', 'Peter', 'Ben', 'Andrew', 'Dan', 'Yves', 'Brian', 'Stan', 'Chi Ho',
];

export function normalizeName(name: string): string {
  return name.trim();
}

export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

export function namesMatch(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

export function duplicateNameKeys(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = nameKey(name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([key]) => key);
}

export function canonicalName(typed: string, knownNames: string[]): string {
  const trimmed = normalizeName(typed);
  const key = nameKey(trimmed);
  if (!key) return trimmed;
  return knownNames.find((name) => nameKey(name) === key) ?? trimmed;
}

export function pickDisplayName(current: string, next: string): string {
  const a = normalizeName(current);
  const b = normalizeName(next);
  if (!a) return b;
  if (!b) return a;
  const hasLeadingCap = (value: string) =>
    value.length > 0 && value[0] === value[0].toUpperCase() && value[0] !== value[0].toLowerCase();
  if (hasLeadingCap(b) && !hasLeadingCap(a)) return b;
  if (hasLeadingCap(a) && !hasLeadingCap(b)) return a;
  return normalizeName(b.length > a.length ? b : a);
}

export function getTeamLabel(teamId: number): TeamLabel {
  return TEAM_LABELS[teamId - 1] ?? 'A';
}

export function getPlayerIdsForTeam(teamId: number): [number, number] {
  const base = (teamId - 1) * 2;
  return [base + 1, base + 2];
}

export function getTeamIdForPlayer(playerId: number): number {
  return Math.ceil(playerId / 2);
}

export function getWinnerTeam(scoreA: number, scoreB: number): 'A' | 'B' {
  return scoreA > scoreB ? 'A' : 'B';
}

export function validateScore(scoreA: number, scoreB: number): boolean {
  if (scoreA < 0 || scoreB < 0 || scoreA > 30 || scoreB > 30) return false;
  if (scoreA === scoreB) return false;

  const [winner, loser] = scoreA > scoreB ? [scoreA, scoreB] : [scoreB, scoreA];

  // Cap at 30: game ends immediately (30-28, 30-29, etc.)
  if (winner === 30) return loser < 30;

  // Below cap: first to 21+ with 2-point lead; game ends at minimum winning score
  if (winner < 21 || winner - loser < 2) return false;

  const minWinner = Math.max(21, loser + 2);
  return winner === minWinner;
}

export function createTournament(
  teamRegistrations: TeamRegistration[],
  date?: string,
  options?: { name?: string; eventType?: EventType; courtNumbers?: number[] }
): Tournament {
  const singles = isSinglesEvent(options?.eventType);
  const teams: Team[] = teamRegistrations.map((reg, index) => {
    const teamId = index + 1;
    const [p1, p2] = getPlayerIdsForTeam(teamId);
    return {
      id: teamId,
      label: getTeamLabel(teamId),
      player1Id: p1,
      player2Id: singles ? 0 : p2,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    };
  });

  const players: Player[] = teamRegistrations.flatMap((reg, index) => {
    const teamId = index + 1;
    const [p1, p2] = getPlayerIdsForTeam(teamId);
    const side: Player[] = [
      {
        id: p1,
        name: normalizeName(reg.player1),
        teamId,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      },
    ];
    if (!singles) {
      side.push({
        id: p2,
        name: normalizeName(reg.player2),
        teamId,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      });
    }
    return side;
  });

  const teamCount = teamRegistrations.length;
  if (!isTeamCount(teamCount)) {
    throw new Error('Tournament must have 6, 7, 8, or 9 teams');
  }

  const matches: Match[] = [];
  let matchId = 1;

  buildRoundMatchups(teamCount).forEach((roundMatches, roundIndex) => {
    roundMatches.forEach((matchup) => {
      const [aP1, aP2] = getPlayerIdsForTeam(matchup.teamA);
      const [bP1, bP2] = getPlayerIdsForTeam(matchup.teamB);
      matches.push({
        id: matchId++,
        round: roundIndex + 1,
        court: UNASSIGNED_COURT,
        teamAId: matchup.teamA,
        teamBId: matchup.teamB,
        teamA: { player1: aP1, player2: singles ? 0 : aP2 },
        teamB: { player1: bP1, player2: singles ? 0 : bP2 },
        scoreA: null,
        scoreB: null,
        completed: false,
        winnerTeam: null,
      });
    });
  });

  const tournament: Tournament = {
    id: generateTournamentId(),
    name: options?.name?.trim() ?? '',
    eventType: options?.eventType ?? 'XD',
    date:
      date ||
      (() => {
        const fmt = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Los_Angeles',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        return fmt.format(new Date());
      })(),
    teams,
    players,
    matches,
    currentRound: 1,
    isFinalized: false,
    createdAt: new Date(),
    courtNumbers: options?.courtNumbers ?? defaultCourtNumbers(teamCount),
  };
  return syncPlayingCourts(tournament);
}


function applyMatchStats(
  tournament: Tournament,
  match: Match,
  scoreA: number,
  scoreB: number
): void {
  const winner = getWinnerTeam(scoreA, scoreB);
  match.scoreA = scoreA;
  match.scoreB = scoreB;
  match.completed = true;
  match.winnerTeam = winner;

  const teamA = tournament.teams.find((t) => t.id === match.teamAId);
  const teamB = tournament.teams.find((t) => t.id === match.teamBId);

  if (teamA) {
    teamA.pointsFor += scoreA;
    teamA.pointsAgainst += scoreB;
    if (winner === 'A') teamA.wins += 1;
    else teamA.losses += 1;
    teamA.pointDiff = teamA.pointsFor - teamA.pointsAgainst;
  }

  if (teamB) {
    teamB.pointsFor += scoreB;
    teamB.pointsAgainst += scoreA;
    if (winner === 'B') teamB.wins += 1;
    else teamB.losses += 1;
    teamB.pointDiff = teamB.pointsFor - teamB.pointsAgainst;
  }

  const updatePlayers = (playerIds: [number, number], forScore: number, againstScore: number, won: boolean) => {
    for (const pid of playerIds) {
      if (!pid) continue;
      const player = tournament.players.find((p) => p.id === pid);
      if (!player) continue;
      player.pointsFor += forScore;
      player.pointsAgainst += againstScore;
      player.pointDiff = player.pointsFor - player.pointsAgainst;
      if (won) player.wins += 1;
      else player.losses += 1;
    }
  };

  updatePlayers([match.teamA.player1, match.teamA.player2], scoreA, scoreB, winner === 'A');
  updatePlayers([match.teamB.player1, match.teamB.player2], scoreB, scoreA, winner === 'B');
}

export function recomputeAllStats(tournament: Tournament, pendingMatch?: { id: number; scoreA: number; scoreB: number }): void {
  tournament.teams.forEach((t) => {
    t.wins = 0;
    t.losses = 0;
    t.pointsFor = 0;
    t.pointsAgainst = 0;
    t.pointDiff = 0;
  });
  tournament.players.forEach((p) => {
    p.wins = 0;
    p.losses = 0;
    p.pointsFor = 0;
    p.pointsAgainst = 0;
    p.pointDiff = 0;
  });

  for (const m of tournament.matches) {
    const scores =
      pendingMatch && m.id === pendingMatch.id
        ? { scoreA: pendingMatch.scoreA, scoreB: pendingMatch.scoreB }
        : m.completed && m.scoreA != null && m.scoreB != null
          ? { scoreA: m.scoreA, scoreB: m.scoreB }
          : null;
    if (scores) {
      applyMatchStats(tournament, m, scores.scoreA, scores.scoreB);
    }
  }
}

export function updateMatchScore(
  tournament: Tournament,
  matchId: number,
  scoreA: number,
  scoreB: number,
  isEdit: boolean = false
): Tournament {
  const updatedTournament: Tournament = {
    ...tournament,
    teams: tournament.teams.map((t) => ({ ...t })),
    players: tournament.players.map((p) => ({ ...p })),
    matches: tournament.matches.map((m) => ({ ...m })),
  };

  const match = updatedTournament.matches.find((m) => m.id === matchId);
  if (!match || !validateScore(scoreA, scoreB)) {
    return tournament;
  }

  const wasCompleted = match.completed;
  const freedCourt = match.court;
  recomputeAllStats(updatedTournament, { id: matchId, scoreA, scoreB });
  if (!wasCompleted) match.finishOrder = nextFinishOrder(updatedTournament.matches, match.id);

  if (!isEdit) {
    const roundMatches = updatedTournament.matches.filter((m) => m.round === match.round);
    const roundCompleted = roundMatches.every((m) => m.completed);
    const lastRound = getTournamentRoundCount(updatedTournament.matches);
    if (roundCompleted && match.round < lastRound) {
      updatedTournament.currentRound = match.round + 1;
    }
    if (!wasCompleted) {
      const at = new Date().toISOString();
      if (updatedTournament.startedAt && match.startedAt) {
        match.endedAt = match.endedAt ?? at;
      }
      syncPlayingCourts(updatedTournament, { freedCourt: freedCourt || undefined });
      if (updatedTournament.startedAt) stampOpenMatchStarts(updatedTournament, match.endedAt ?? at);
    }
  }

  return updatedTournament;
}

export function matchQueueRank(match: Match): number {
  return match.queueOrder && match.queueOrder > 0 ? match.queueOrder : match.id;
}

function nextFinishOrder(matches: Match[], matchId: number): number {
  let max = 0;
  for (const match of matches) {
    if (match.id === matchId) continue;
    const order = match.finishOrder ?? 0;
    if (order > max) max = order;
  }
  return max + 1;
}

const NEVER_REST = 1000;
const MAX_RUN = 2;

function isRequeued(match: Match): boolean {
  return (match.queueOrder ?? 0) > 0 && match.queueOrder !== match.id;
}

function gamesPlayed(matches: Match[], teamId: number): number {
  return matches.filter((match) => match.completed && (match.teamAId === teamId || match.teamBId === teamId)).length;
}

function finishOrdersFor(matches: Match[], teamId: number): number[] {
  return matches
    .filter((match) => match.completed && (match.finishOrder ?? 0) > 0 && (match.teamAId === teamId || match.teamBId === teamId))
    .map((match) => match.finishOrder ?? 0)
    .sort((a, b) => a - b);
}

function restCount(matches: Match[], teamId: number): number {
  const finishes = finishOrdersFor(matches, teamId);
  if (finishes.length === 0) return NEVER_REST;
  const last = finishes[finishes.length - 1];
  return matches.filter((match) => match.completed && (match.finishOrder ?? 0) > last).length;
}

function latestFinished(matches: Match[], teamId: number): Match | null {
  let best: Match | null = null;
  for (const match of matches) {
    if (!match.completed || (match.finishOrder ?? 0) <= 0) continue;
    if (match.teamAId !== teamId && match.teamBId !== teamId) continue;
    if (!best || (match.finishOrder ?? 0) > (best.finishOrder ?? 0)) best = match;
  }
  return best;
}

function nextRun(matches: Match[], teamId: number): number {
  if (restCount(matches, teamId) > 0) return 1;
  const last = latestFinished(matches, teamId);
  if (!last) return 1;
  const previous = last.teamAId === teamId ? last.streakA ?? 1 : last.streakB ?? 1;
  return Math.max(previous, 1) + 1;
}

function restRank(match: Match, matches: Match[]): number[] {
  const teams = [match.teamAId, match.teamBId];
  const incoming = Math.max(...teams.map((teamId) => nextRun(matches, teamId)));
  const minRest = Math.min(...teams.map((teamId) => restCount(matches, teamId)));
  const maxGames = Math.max(...teams.map((teamId) => gamesPlayed(matches, teamId)));
  const sumGames = teams.reduce((total, teamId) => total + gamesPlayed(matches, teamId), 0);
  return [incoming, -minRest, maxGames, sumGames, matchQueueRank(match), match.id];
}

function compareRank(a: number[], b: number[]): number {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function pickNextMatch(pool: Match[], matches: Match[]): Match | null {
  const normal = pool.filter((match) => !isRequeued(match));
  const primary = normal.length > 0 ? normal : pool;
  if (primary.length === 0) return null;
  const ranked = primary.slice().sort((a, b) => compareRank(restRank(a, matches), restRank(b, matches)));
  return ranked[0] ?? null;
}

export function requeueMatch(tournament: Tournament, matchId: number): Tournament {
  const existing = tournament.matches.find((match) => match.id === matchId);
  if (!existing || !existing.completed || tournament.isFinalized) return tournament;

  const updatedTournament: Tournament = {
    ...tournament,
    teams: tournament.teams.map((team) => ({ ...team })),
    players: tournament.players.map((player) => ({ ...player })),
    matches: tournament.matches.map((match) => ({ ...match })),
  };

  const match = updatedTournament.matches.find((item) => item.id === matchId);
  if (!match) return tournament;

  const nextOrder = updatedTournament.matches.reduce(
    (max, item) => Math.max(max, matchQueueRank(item)),
    0
  ) + 1;
  match.scoreA = null;
  match.scoreB = null;
  match.completed = false;
  match.winnerTeam = null;
  match.queueOrder = nextOrder;
  match.finishOrder = undefined;
  match.streakA = undefined;
  match.streakB = undefined;
  match.court = UNASSIGNED_COURT;
  match.matchNumber = undefined;
  match.startedAt = undefined;
  match.endedAt = undefined;

  recomputeAllStats(updatedTournament);
  const incompleteRounds = updatedTournament.matches
    .filter((item) => !item.completed)
    .map((item) => item.round);
  updatedTournament.currentRound = Math.min(...incompleteRounds);
  syncPlayingCourts(updatedTournament);
  if (updatedTournament.startedAt) stampOpenMatchStarts(updatedTournament, new Date().toISOString());

  return updatedTournament;
}

export function getRankedTeams(tournament: Tournament): Team[] {
  const sorted = [...tournament.teams].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointDiff - a.pointDiff;
  });

  const ranked: Team[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const team = sorted[i];
    if (
      i > 0 &&
      sorted[i - 1].wins === team.wins &&
      sorted[i - 1].pointDiff === team.pointDiff
    ) {
      ranked.push({ ...team, rank: ranked[i - 1].rank });
    } else {
      ranked.push({ ...team, rank: i + 1 });
    }
  }
  return ranked;
}

export function getRankedPlayers(tournament: Tournament): Player[] {
  const sorted = [...tournament.players].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.pointDiff - a.pointDiff;
  });

  const ranked: Player[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i];
    if (
      i > 0 &&
      sorted[i - 1].wins === player.wins &&
      sorted[i - 1].pointDiff === player.pointDiff
    ) {
      ranked.push({ ...player, rank: ranked[i - 1].rank });
    } else {
      ranked.push({ ...player, rank: i + 1 });
    }
  }
  return ranked;
}

export function getTeamDisplayName(tournament: Tournament, teamId: number): string {
  const team = tournament.teams.find((t) => t.id === teamId);
  if (!team) return `Team ${getTeamLabel(teamId)}`;
  const p1 = tournament.players.find((p) => p.id === team.player1Id)?.name ?? '';
  const p2 = team.player2Id
    ? (tournament.players.find((p) => p.id === team.player2Id)?.name ?? '')
    : '';
  const names = formatSideNames(p1, p2);
  if (!p2) return names || `Player ${team.label}`;
  return `Team ${team.label}: ${names}`;
}

export interface TeamMatchSummary {
  matchId: number;
  opponentTeamId: number;
  opponentLabel: TeamLabel;
  teamScore: number | null;
  opponentScore: number | null;
  completed: boolean;
  won: boolean | null;
}

export function getTeamMatchSummaries(tournament: Tournament, teamId: number): TeamMatchSummary[] {
  return tournament.matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .sort((a, b) => a.id - b.id)
    .map((match) => {
      const isTeamA = match.teamAId === teamId;
      const opponentTeamId = isTeamA ? match.teamBId : match.teamAId;
      const teamScore = isTeamA ? match.scoreA : match.scoreB;
      const opponentScore = isTeamA ? match.scoreB : match.scoreA;
      let won: boolean | null = null;
      if (match.completed && teamScore != null && opponentScore != null) {
        won = teamScore > opponentScore;
      }
      return {
        matchId: match.id,
        opponentTeamId,
        opponentLabel: getTeamLabel(opponentTeamId),
        teamScore,
        opponentScore,
        completed: match.completed,
        won,
      };
    });
}

export function generateTournamentId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function isTournamentComplete(tournament: Tournament): boolean {
  return tournament.matches.every((match) => match.completed);
}

export function getMatchPlayerIds(match: Match): number[] {
  return [match.teamA.player1, match.teamA.player2, match.teamB.player1, match.teamB.player2].filter(
    (id) => id > 0
  );
}

export function matchesShareParticipants(a: Match, b: Match): boolean {
  const playersA = new Set(getMatchPlayerIds(a));
  return getMatchPlayerIds(b).some((playerId) => playersA.has(playerId));
}

export function matchesConflictWithAny(match: Match, others: Match[]): boolean {
  return others.some((other) => matchesShareParticipants(match, other));
}

/**
 * Pick up to maxSpotlight incomplete matches for the courts in use.
 * Matches already on a court stay there. An open court goes to a match that
 * shares no players with whoever is still playing. Among those, take the team
 * that has had the longest break. A third game in a row waits until another
 * court finishes, and only goes out when no court is playing. A clashing match
 * is never sent out.
 */
export function getDesktopSpotlightMatches(
  matches: Match[],
  maxSpotlight = 2
): { spotlight: Match[]; deferred: Match[] } {
  const incomplete = [...matches]
    .filter((m) => !m.completed)
    .sort((a, b) => matchQueueRank(a) - matchQueueRank(b) || a.id - b.id);

  const spotlight: Match[] = [];
  const usedCourts = new Set<number>();
  for (const match of incomplete) {
    if (spotlight.length >= maxSpotlight) break;
    if (match.court > 0 && !usedCourts.has(match.court)) {
      spotlight.push(match);
      usedCourts.add(match.court);
    }
  }

  const seated = new Set(spotlight.map((match) => match.id));
  while (spotlight.length < maxSpotlight) {
    const waiting = incomplete.filter((match) => !seated.has(match.id));
    if (waiting.length === 0) break;
    const clean = waiting.filter((match) => !matchesConflictWithAny(match, spotlight));
    const safe = clean.filter((match) => [match.teamAId, match.teamBId].every((teamId) => nextRun(matches, teamId) <= MAX_RUN));
    const pool = safe.length > 0 ? safe : spotlight.length === 0 ? clean : [];
    if (pool.length === 0) break;
    const pick = pickNextMatch(pool, matches);
    if (!pick) break;
    spotlight.push(pick);
    seated.add(pick.id);
  }

  const deferred = incomplete.filter((match) => !seated.has(match.id));
  deferred.sort((a, b) => {
    const requeueDelta = Number(isRequeued(a)) - Number(isRequeued(b));
    if (requeueDelta !== 0) return requeueDelta;
    return compareRank(restRank(a, matches), restRank(b, matches));
  });
  return { spotlight, deferred };
}

export type QueuePlace =
  | { kind: 'confirmed'; offset: number }
  | { kind: 'tentative'; reason: 'on-court' | 'streak' | 'overlap' | 'later' | 'requeued' };

export interface QueueCard {
  match: Match;
  place: QueuePlace;
}

export function queuePlaceLabel(place: QueuePlace): string {
  if (place.kind === 'tentative') return 'Tentative Queue';
  if (place.offset === 0) return 'Confirmed Next';
  return `Confirmed Next +${place.offset}`;
}

export function queuePlaceExplanation(place: QueuePlace): string {
  if (place.kind === 'confirmed') {
    if (place.offset === 0) {
      return 'This match is next on court. Both teams are free, so this spot will not move because someone else has waited longer or played fewer games.';
    }
    const spots = place.offset === 1 ? '1 match' : `${place.offset} matches`;
    return `This match is locked ${spots} after the next one. These spots go on court in this order as courts open. Wait time and busyness will not jump them.`;
  }
  switch (place.reason) {
    case 'on-court':
      return 'Someone in this match is still playing. It cannot be called until that game ends, and by then the line can be re-sorted by who has waited longer and who has played more.';
    case 'streak':
      return 'One of these teams would be playing a third game in a row, so they wait. A team that has had a longer break can be called ahead of them.';
    case 'overlap':
      return 'This match shares a player with a confirmed match ahead of it, so it waits. The rest of the line can still be re-sorted by wait time and how busy each team is.';
    case 'requeued':
      return 'This match was sent back to the queue, so it sits behind the locked spots. Its place can still change based on wait time and busyness.';
    case 'later':
      return 'This match is past the locked spots. When a court opens, the line can be re-sorted. A team that has waited longer, or played fewer games, can move ahead.';
    default: {
      const unreachable: never = place.reason;
      return unreachable;
    }
  }
}

/**
 * The next clear matches, one per court, are locked. Anything that clashes,
 * is on a long streak, or sits further back can still be re-sorted.
 */
export function buildQueueCards(matches: Match[], deferred: Match[], courtCount: number): QueueCard[] {
  const playing = matches.filter((match) => !match.completed && match.court > 0);
  const limit = Math.max(courtCount, 1);
  const normalWaiting = deferred.some((match) => !isRequeued(match));
  const confirmed: QueueCard[] = [];
  const tentative: QueueCard[] = [];
  const confirmedMatches: Match[] = [];

  for (const match of deferred) {
    if (confirmed.length >= limit) {
      tentative.push({ match, place: { kind: 'tentative', reason: isRequeued(match) ? 'requeued' : 'later' } });
      continue;
    }
    if (normalWaiting && isRequeued(match)) {
      tentative.push({ match, place: { kind: 'tentative', reason: 'requeued' } });
      continue;
    }
    if (matchesConflictWithAny(match, playing)) {
      tentative.push({ match, place: { kind: 'tentative', reason: 'on-court' } });
      continue;
    }
    if (matchesConflictWithAny(match, confirmedMatches)) {
      tentative.push({ match, place: { kind: 'tentative', reason: 'overlap' } });
      continue;
    }
    const streak = [match.teamAId, match.teamBId].some((teamId) => nextRun(matches, teamId) > MAX_RUN);
    if (streak) {
      tentative.push({ match, place: { kind: 'tentative', reason: 'streak' } });
      continue;
    }
    confirmedMatches.push(match);
    confirmed.push({ match, place: { kind: 'confirmed', offset: confirmedMatches.length - 1 } });
  }

  return [...confirmed, ...tentative];
}

/** Oldest start on the left. The match that just went on court stays on the right. */
export function orderPlayingNow(matches: Match[]): Match[] {
  const started = (match: Match) => {
    if (!match.startedAt) return Number.POSITIVE_INFINITY;
    const time = Date.parse(match.startedAt);
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };
  return [...matches].sort((a, b) => started(a) - started(b) || a.id - b.id);
}

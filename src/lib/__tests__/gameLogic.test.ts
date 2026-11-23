import {
  createTournament,
  validateScore,
  updateMatchScore,
  getRankedTeams,
  getRankedPlayers,
  isTournamentComplete,
  ROUND_MATCHUPS,
  NUM_TEAMS,
  NUM_MATCHES,
  NUM_ROUNDS,
  buildRoundMatchups,
  matchCountForTeams,
  courtCountForTeams,
  getWinnerTeam,
  getDesktopSpotlightMatches,
  orderPlayingNow,
  buildQueueCards,
  queuePlaceLabel,
  type Match,
  getMatchPlayerIds,
  matchesShareParticipants,
  matchesConflictWithAny,
  requeueMatch,
  startTournament,
  UNASSIGNED_COURT,
  defaultCourtNumbers,
  formatCourtLabel,
  normalizeCourtNumbers,
  relabelCourtNumbers,
  toPgIntArray,
} from '../gameLogic';

const sampleTeams = [
  { player1: 'Alice', player2: 'Amy' },
  { player1: 'Bob', player2: 'Ben' },
  { player1: 'Charlie', player2: 'Chris' },
  { player1: 'David', player2: 'Dan' },
  { player1: 'Eve', player2: 'Emma' },
  { player1: 'Frank', player2: 'Fred' },
];

describe('Game Logic', () => {
  describe('createTournament', () => {
    it('should create a tournament with 6 teams, 12 players, and 15 matches', () => {
      const tournament = createTournament(sampleTeams);

      expect(tournament.teams).toHaveLength(NUM_TEAMS);
      expect(tournament.players).toHaveLength(12);
      expect(tournament.matches).toHaveLength(NUM_MATCHES);
      expect(tournament.currentRound).toBe(1);
    });

    it('creates one player per side for singles and does not share a phantom partner', () => {
      const regs = ['Ann', 'Ben', 'Cara', 'Dan', 'Eve', 'Finn'].map((name) => ({
        player1: name,
        player2: '',
      }));
      const tournament = createTournament(regs, '2026-11-22', { eventType: 'MS' });

      expect(tournament.eventType).toBe('MS');
      expect(tournament.players).toHaveLength(6);
      expect(tournament.teams.every((team) => team.player2Id === 0)).toBe(true);
      expect(tournament.matches[0].teamA.player2).toBe(0);
      expect(getMatchPlayerIds(tournament.matches[0])).toEqual([
        tournament.matches[0].teamA.player1,
        tournament.matches[0].teamB.player1,
      ]);
      expect(matchesShareParticipants(tournament.matches[0], tournament.matches[1])).toBe(false);

      const scored = updateMatchScore(
        tournament,
        tournament.matches[0].id,
        21,
        15
      );
      const ranked = getRankedPlayers(scored);
      expect(ranked).toHaveLength(6);
      expect(ranked.filter((player) => player.wins === 1)).toHaveLength(1);
      expect(ranked.filter((player) => player.losses === 1)).toHaveLength(1);
    });

    it('should initialize all stats to 0', () => {
      const tournament = createTournament(sampleTeams);

      tournament.teams.forEach((team) => {
        expect(team.wins).toBe(0);
        expect(team.losses).toBe(0);
        expect(team.pointDiff).toBe(0);
      });
    });
  });

  describe('validateScore', () => {
    it('should accept valid scores', () => {
      expect(validateScore(21, 15)).toBe(true);
      expect(validateScore(10, 21)).toBe(true);
      expect(validateScore(22, 20)).toBe(true);
      expect(validateScore(30, 29)).toBe(true);
      expect(validateScore(30, 28)).toBe(true);
      expect(validateScore(29, 30)).toBe(true);
      expect(validateScore(28, 26)).toBe(true);
    });

    it('should reject invalid scores', () => {
      expect(validateScore(20, 19)).toBe(false);
      expect(validateScore(21, 21)).toBe(false);
      expect(validateScore(22, 21)).toBe(false);
      expect(validateScore(28, 0)).toBe(false);
      expect(validateScore(28, 14)).toBe(false);
      expect(validateScore(30, 30)).toBe(false);
      expect(validateScore(-1, 21)).toBe(false);
    });

    it('should accept minimum winning scores only', () => {
      expect(validateScore(21, 0)).toBe(true);
      expect(validateScore(21, 14)).toBe(true);
      expect(validateScore(28, 26)).toBe(true);
    });
  });

  describe('getWinnerTeam', () => {
    it('should return correct winner', () => {
      expect(getWinnerTeam(21, 15)).toBe('A');
      expect(getWinnerTeam(15, 21)).toBe('B');
      expect(getWinnerTeam(30, 29)).toBe('A');
    });
  });

  describe('updateMatchScore', () => {
    it('should update team and player W/L records', () => {
      const tournament = createTournament(sampleTeams);
      const firstMatch = tournament.matches[0];

      const updated = updateMatchScore(tournament, firstMatch.id, 21, 15);

      const teamA = updated.teams.find((t) => t.id === firstMatch.teamAId);
      const teamB = updated.teams.find((t) => t.id === firstMatch.teamBId);
      expect(teamA?.wins).toBe(1);
      expect(teamA?.losses).toBe(0);
      expect(teamB?.wins).toBe(0);
      expect(teamB?.losses).toBe(1);
      expect(teamA?.pointDiff).toBe(6);
    });
  });

  describe('getRankedTeams', () => {
    it('should rank teams by wins then point diff', () => {
      const tournament = createTournament(sampleTeams);
      tournament.teams[0].wins = 4;
      tournament.teams[0].pointDiff = 20;
      tournament.teams[1].wins = 4;
      tournament.teams[1].pointDiff = 10;
      tournament.teams[2].wins = 3;
      tournament.teams[2].pointDiff = 30;

      const ranked = getRankedTeams(tournament);
      expect(ranked[0].id).toBe(1);
      expect(ranked[1].id).toBe(2);
      expect(ranked[2].id).toBe(3);
    });
  });

  describe('getRankedPlayers', () => {
    it('should rank players by wins then point diff', () => {
      const tournament = createTournament(sampleTeams);
      tournament.players[0].wins = 5;
      tournament.players[0].pointDiff = 15;
      tournament.players[1].wins = 4;
      tournament.players[1].pointDiff = 20;

      const ranked = getRankedPlayers(tournament);
      expect(ranked[0].id).toBe(1);
      expect(ranked[1].id).toBe(2);
    });
  });

  describe('ROUND_MATCHUPS', () => {
    it('should have 8 rounds with 15 total matches', () => {
      expect(ROUND_MATCHUPS).toHaveLength(NUM_ROUNDS);
      const total = ROUND_MATCHUPS.reduce((sum, r) => sum + r.length, 0);
      expect(total).toBe(NUM_MATCHES);
    });

    it('should ensure each team pair plays exactly once', () => {
      const pairings = new Set();

      ROUND_MATCHUPS.forEach((round) => {
        round.forEach((match) => {
          const key = [match.teamA, match.teamB].sort().join('-');
          expect(pairings.has(key)).toBe(false);
          pairings.add(key);
        });
      });

      expect(pairings.size).toBe(15);
    });
  });

  describe('buildRoundMatchups', () => {
    function assertRoundRobin(teamCount = 6) {
      const rounds = buildRoundMatchups(teamCount);
      const pairings = new Set();
      const games = new Map();

      rounds.forEach((round) => {
        expect(round.length).toBeGreaterThan(0);
        expect(round.length).toBeLessThanOrEqual(courtCountForTeams(teamCount));
        const playing = new Set();
        round.forEach((match) => {
          expect(playing.has(match.teamA)).toBe(false);
          expect(playing.has(match.teamB)).toBe(false);
          playing.add(match.teamA);
          playing.add(match.teamB);
          const key = [match.teamA, match.teamB].sort().join('-');
          expect(pairings.has(key)).toBe(false);
          pairings.add(key);
          games.set(match.teamA, (games.get(match.teamA) ?? 0) + 1);
          games.set(match.teamB, (games.get(match.teamB) ?? 0) + 1);
        });
      });

      expect(pairings.size).toBe(matchCountForTeams(teamCount));
      for (let teamId = 1; teamId <= teamCount; teamId++) {
        expect(games.get(teamId)).toBe(teamCount - 1);
      }
    }

    it('keeps the 6-team schedule at 15 games and 8 rounds', () => {
      expect(buildRoundMatchups(6)).toEqual(ROUND_MATCHUPS);
      assertRoundRobin(6);
    });

    it('builds a 21-game schedule for 7 teams', () => {
      assertRoundRobin(7);
      expect(buildRoundMatchups(7).length).toBeLessThanOrEqual(14);
    });

    it('builds a 28-game schedule for 8 teams on 14 full rounds', () => {
      const rounds = buildRoundMatchups(8);
      expect(rounds).toHaveLength(14);
      expect(rounds.every((round) => round.length === 2)).toBe(true);
      assertRoundRobin(8);
    });

    it('builds a 36-game schedule for 9 teams on 12 full rounds of 3 courts', () => {
      const rounds = buildRoundMatchups(9);
      expect(rounds).toHaveLength(12);
      expect(rounds.every((round) => round.length === 3)).toBe(true);
      const courts = new Set(rounds.flat().map((match) => match.court));
      expect([...courts].sort((a, b) => a - b)).toEqual([1, 2, 3]);
      expect(courtCountForTeams(9)).toBe(3);
      expect(courtCountForTeams(6)).toBe(2);
      expect(courtCountForTeams(7)).toBe(2);
      expect(courtCountForTeams(8)).toBe(2);
      assertRoundRobin(9);
    });

    it('creates 7-, 8-, and 9-team tournaments from the registration list', () => {
      const seven = createTournament([
        ...sampleTeams,
        { player1: 'Gina', player2: 'Grace' },
      ]);
      expect(seven.teams).toHaveLength(7);
      expect(seven.players).toHaveLength(14);
      expect(seven.matches).toHaveLength(21);
      expect(seven.teams[6].label).toBe('G');

      const eight = createTournament([
        ...sampleTeams,
        { player1: 'Gina', player2: 'Grace' },
        { player1: 'Hank', player2: 'Holly' },
      ]);
      expect(eight.teams).toHaveLength(8);
      expect(eight.matches).toHaveLength(28);
      expect(eight.teams[7].label).toBe('H');

      const nine = createTournament([
        ...sampleTeams,
        { player1: 'Gina', player2: 'Grace' },
        { player1: 'Hank', player2: 'Holly' },
        { player1: 'Ivy', player2: 'Iris' },
      ]);
      expect(nine.teams).toHaveLength(9);
      expect(nine.players).toHaveLength(18);
      expect(nine.matches).toHaveLength(36);
      expect(nine.teams[8].label).toBe('I');
    });
  });

  describe('isTournamentComplete', () => {
    it('should return false when matches incomplete', () => {
      const tournament = createTournament(sampleTeams);
      expect(isTournamentComplete(tournament)).toBe(false);
    });
  });

  describe('getDesktopSpotlightMatches', () => {
    it('spotlights 3 non-conflicting matches for a 9-team tournament', () => {
      const tournament = createTournament([
        ...sampleTeams,
        { player1: 'Gina', player2: 'Grace' },
        { player1: 'Hank', player2: 'Holly' },
        { player1: 'Ivy', player2: 'Iris' },
      ]);
      const { spotlight } = getDesktopSpotlightMatches(
        tournament.matches,
        courtCountForTeams(tournament.teams.length)
      );
      expect(spotlight).toHaveLength(3);
      expect(matchesShareParticipants(spotlight[0], spotlight[1])).toBe(false);
      expect(matchesShareParticipants(spotlight[0], spotlight[2])).toBe(false);
      expect(matchesShareParticipants(spotlight[1], spotlight[2])).toBe(false);

      const inferred = getDesktopSpotlightMatches(tournament.matches);
      expect(inferred.spotlight).toHaveLength(2);
    });

    it('should not place matches with shared players in spotlight together', () => {
      const tournament = createTournament(sampleTeams);
      const { spotlight, deferred } = getDesktopSpotlightMatches(tournament.matches);

      expect(spotlight).toHaveLength(2);
      expect(matchesShareParticipants(spotlight[0], spotlight[1])).toBe(false);
      expect(deferred.map((m) => m.id)).toContain(4);
    });

    it('should surface deferred matches after a conflicting spotlight match completes', () => {
      const tournament = createTournament(sampleTeams);

      tournament.matches = updateMatchScore(tournament, 1, 21, 10).matches;

      const before = getDesktopSpotlightMatches(tournament.matches);
      expect(before.deferred.map((m) => m.id)).toContain(4);

      tournament.matches = updateMatchScore(tournament, 2, 21, 10).matches;

      const after = getDesktopSpotlightMatches(tournament.matches);
      expect(after.spotlight.map((m) => m.id)).toContain(4);
    });

    it('leaves a court empty instead of pairing teams that share players', () => {
      const tournament = createTournament(sampleTeams);
      const blockedQueue = tournament.matches.filter((m) => [1, 4, 6, 9].includes(m.id));
      const { spotlight } = getDesktopSpotlightMatches(blockedQueue);

      expect(spotlight).toHaveLength(1);
      expect(spotlight[0].id).toBe(1);
      expect(blockedQueue.filter((match) => match.id !== 1).every((match) => matchesShareParticipants(spotlight[0], match))).toBe(true);
    });

    it('keeps a match on its court when a requeued match is waiting or comes up', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      for (const match of tournament.matches) {
        const onCourt = match.id === 1 || match.id === 4;
        match.completed = !onCourt;
        match.scoreA = match.completed ? 21 : null;
        match.scoreB = match.completed ? 15 : null;
        match.court = match.id === 1 ? 11 : match.id === 4 ? 12 : UNASSIGNED_COURT;
        match.winnerTeam = match.completed ? 'A' : null;
      }

      const synced = requeueMatch(tournament, 8);
      const stillOn11 = synced.matches.find((match) => match.id === 1)!;
      const stillOn12 = synced.matches.find((match) => match.id === 4)!;
      const waiting = synced.matches.find((match) => match.id === 8)!;
      expect(stillOn11.court).toBe(11);
      expect(stillOn12.court).toBe(12);
      expect(waiting.court).toBe(UNASSIGNED_COURT);
      expect(getDesktopSpotlightMatches(synced.matches, 2).spotlight.map((match) => match.id)).toEqual([1, 4]);

      const played = updateMatchScore(synced, 1, 21, 15);
      expect(played.matches.find((match) => match.id === 4)?.court).toBe(12);
      expect(played.matches.find((match) => match.id === 8)?.court).toBe(11);
    });

    it('keeps runs to 2 and will not clash when a clean match exists', () => {
      const extras = [
        { player1: 'Gina', player2: 'Grace' },
        { player1: 'Hank', player2: 'Holly' },
        { player1: 'Ivy', player2: 'Iris' },
      ];
      for (const count of [6, 7, 8, 9]) {
        const regs = [...sampleTeams, ...extras.slice(0, count - 6)];
        let next = createTournament(regs);
        const courts = courtCountForTeams(count);
        let guard = 0;
        while (!isTournamentComplete(next) && guard++ < 80) {
          const { spotlight } = getDesktopSpotlightMatches(next.matches, courts);
          expect(spotlight.length).toBeGreaterThan(0);
          const cleanAlternative = next.matches.filter((match) => (
            !match.completed
            && !spotlight.some((seated) => seated.id === match.id)
            && !matchesConflictWithAny(match, spotlight)
          ));
          const clashing = spotlight.some((match, index) => spotlight.some((other, otherIndex) => otherIndex > index && matchesShareParticipants(match, other)));
          if (clashing) expect(cleanAlternative).toHaveLength(0);
          next = updateMatchScore(next, spotlight[0].id, 21, 15);
        }
        expect(isTournamentComplete(next)).toBe(true);
        const longest = Math.max(...next.matches.flatMap((match) => [match.streakA ?? 1, match.streakB ?? 1]));
        expect(longest).toBeLessThanOrEqual(2);
      }
    });

    it('puts a requeued match at the end of the queue and clears its score', () => {
      const tournament = createTournament(sampleTeams);
      let next = updateMatchScore(tournament, 1, 21, 10);
      next = updateMatchScore(next, 2, 21, 8);

      next = requeueMatch(next, 1);
      const match = next.matches.find((item) => item.id === 1);
      expect(match?.completed).toBe(false);
      expect(match?.scoreA).toBeNull();
      expect(match?.scoreB).toBeNull();

      const after = getDesktopSpotlightMatches(next.matches);
      expect(after.deferred.at(-1)?.id).toBe(1);
      expect(after.spotlight.map((item) => item.id)).not.toContain(1);
      expect(next.teams.reduce((sum, team) => sum + team.wins, 0)).toBe(1);
    });
  });

  describe('court numbers', () => {
    it('assigns custom court numbers only to spotlight matches', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      expect(tournament.courtNumbers).toEqual([11, 12]);
      expect(defaultCourtNumbers(6)).toEqual([1, 2]);
      expect(defaultCourtNumbers(9)).toEqual([1, 2, 3]);
      expect(normalizeCourtNumbers([11, 12], 6)).toEqual([11, 12]);
      expect(normalizeCourtNumbers([11, 11], 6)).toBeNull();
      expect(toPgIntArray([10, 2, 3])).toBe('{10,2,3}');
      expect(toPgIntArray([1, 2])).toBe('{1,2}');
      expect(() => toPgIntArray([])).toThrow();
      expect(formatCourtLabel(0)).toBeNull();
      expect(formatCourtLabel(11)).toBe('Court 11');
      expect(formatCourtLabel(11, true)).toBe('Ct 11');

      const { spotlight, deferred } = getDesktopSpotlightMatches(tournament.matches, 2);
      expect(spotlight.map((match) => match.court).sort((a, b) => a - b)).toEqual([11, 12]);
      expect(deferred.every((match) => match.court === UNASSIGNED_COURT)).toBe(true);
    });

    it('gives the freed court number to the next queued match', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      const firstCourt11 = tournament.matches.find((match) => !match.completed && match.court === 11);
      expect(firstCourt11).toBeTruthy();
      const next = updateMatchScore(tournament, firstCourt11!.id, 21, 15);
      const completed = next.matches.find((match) => match.id === firstCourt11!.id);
      expect(completed?.completed).toBe(true);
      expect(completed?.court).toBe(11);
      const playing = getDesktopSpotlightMatches(next.matches, 2).spotlight;
      expect(playing).toHaveLength(2);
      expect(playing.some((match) => match.id !== firstCourt11!.id && match.court === 11)).toBe(true);
      expect(playing.map((match) => match.court).sort((a, b) => a - b)).toEqual([11, 12]);
    });

    it('relabels finished and playing matches when court numbers change', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      const firstCourt11 = tournament.matches.find((match) => !match.completed && match.court === 11)!;
      const scored = updateMatchScore(tournament, firstCourt11.id, 21, 15);
      const relabeled = relabelCourtNumbers(scored, [21, 22]);
      expect(relabeled.courtNumbers).toEqual([21, 22]);
      const finished = relabeled.matches.find((match) => match.id === firstCourt11.id);
      expect(finished?.completed).toBe(true);
      expect(finished?.court).toBe(21);
      const playing = getDesktopSpotlightMatches(relabeled.matches, 2).spotlight;
      expect(playing.map((match) => match.court).sort((a, b) => a - b)).toEqual([21, 22]);
      expect(relabeled.matches.filter((match) => match.court === 11 || match.court === 12)).toHaveLength(0);
    });
  });

  describe('match clock', () => {
    it('puts the newest on-court match on the right even when its number is smaller', () => {
      const playing = orderPlayingNow([
        { id: 2, startedAt: '2026-11-23T09:40:00.000Z' },
        { id: 8, startedAt: '2026-11-23T09:25:00.000Z' },
        { id: 5, startedAt: '2026-11-23T09:25:00.000Z' },
      ] as Match[]);
      expect(playing.map((match) => match.id)).toEqual([5, 8, 2]);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('starts every match already on a court', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      const started = startTournament(tournament, '2026-11-23T18:00:00.000Z');
      const playing = started.matches.filter((match) => !match.completed && match.court > 0);
      expect(started.startedAt).toBe('2026-11-23T18:00:00.000Z');
      expect(playing.length).toBeGreaterThan(0);
      expect(playing.every((match) => match.startedAt === '2026-11-23T18:00:00.000Z')).toBe(true);
      expect(started.matches.filter((match) => match.court <= 0).every((match) => !match.startedAt)).toBe(true);
    });

    it('does not stamp times before Start', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      const first = tournament.matches.find((match) => match.court === 11)!;
      const next = updateMatchScore(tournament, first.id, 21, 15);
      const finished = next.matches.find((match) => match.id === first.id)!;
      expect(finished.startedAt).toBeUndefined();
      expect(finished.endedAt).toBeUndefined();
      expect(next.matches.filter((match) => !match.completed && match.court > 0).every((match) => !match.startedAt)).toBe(true);
    });

    it('ends a match on submit and starts the match that takes the court', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-23T18:20:00.000Z'));
      const tournament = startTournament(
        createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] }),
        '2026-11-23T18:00:00.000Z'
      );
      const first = tournament.matches.find((match) => match.court === 11 && !match.completed)!;
      const next = updateMatchScore(tournament, first.id, 21, 15);
      const finished = next.matches.find((match) => match.id === first.id)!;
      const replacement = next.matches.find((match) => !match.completed && match.court === 11);
      expect(finished.startedAt).toBe('2026-11-23T18:00:00.000Z');
      expect(finished.endedAt).toBe('2026-11-23T18:20:00.000Z');
      expect(replacement?.startedAt).toBe('2026-11-23T18:20:00.000Z');
    });

    it('keeps the original end time when a score is edited', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-23T18:20:00.000Z'));
      const tournament = startTournament(
        createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] }),
        '2026-11-23T18:00:00.000Z'
      );
      const first = tournament.matches.find((match) => match.court === 11)!;
      const scored = updateMatchScore(tournament, first.id, 21, 15);
      jest.setSystemTime(new Date('2026-11-23T19:00:00.000Z'));
      const edited = updateMatchScore(scored, first.id, 21, 18, true);
      expect(edited.matches.find((match) => match.id === first.id)?.endedAt).toBe('2026-11-23T18:20:00.000Z');
    });

    it('clears times on requeue and starts whoever takes the open court', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-11-23T18:40:00.000Z'));
      let tournament = startTournament(
        createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] }),
        '2026-11-23T18:00:00.000Z'
      );
      const first = tournament.matches.find((match) => match.court === 11)!;
      tournament = updateMatchScore(tournament, first.id, 21, 15);
      const requeued = requeueMatch(tournament, first.id);
      const waiting = requeued.matches.find((match) => match.id === first.id)!;
      expect(waiting.completed).toBe(false);
      expect(waiting.court).toBe(0);
      expect(waiting.startedAt).toBeUndefined();
      expect(waiting.endedAt).toBeUndefined();
      expect(waiting.matchNumber).toBeUndefined();
      const onCourt = requeued.matches.filter((match) => !match.completed && match.court > 0);
      expect(onCourt.every((match) => match.startedAt)).toBe(true);
    });

    it('locks the next clear matches and leaves the rest tentative', () => {
      const playing = {
        id: 1,
        round: 1,
        court: 11,
        teamAId: 1,
        teamBId: 2,
        teamA: { player1: 1, player2: 2 },
        teamB: { player1: 3, player2: 4 },
        scoreA: null,
        scoreB: null,
        completed: false,
      } as Match;
      const waiting = [
        { ...playing, id: 7, court: 0, teamAId: 1, teamBId: 7, teamA: { player1: 1, player2: 2 }, teamB: { player1: 13, player2: 14 } },
        { ...playing, id: 29, court: 0, teamAId: 3, teamBId: 4, teamA: { player1: 5, player2: 6 }, teamB: { player1: 7, player2: 8 } },
        { ...playing, id: 31, court: 0, teamAId: 5, teamBId: 6, teamA: { player1: 9, player2: 10 }, teamB: { player1: 11, player2: 12 } },
        { ...playing, id: 12, court: 0, teamAId: 8, teamBId: 9, teamA: { player1: 15, player2: 16 }, teamB: { player1: 17, player2: 18 } },
      ] as Match[];
      const cards = buildQueueCards([playing, ...waiting], waiting, 2);
      expect(cards.map((card) => card.match.id)).toEqual([29, 31, 7, 12]);
      expect(cards.map((card) => queuePlaceLabel(card.place))).toEqual([
        'Confirmed Next',
        'Confirmed Next +1',
        'Tentative Queue',
        'Tentative Queue',
      ]);
    });

    it('numbers a match only once it is on court', () => {
      const tournament = createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] });
      const playing = tournament.matches.filter((match) => match.court > 0);
      const queued = tournament.matches.filter((match) => match.court <= 0);
      expect(playing.map((match) => match.matchNumber).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2]);
      expect(queued.every((match) => match.matchNumber == null)).toBe(true);

      const started = startTournament(tournament, '2026-11-23T18:00:00.000Z');
      const first = started.matches.find((match) => match.court === 11)!;
      const next = updateMatchScore(started, first.id, 21, 15);
      expect(next.matches.find((match) => match.id === first.id)?.matchNumber).toBe(first.matchNumber);
      const replacement = next.matches.find((match) => match.court === 11 && match.id !== first.id);
      expect(replacement?.matchNumber).toBe(3);
      expect(next.matches.filter((match) => match.court <= 0).every((match) => match.matchNumber == null)).toBe(true);
    });
  });
});

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
  getWinnerTeam,
  getDesktopSpotlightMatches,
  matchesShareParticipants,
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
        expect(round.length).toBeLessThanOrEqual(2);
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

    it('creates 7- and 8-team tournaments from the registration list', () => {
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
    });
  });

  describe('isTournamentComplete', () => {
    it('should return false when matches incomplete', () => {
      const tournament = createTournament(sampleTeams);
      expect(isTournamentComplete(tournament)).toBe(false);
    });
  });

  describe('getDesktopSpotlightMatches', () => {
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

    it('should fill spotlight with conflicting matches when no clean second match exists', () => {
      const tournament = createTournament(sampleTeams);
      const blockedQueue = tournament.matches.filter((m) => [1, 4, 6, 9].includes(m.id));
      const { spotlight } = getDesktopSpotlightMatches(blockedQueue);

      expect(spotlight).toHaveLength(2);
      expect(spotlight[0].id).toBe(1);
      expect(spotlight[1].id).toBe(4);
      expect(matchesShareParticipants(spotlight[0], spotlight[1])).toBe(true);
    });
  });
});

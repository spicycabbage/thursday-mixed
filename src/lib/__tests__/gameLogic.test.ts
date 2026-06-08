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

  describe('isTournamentComplete', () => {
    it('should return false when matches incomplete', () => {
      const tournament = createTournament(sampleTeams);
      expect(isTournamentComplete(tournament)).toBe(false);
    });
  });

  describe('getDesktopSpotlightMatches', () => {
    it('should not place matches with shared players in spotlight together', () => {
      const tournament = createTournament(sampleTeams);
      const match4 = tournament.matches[3];
      const match5 = tournament.matches[4];

      expect(matchesShareParticipants(match4, match5)).toBe(true);

      const { spotlight, deferred } = getDesktopSpotlightMatches(tournament.matches);

      expect(spotlight).toHaveLength(2);
      expect(spotlight.every((m) => !matchesShareParticipants(m, spotlight[0]))).toBe(true);
      expect(deferred.map((m) => m.id)).toContain(5);
    });

    it('should surface deferred matches after a conflicting spotlight match completes', () => {
      const tournament = createTournament(sampleTeams);

      for (let id = 1; id <= 3; id++) {
        tournament.matches = updateMatchScore(tournament, id, 21, 10).matches;
      }

      const before = getDesktopSpotlightMatches(tournament.matches);
      expect(before.deferred.map((m) => m.id)).toContain(5);

      tournament.matches = updateMatchScore(tournament, 4, 21, 10).matches;

      const after = getDesktopSpotlightMatches(tournament.matches);
      expect(after.spotlight.map((m) => m.id)).toContain(5);
    });

    it('should fill spotlight with conflicting matches when no clean second match exists', () => {
      const tournament = createTournament(sampleTeams);
      const blockedQueue = tournament.matches.filter((m) => m.id >= 4 && m.id <= 7);
      const { spotlight } = getDesktopSpotlightMatches(blockedQueue);

      expect(spotlight).toHaveLength(2);
      expect(spotlight[0].id).toBe(4);
      expect(spotlight[1].id).toBe(5);
      expect(matchesShareParticipants(spotlight[0], spotlight[1])).toBe(true);
    });
  });
});

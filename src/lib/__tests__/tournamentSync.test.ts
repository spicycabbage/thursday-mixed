import { canApplyRemoteTournament, hasUnsavedScoreInput, TOURNAMENT_REFRESH_MS } from '../tournamentSync';

describe('tournament sync safety net', () => {
  it('refreshes every few seconds', () => {
    expect(TOURNAMENT_REFRESH_MS).toBeGreaterThanOrEqual(3000);
    expect(TOURNAMENT_REFRESH_MS).toBeLessThanOrEqual(10000);
  });

  it('does not apply a remote snapshot while a write is in flight or a score is being typed', () => {
    expect(canApplyRemoteTournament(0, 0)).toBe(true);
    expect(canApplyRemoteTournament(1, 0)).toBe(false);
    expect(canApplyRemoteTournament(0, 1)).toBe(false);
    expect(canApplyRemoteTournament(2, 3)).toBe(false);
  });

  it('treats draft score inputs and edit mode as unsaved, and ignores read-only cards', () => {
    expect(hasUnsavedScoreInput({
      isEditing: false,
      scoreA: '21',
      scoreB: '15',
      storedScoreA: null,
      storedScoreB: null,
    })).toBe(true);
    expect(hasUnsavedScoreInput({
      isEditing: true,
      scoreA: '21',
      scoreB: '15',
      storedScoreA: 21,
      storedScoreB: 15,
    })).toBe(true);
    expect(hasUnsavedScoreInput({
      isEditing: false,
      scoreA: '21',
      scoreB: '15',
      storedScoreA: 21,
      storedScoreB: 15,
    })).toBe(false);
    expect(hasUnsavedScoreInput({
      readOnly: true,
      isEditing: false,
      scoreA: '21',
      scoreB: '',
      storedScoreA: null,
      storedScoreB: null,
    })).toBe(false);
  });
});

export const TOURNAMENT_REFRESH_MS = 4000;
/** Safety-net poll interval while the realtime channel is delivering updates. */
export const TOURNAMENT_LIVE_REFRESH_MS = 30000;

export function canApplyRemoteTournament(pendingWrites: number, unsavedScoreCount: number): boolean {
  return pendingWrites <= 0 && unsavedScoreCount <= 0;
}

export function hasUnsavedScoreInput(options: {
  readOnly?: boolean;
  isLocked?: boolean;
  isEditing: boolean;
  scoreA: string;
  scoreB: string;
  storedScoreA: number | null | undefined;
  storedScoreB: number | null | undefined;
}): boolean {
  if (options.readOnly || options.isLocked) return false;
  const storedA = options.storedScoreA?.toString() || '';
  const storedB = options.storedScoreB?.toString() || '';
  return options.isEditing || options.scoreA !== storedA || options.scoreB !== storedB;
}

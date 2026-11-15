const ADMIN_TOURNAMENT_KEY = 'tm-admin-tournament-id';

export function markTournamentAdmin(tournamentId: string) {
  try {
    localStorage.setItem(ADMIN_TOURNAMENT_KEY, tournamentId);
  } catch {}
}

export function isTournamentAdmin(tournamentId: string) {
  try {
    return localStorage.getItem(ADMIN_TOURNAMENT_KEY) === tournamentId;
  } catch {
    return false;
  }
}

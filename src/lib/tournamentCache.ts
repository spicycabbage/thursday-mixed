import type { Tournament } from '@/lib/gameLogic';

const STORAGE_KEY = 'currentTournament';

export function readCachedTournament(id?: string): Tournament | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Tournament;
    if (!parsed?.id) return null;
    if (id && parsed.id !== id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedTournament(tournament: Tournament) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tournament));
  } catch {
    // Private mode and full storage can reject writes. The server copy still loads.
  }
}

'use client';

import { subscribeToTournament } from '@/lib/realtime/client';
import type { Tournament } from '@/lib/gameLogic';
import type { ScoreToastPayload } from '@/lib/realtime/server';

type LiveUpdateHandlers = {
  onSync: (tournament: Tournament) => void;
  onToast?: (payload: ScoreToastPayload) => void;
};

export function subscribeLiveTournament(
  tournamentId: string,
  handlers: LiveUpdateHandlers
): () => void {
  return subscribeToTournament(tournamentId, handlers);
}

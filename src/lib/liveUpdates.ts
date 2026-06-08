'use client';

import { getSocket } from '@/lib/socket';
import { isRealtimeConfigured, subscribeToTournament } from '@/lib/realtime/client';
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
  if (isRealtimeConfigured()) {
    return subscribeToTournament(tournamentId, handlers);
  }

  try {
    const socket = getSocket();
    const joinRoom = () => socket.emit('join-tournament', tournamentId);
    joinRoom();
    socket.io.on('reconnect', joinRoom);

    const onSync = (serverTournament: Tournament) => {
      if (serverTournament?.id === tournamentId) {
        handlers.onSync(serverTournament);
      }
    };
    const onToast = (payload: ScoreToastPayload) => {
      handlers.onToast?.(payload);
    };

    socket.on('tournament:sync', onSync);
    socket.on('toast:score', onToast);

    return () => {
      socket.off('tournament:sync', onSync);
      socket.off('toast:score', onToast);
      socket.io.off('reconnect', joinRoom);
    };
  } catch {
    return () => {};
  }
}

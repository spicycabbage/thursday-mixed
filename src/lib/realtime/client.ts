'use client';

import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import type { Tournament } from '@/lib/gameLogic';
import type { ScoreToastPayload } from './server';

let browserClient: RealtimeClient | null = null;

function getBrowserClient(): RealtimeClient | null {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  browserClient = new RealtimeClient(`${url.replace(/\/$/, '')}/realtime/v1`, {
    params: { apikey: key },
  });
  return browserClient;
}

export function subscribeToTournament(
  tournamentId: string,
  handlers: {
    onSync: (tournament: Tournament) => void;
    onToast?: (payload: ScoreToastPayload) => void;
  }
): () => void {
  const client = getBrowserClient();
  if (!client) return () => {};

  const channel: RealtimeChannel = client
    .channel(`tournament:${tournamentId}`, {
      config: { broadcast: { self: false } },
    })
    .on('broadcast', { event: 'tournament:sync' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        handlers.onSync(payload as Tournament);
      }
    })
    .on('broadcast', { event: 'toast:score' }, ({ payload }) => {
      if (payload && typeof payload === 'object') {
        handlers.onToast?.(payload as ScoreToastPayload);
      }
    })
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

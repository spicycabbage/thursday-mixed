'use client';

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Tournament } from '@/lib/gameLogic';
import type { ScoreToastPayload } from './server';

let browserClient: SupabaseClient | null = null;

function getBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  browserClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return browserClient;
}

export function isRealtimeConfigured(): boolean {
  return getBrowserClient() !== null;
}

export function subscribeToTournament(
  tournamentId: string,
  handlers: {
    onSync: (tournament: Tournament) => void;
    onToast?: (payload: ScoreToastPayload) => void;
  }
): () => void {
  const supabase = getBrowserClient();
  if (!supabase) return () => {};

  const channel: RealtimeChannel = supabase
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
    supabase.removeChannel(channel);
  };
}

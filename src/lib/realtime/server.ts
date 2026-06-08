import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export type ScoreToastPayload = {
  matchId: number;
  round: number;
  scoreA: number;
  scoreB: number;
  ts: number;
};

export async function broadcastTournamentUpdate(
  tournamentId: string,
  tournament: unknown,
  update?: Omit<ScoreToastPayload, 'ts'>
): Promise<void> {
  const supabase = getAdminClient();
  if (!supabase) return;

  const channel = supabase.channel(`tournament:${tournamentId}`);

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('broadcast timeout')), 5000);

      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          await channel.send({
            type: 'broadcast',
            event: 'tournament:sync',
            payload: tournament,
          });
          if (update) {
            await channel.send({
              type: 'broadcast',
              event: 'toast:score',
              payload: { ...update, ts: Date.now() },
            });
          }
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error(`channel ${status}`));
        }
      });
    });
  } catch (error) {
    console.error('Realtime broadcast failed:', error);
  } finally {
    await supabase.removeChannel(channel);
  }
}

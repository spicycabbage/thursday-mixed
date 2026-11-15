export type ScoreToastPayload = {
  matchId: number;
  round: number;
  scoreA: number;
  scoreB: number;
  ts: number;
};

type BroadcastMessage = { topic: string; event: string; payload: unknown };

function broadcastConfig(): { endpoint: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { endpoint: `${url.replace(/\/$/, '')}/realtime/v1/api/broadcast`, key };
}

export async function broadcastTournamentUpdate(
  tournamentId: string,
  tournament: unknown,
  update?: Omit<ScoreToastPayload, 'ts'>
): Promise<void> {
  const config = broadcastConfig();
  if (!config) return;

  const topic = `tournament:${tournamentId}`;
  const messages: BroadcastMessage[] = [{ topic, event: 'tournament:sync', payload: tournament }];
  if (update) {
    messages.push({ topic, event: 'toast:score', payload: { ...update, ts: Date.now() } });
  }

  try {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error('Realtime broadcast failed:', res.status, await res.text().catch(() => ''));
    }
  } catch (error) {
    console.error('Realtime broadcast failed:', error);
  }
}

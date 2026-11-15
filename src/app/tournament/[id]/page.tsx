import TournamentScreen from '@/components/TournamentScreen';
import { assembleTournament } from '@/lib/tournamentRepo';
import type { Tournament } from '@/lib/gameLogic';

async function loadTournament(id: string): Promise<Tournament | null> {
  try {
    return await assembleTournament(id);
  } catch {
    return null;
  }
}

export default async function TournamentPage({ params }: PageProps<'/tournament/[id]'>) {
  const { id } = await params;
  const tournament = await loadTournament(id);
  return (
    <TournamentScreen
      id={id}
      initialTournament={tournament ? (JSON.parse(JSON.stringify(tournament)) as Tournament) : null}
    />
  );
}

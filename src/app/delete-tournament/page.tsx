'use client';

import { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageLoading, PageShell, PageTitleBlock } from '@/components/PageShell';
import { Tournament } from '@/lib/gameLogic';

export default function DeleteTournamentPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem('tournamentHistory') || '[]');
    const current = localStorage.getItem('currentTournament');

    let allTournaments = [...history];
    if (current) {
      const currentTournament = JSON.parse(current);
      if (!history.find((t: Tournament) => t.id === currentTournament.id)) {
        allTournaments.unshift(currentTournament);
      }
    }

    allTournaments.sort(
      (a: Tournament, b: Tournament) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    setTournaments(allTournaments);
    setLoading(false);
  }, []);

  const deleteTournament = async (id: string, date: string) => {
    if (!confirm(`Are you sure you want to delete the tournament from ${date}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tournaments/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Tournament deleted successfully!');

        const history = JSON.parse(localStorage.getItem('tournamentHistory') || '[]');
        const updatedHistory = history.filter((t: Tournament) => t.id !== id);
        localStorage.setItem('tournamentHistory', JSON.stringify(updatedHistory));

        const current = localStorage.getItem('currentTournament');
        if (current) {
          const currentTournament = JSON.parse(current);
          if (currentTournament.id === id) {
            localStorage.removeItem('currentTournament');
          }
        }

        setTournaments((prev) => prev.filter((t) => t.id !== id));
      } else {
        const error = await response.json();
        alert(`Error deleting tournament: ${error.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error deleting tournament: ${message}`);
    }
  };

  if (loading) {
    return <PageLoading message="Loading tournaments..." />;
  }

  return (
    <PageShell>
      <PageCard>
        <PageHeader
          title="Tournament Manager"
          icon={<TrashIcon className="w-5 h-5" />}
        />

        <PageContent>
          <PageTitleBlock
            title="Delete Tournament"
            subtitle="Manage and delete tournaments from the database"
          />

          {tournaments.length === 0 ? (
            <div className="app-empty-state">
              <p className="text-gray-500">No tournaments found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tournaments.map((tournament) => (
                <div key={tournament.id} className="tab-card">
                  <div className="mb-3">
                    <h3 className="font-semibold text-lg text-gray-800">
                      Tournament: {tournament.date}
                    </h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>ID:</strong> {tournament.id}</p>
                      <p><strong>Finalized:</strong> {tournament.isFinalized ? 'Yes' : 'No'}</p>
                      <p><strong>Created:</strong> {new Date(tournament.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTournament(tournament.id, tournament.date)}
                    className="app-btn-danger app-btn-sm"
                  >
                    Delete This Tournament
                  </button>
                </div>
              ))}
            </div>
          )}
        </PageContent>
      </PageCard>
    </PageShell>
  );
}

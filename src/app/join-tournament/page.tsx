'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { AppLinkButton, PageCard, PageContent, PageHeader, PageShell, PageTitleBlock } from '@/components/PageShell';

export default function JoinTournamentPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const joinActiveTournament = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/tournaments/active?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to check active tournament');
      const data = await res.json();

      if (!data?.active || !data?.tournament?.id) {
        setError("There is no active tournament. Why don't you create one?");
        setLoading(false);
        return;
      }

      const tournamentId = data.tournament.id;
      const tournamentRes = await fetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}?t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (tournamentRes.ok) {
        const t = await tournamentRes.json();
        try {
          localStorage.setItem('currentTournament', JSON.stringify(t));
        } catch {}
        router.push(`/tournament/${tournamentId}`);
        return;
      }

      setError('Unable to load the active tournament.');
      setLoading(false);
    } catch {
      setError('Unable to join right now. Please try again.');
      setLoading(false);
    }
  };

  useEffect(() => {
    joinActiveTournament();
  }, []);

  return (
    <PageShell>
      <PageCard>
        <PageHeader
          title="Join Tournament"
          icon={<UserGroupIcon className="w-5 h-5" />}
        />

        <PageContent>
          <PageTitleBlock
            title="Joining Tournament"
            subtitle={loading ? 'Loading the active tournament...' : 'Connect to the current tournament'}
          />

          {error && (
            <div className="app-alert-error mb-6">
              <p className="font-semibold">Unable to join tournament</p>
              <p>{error}</p>
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3">
              <button type="button" onClick={joinActiveTournament} className="app-btn-action">
                Try Again
              </button>
            <AppLinkButton href="/create-tournament" variant="primary">
              Create New Tournament
            </AppLinkButton>
            </div>
          )}
        </PageContent>
      </PageCard>
    </PageShell>
  );
}

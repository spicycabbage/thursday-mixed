'use client';

import { useEffect, useState } from 'react';
import { AppLinkButton, PageCard, PageContent, PageShell } from '@/components/PageShell';
import AdminUnlock from '@/components/AdminUnlock';
import { markTournamentAdmin } from '@/lib/viewerRole';

export type OpenTournament = { id: string; name: string; eventType: string };

const OPEN_LIST_KEY = 'openTournaments';

function readOpenList(): OpenTournament[] | null {
  try {
    const raw = localStorage.getItem(OPEN_LIST_KEY);
    return raw ? (JSON.parse(raw) as OpenTournament[]) : null;
  } catch {
    return null;
  }
}

export default function HomeScreen({ initialOpen }: { initialOpen: OpenTournament[] }) {
  const [open, setOpen] = useState<OpenTournament[]>(initialOpen);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUnlock, setShowUnlock] = useState(false);

  useEffect(() => {
    let ignore = false;
    const savedList = readOpenList();
    if (savedList) setOpen(savedList);

    (async () => {
      try {
        const [activeRes, sessionRes] = await Promise.all([
          fetch(`/api/tournaments/active?t=${Date.now()}`, { cache: 'no-store' }),
          fetch('/api/admin/session', { cache: 'no-store' }),
        ]);

        if (!ignore && sessionRes.ok) {
          const session = await sessionRes.json();
          setIsAdmin(!!session?.admin);
        }

        if (!ignore && activeRes.ok) {
          const data = await activeRes.json();
          const list = Array.isArray(data?.tournaments)
            ? (data.tournaments as OpenTournament[])
            : data?.tournament?.id
              ? [data.tournament as OpenTournament]
              : [];
          setOpen(list);
          try {
            localStorage.setItem(OPEN_LIST_KEY, JSON.stringify(list));
          } catch {}
        }
      } catch {}
    })();

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <PageShell centered mobileOnly>
      <h1 className="lobby-app-name">GBC Tourney</h1>
      <PageCard className="w-[92%] mb-4">
        <PageContent>
          <div className="space-y-4">
            {isAdmin && (
              <AppLinkButton href="/create-tournament" variant="success">
                Create New Tournament
              </AppLinkButton>
            )}
            {open.map((tournament) => (
              <AppLinkButton key={tournament.id} href={`/tournament/${tournament.id}`} variant="success">
                {tournament.eventType} · {tournament.name.trim() || 'Open tournament'}
              </AppLinkButton>
            ))}
          </div>
        </PageContent>
      </PageCard>

      <PageCard className="w-[92%]">
        <PageContent>
          <div className="space-y-3">
            <AppLinkButton href="/tournament-results">Past Tournament Results</AppLinkButton>
            <AppLinkButton href="/analytics">Advanced Analytics</AppLinkButton>
            <AppLinkButton href="/partnership-stats">Partnership Statistics</AppLinkButton>
            {!isAdmin && !showUnlock && (
              <button type="button" onClick={() => setShowUnlock(true)} className="app-btn-action">
                Admin Only
              </button>
            )}
            {!isAdmin && showUnlock && (
              <AdminUnlock
                onUnlocked={() => {
                  setIsAdmin(true);
                  setShowUnlock(false);
                  if (open[0]) markTournamentAdmin(open[0].id);
                }}
              />
            )}
          </div>
        </PageContent>
      </PageCard>

      <p className="mt-6 text-white text-xs opacity-75 text-center">Version 1.1</p>
    </PageShell>
  );
}

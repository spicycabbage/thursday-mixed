'use client';

import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Tournament, updateMatchScore, requeueMatch, startTournament, isTournamentComplete, getTournamentRoundCount, getTeamLabel, playoffMatchLabel } from '@/lib/gameLogic';
import { subscribeLiveTournament } from '@/lib/liveUpdates';
import { readCachedTournament, writeCachedTournament } from '@/lib/tournamentCache';
import { canApplyRemoteTournament, TOURNAMENT_LIVE_REFRESH_MS, TOURNAMENT_REFRESH_MS } from '@/lib/tournamentSync';
import { PageLoading, PageShell } from '@/components/PageShell';
import TournamentHeader from '@/components/TournamentHeader';
import PlayersTab from '@/components/PlayersTab';
import PlayerListEditor from '@/components/PlayerListEditor';
import MatchesTab from '@/components/MatchesTab';
import RankTab from '@/components/RankTab';
import SpectatorView from '@/components/spectator/SpectatorView';

type TabType = 'players' | 'matches' | 'rank';

const TABLET_QUERY = '(min-width: 768px) and (min-height: 600px)';

function subscribeTabletLayout(onChange: () => void) {
  const media = window.matchMedia(TABLET_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getTabletLayoutSnapshot(): boolean | null {
  return window.matchMedia(TABLET_QUERY).matches;
}

function getTabletLayoutServerSnapshot(): boolean | null {
  return null;
}

export default function TournamentScreen({
  id,
  initialTournament,
}: {
  id: string;
  initialTournament: Tournament | null;
}) {
  const [tournament, setTournament] = useState<Tournament | null>(initialTournament);
  const [activeTab, setActiveTab] = useState<TabType>(
    initialTournament && isTournamentComplete(initialTournament) ? 'rank' : 'matches'
  );
  const [loading, setLoading] = useState(!initialTournament);
  const [toast, setToast] = useState<string | null>(null);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [starting, setStarting] = useState(false);
  const tabletLayout = useSyncExternalStore(
    subscribeTabletLayout,
    getTabletLayoutSnapshot,
    getTabletLayoutServerSnapshot,
  );
  const latestTournamentRef = useRef<Tournament | null>(null);
  const pendingWritesRef = useRef(0);
  const unsavedScoreIdsRef = useRef(new Set<number>());
  const refreshFromServerRef = useRef<() => Promise<void>>(async () => {});
  const realtimeLiveRef = useRef(false);
  const lastServerSyncRef = useRef(0);

  useEffect(() => {
    latestTournamentRef.current = tournament;
  }, [tournament]);

  const applyRemoteTournament = (serverTournament: Tournament) => {
    if (!canApplyRemoteTournament(pendingWritesRef.current, unsavedScoreIdsRef.current.size)) {
      return;
    }
    try { localStorage.setItem('currentTournament', JSON.stringify(serverTournament)); } catch {}
    writeCachedTournament(serverTournament);
    setTournament(serverTournament);
  };

  refreshFromServerRef.current = async () => {
    try {
      const res = await fetch(`/api/tournaments/${id}`, { cache: 'no-store' });
      if (!res.ok) return;
      const remote = (await res.json()) as Tournament | null;
      lastServerSyncRef.current = Date.now();
      if (remote) applyRemoteTournament(remote);
    } catch {}
  };

  const beginWrite = () => {
    pendingWritesRef.current += 1;
  };

  const endWrite = () => {
    pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
    if (canApplyRemoteTournament(pendingWritesRef.current, unsavedScoreIdsRef.current.size)) {
      void refreshFromServerRef.current();
    }
  };

  const handleUnsavedScoreChange = (matchId: number, unsaved: boolean) => {
    const ids = unsavedScoreIdsRef.current;
    const wasIdle = canApplyRemoteTournament(pendingWritesRef.current, ids.size);
    if (unsaved) ids.add(matchId);
    else ids.delete(matchId);
    const isIdle = canApplyRemoteTournament(pendingWritesRef.current, ids.size);
    if (!wasIdle && isIdle) void refreshFromServerRef.current();
  };

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void refreshFromServerRef.current();
    };
    const pollTick = () => {
      const sinceSync = Date.now() - lastServerSyncRef.current;
      if (realtimeLiveRef.current && sinceSync < TOURNAMENT_LIVE_REFRESH_MS) return;
      tick();
    };
    const interval = window.setInterval(pollTick, TOURNAMENT_REFRESH_MS);
    const onFocus = () => tick();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        if (!ignore) setIsAdmin(!!data?.admin);
      } catch {
        if (!ignore) setIsAdmin(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!showPlayersModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPlayersModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showPlayersModal]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      let parsedTournament: Tournament | null = initialTournament;

      if (parsedTournament) {
        writeCachedTournament(parsedTournament);
      } else {
        const cachedTournament = readCachedTournament(id);
        if (cachedTournament) {
          setTournament(cachedTournament);
          setLoading(false);
          if (isTournamentComplete(cachedTournament)) setActiveTab('rank');
        }

        try {
          const res = await fetch(`/api/tournaments/${id}`, { cache: 'no-store' });
          if (res.ok) {
            parsedTournament = await res.json();
            if (parsedTournament) writeCachedTournament(parsedTournament);
          }
        } catch {}

        if (!parsedTournament) parsedTournament = cachedTournament;
        if (cancelled) return;
        if (parsedTournament) setTournament(parsedTournament);
      }

      if (parsedTournament) {
        unsubscribe = subscribeLiveTournament(parsedTournament.id, {
          onSync: (serverTournament) => {
            lastServerSyncRef.current = Date.now();
            applyRemoteTournament(serverTournament);
          },
          onStatus: (live) => {
            realtimeLiveRef.current = live;
          },
          onToast: (payload) => {
            const { round, scoreA, scoreB, matchId } = payload;
            const base = latestTournamentRef.current || parsedTournament;
            let msg = `Scores updated for Round ${round}: ${scoreA}-${scoreB}`;
            try {
              const match = base?.matches.find((m) => m.id === matchId);
              if (match && base) {
                const teamA = getTeamLabel(match.teamAId);
                const teamB = getTeamLabel(match.teamBId);
                const stageLabel = playoffMatchLabel(match, base.matches);
                msg = stageLabel
                  ? `${stageLabel}: Team ${teamA} vs Team ${teamB} — ${scoreA}-${scoreB}`
                  : `Round ${round}: Team ${teamA} vs Team ${teamB} — ${scoreA}-${scoreB}`;
              }
            } catch {}
            setToast(msg);
            setTimeout(() => setToast(null), 3000);
          },
        });

        if (!initialTournament && isTournamentComplete(parsedTournament)) {
          setActiveTab('rank');
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [id, initialTournament]);

  const handleScoreUpdate = async (matchId: number, scoreA: number, scoreB: number, isEdit: boolean = false) => {
    if (!tournament || !tabletLayout) return;

    if (tournament.isFinalized) return; // guard: no updates after finalize
    beginWrite();
    const updatedTournament = updateMatchScore(tournament, matchId, scoreA, scoreB, isEdit);
    
    // CRITICAL: Save to localStorage FIRST before any UI updates
    localStorage.setItem('currentTournament', JSON.stringify(updatedTournament));
    
    // Then update the UI state
    setTournament(updatedTournament);

    // Save to database
    try {
      console.log(`Saving score: Match ${matchId}, Score ${scoreA}-${scoreB}`);
      const response = await fetch(`/api/tournaments/${tournament.id}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, scoreA, scoreB }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('API Error:', response.status, error);
      } else {
        const saved = (await response.json()) as Tournament;
        if (saved?.matches) {
          setTournament(saved);
          try { localStorage.setItem('currentTournament', JSON.stringify(saved)); } catch {}
          writeCachedTournament(saved);
        }
      }
    } catch (error) {
      console.error('Failed to save score to database:', error);
    } finally {
      endWrite();
    }

    // Only auto-advance if this is NOT an edit and we're on the matches tab
    if (!isEdit && activeTab === 'matches') {
      // Check if current round is complete
      const currentRoundMatches = updatedTournament.matches.filter(m => m.round === updatedTournament.currentRound);
      const currentRoundComplete = currentRoundMatches.every(m => m.completed);
      
      // Also check if this specific match was just completed for the first time
      const updatedMatch = updatedTournament.matches.find(m => m.id === matchId);
      const wasJustCompleted = updatedMatch?.completed && !tournament.matches.find(m => m.id === matchId)?.completed;

      if (currentRoundComplete && wasJustCompleted) {
        // Wait 1.5 seconds to show completed state, then proceed
        setTimeout(() => {
          if (updatedTournament.currentRound === getTournamentRoundCount(updatedTournament.matches) && currentRoundComplete) {
            setActiveTab('rank');
          }
        }, 1500);
      }
    }

    // Fallback: If all matches are completed, make sure we switch to Rank tab
    if (activeTab === 'matches' && isTournamentComplete(updatedTournament)) {
      setActiveTab('rank');
    }
  };

  const handleRequeue = async (matchId: number) => {
    if (!tournament || !tabletLayout || tournament.isFinalized) return;

    const previous = tournament;
    const updatedTournament = requeueMatch(tournament, matchId);
    if (updatedTournament === tournament) return;

    beginWrite();
    localStorage.setItem('currentTournament', JSON.stringify(updatedTournament));
    setTournament(updatedTournament);

    try {
      const response = await fetch(`/api/tournaments/${tournament.id}/requeue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setTournament(previous);
        localStorage.setItem('currentTournament', JSON.stringify(previous));
        alert(error?.error || 'Could not requeue the match.');
        return;
      }
      const saved = (await response.json()) as Tournament;
      setTournament(saved);
      localStorage.setItem('currentTournament', JSON.stringify(saved));
    } catch {
      setTournament(previous);
      localStorage.setItem('currentTournament', JSON.stringify(previous));
      alert('Could not requeue the match.');
    } finally {
      endWrite();
    }
  };

  const handleTeamUpdate = async (teams: { player1: string; player2: string }[]) => {
    if (!tournament) return;
    beginWrite();
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Failed to update players:', res.status, errorData);
        alert(`Failed to update players: ${errorData.error || 'Unknown error'}`);
        return;
      }
      const updated = await res.json();
      setTournament(updated);
      try { localStorage.setItem('currentTournament', JSON.stringify(updated)); } catch {}
    } catch (e) {
      console.error('Error updating players:', e);
      alert('Failed to update players. Please try again.');
    } finally {
      endWrite();
    }
  };

  const handleFinalizeTournament = async () => {
    if (!tournament) return;

    beginWrite();
    try {
      // Persist to Neon so Home active-state reflects immediately
      const res = await fetch(`/api/tournaments/${tournament.id}/finalize`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        alert(error?.error || 'Could not finalize the tournament.');
        return;
      }
      const updated = await res.json();

      setTournament(updated);
      try { localStorage.setItem('currentTournament', JSON.stringify(updated)); } catch {}

      // Save to tournament history locally
      const history = JSON.parse(localStorage.getItem('tournamentHistory') || '[]');
      history.push(updated);
      localStorage.setItem('tournamentHistory', JSON.stringify(history));
    } catch {} finally {
      endWrite();
    }
  };

  const handleStartTournament = async () => {
    if (!tournament || tournament.startedAt || tournament.isFinalized || starting) return;
    const previous = tournament;
    const optimistic = startTournament(tournament);
    setStarting(true);
    beginWrite();
    setTournament(optimistic);
    try { localStorage.setItem('currentTournament', JSON.stringify(optimistic)); } catch {}
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/start`, { method: 'POST' });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setTournament(previous);
        try { localStorage.setItem('currentTournament', JSON.stringify(previous)); } catch {}
        alert(error?.error || 'Could not start the tournament.');
        return;
      }
      const saved = (await res.json()) as Tournament;
      setTournament(saved);
      try { localStorage.setItem('currentTournament', JSON.stringify(saved)); } catch {}
      writeCachedTournament(saved);
    } catch {
      setTournament(previous);
      try { localStorage.setItem('currentTournament', JSON.stringify(previous)); } catch {}
      alert('Could not start the tournament.');
    } finally {
      setStarting(false);
      endWrite();
    }
  };

  const handleSaveCourtNumbers = async (courtNumbers: number[]) => {
    if (!tournament) return;
    beginWrite();
    try {
      const res = await fetch(`/api/tournaments/${tournament.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courtNumbers }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || 'Could not update court numbers.');
      }
      const updated = await res.json();
      setTournament(updated);
      try { localStorage.setItem('currentTournament', JSON.stringify(updated)); } catch {}
    } finally {
      endWrite();
    }
  };

  if (loading || tabletLayout === null) {
    return <PageLoading message="Loading tournament..." className="page-shell-tournament" />;
  }

  if (!tournament) {
    return (
      <PageShell centered className="page-shell-tournament">
        <div className="text-white text-xl text-center px-6">
          <p>Tournament not found</p>
          <Link href="/" className="text-blue-200 underline mt-4 block">
            Return to Home
          </Link>
        </div>
      </PageShell>
    );
  }

  const isPlayersEditable = !tournament.matches.some((m) => m.completed);
  const playersEditTitle = tournament.isFinalized
    ? 'Tournament finalized'
    : !isPlayersEditable
      ? 'Teams locked after first score'
      : 'Edit players';

  if (!tabletLayout) {
    return (
      <PageShell className="page-shell-tournament page-shell-spectator relative !min-h-0">
        <div className="tournament-shell">
          <SpectatorView tournament={tournament} />
        </div>
        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-black text-white px-4 py-2 rounded-lg text-sm shadow-lg animate-fade-in-out">
            {toast}
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell className="page-shell-tournament relative !min-h-0">
      <div className="tournament-shell">
        <TournamentHeader
          date={tournament.date}
          name={tournament.name}
          eventType={tournament.eventType}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onEditPlayers={() => setShowPlayersModal(true)}
          editPlayersTitle={playersEditTitle}
        />

        <div className="tournament-tab-scroll">
          <div className="tournament-tab-stack">
            <div
              className={`tournament-tab-pane tournament-tab-pane-players ${
                activeTab === 'players' ? 'tournament-tab-pane-active' : 'tournament-tab-pane-inactive'
              }`}
            >
              <PlayersTab
                tournament={tournament}
                onUpdateTeams={handleTeamUpdate}
                isFinalized={tournament.isFinalized}
                isEditable={!tournament.matches.some((m) => m.completed)}
              />
            </div>

            <div
              className={`tournament-tab-pane tournament-tab-pane-matches ${
                activeTab === 'matches' ? 'tournament-tab-pane-active' : 'tournament-tab-pane-inactive'
              }`}
            >
              <MatchesTab
                tournament={tournament}
                onScoreUpdate={handleScoreUpdate}
                onRequeue={handleRequeue}
                onFinalize={handleFinalizeTournament}
                onUnsavedScoreChange={handleUnsavedScoreChange}
                onStart={!tournament.startedAt && !tournament.isFinalized ? handleStartTournament : undefined}
                startDisabled={starting}
              />
            </div>

            <div
              className={`tournament-tab-pane tournament-tab-pane-rank ${
                activeTab === 'rank' ? 'tournament-tab-pane-active' : 'tournament-tab-pane-inactive'
              }`}
            >
              <RankTab
                tournament={tournament}
                onFinalize={handleFinalizeTournament}
              />
            </div>
          </div>
        </div>
      </div>

      {showPlayersModal && (
        <div
          className="player-edit-modal-backdrop"
          role="presentation"
          onClick={() => setShowPlayersModal(false)}
        >
          <div
            className="player-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-edit-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="player-edit-modal-header">
              <h3 id="player-edit-modal-title" className="player-edit-modal-title">
                Players
              </h3>
              <button
                type="button"
                onClick={() => setShowPlayersModal(false)}
                className="player-edit-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="player-edit-modal-body">
              <PlayerListEditor
                tournament={tournament}
                onUpdateTeams={handleTeamUpdate}
                isFinalized={tournament.isFinalized}
                isEditable={isPlayersEditable}
                layout="desktop"
                autoEdit={isPlayersEditable && !tournament.isFinalized}
                onClose={() => setShowPlayersModal(false)}
                canEditCourts={isAdmin}
                onSaveCourtNumbers={handleSaveCourtNumbers}
              />
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-6 bg-black text-white px-4 py-2 rounded-lg text-sm shadow-lg animate-fade-in-out">
          {toast}
        </div>
      )}
    </PageShell>
  );
}

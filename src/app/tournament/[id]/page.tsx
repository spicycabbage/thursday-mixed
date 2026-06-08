'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Tournament, updateMatchScore, isTournamentComplete, NUM_ROUNDS, getTeamLabel } from '@/lib/gameLogic';
import { subscribeLiveTournament } from '@/lib/liveUpdates';
import { PageLoading, PageShell } from '@/components/PageShell';
import TournamentHeader from '@/components/TournamentHeader';
import PlayersTab from '@/components/PlayersTab';
import PlayerListEditor from '@/components/PlayerListEditor';
import MatchesTab from '@/components/MatchesTab';
import RankTab from '@/components/RankTab';

type TabType = 'players' | 'matches' | 'rank';

export default function TournamentPage() {
  const params = useParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('matches');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [showPlayersModal, setShowPlayersModal] = useState(false);
  const latestTournamentRef = useRef<Tournament | null>(null);

  useEffect(() => {
    latestTournamentRef.current = tournament;
  }, [tournament]);

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
      const id = (params as { id?: string })?.id;
      if (!id) {
        setLoading(false);
        return;
      }

      let parsedTournament: Tournament | null = null;
      try {
        const res = await fetch(`/api/tournaments/${id}`, { cache: 'no-store' });
        if (res.ok) {
          parsedTournament = await res.json();
          try {
            localStorage.setItem('currentTournament', JSON.stringify(parsedTournament));
          } catch {}
        }
      } catch {}

      if (!parsedTournament) {
        const storedTournament = localStorage.getItem('currentTournament');
        if (storedTournament) parsedTournament = JSON.parse(storedTournament);
      }

      if (cancelled) return;

      if (parsedTournament) {
        setTournament(parsedTournament);
        unsubscribe = subscribeLiveTournament(parsedTournament.id, {
          onSync: (serverTournament) => {
            localStorage.setItem('currentTournament', JSON.stringify(serverTournament));
            setTournament(serverTournament);
          },
          onToast: (payload) => {
            const { round, scoreA, scoreB, matchId } = payload;
            const base = latestTournamentRef.current || parsedTournament;
            let msg = `Scores updated for Round ${round}: ${scoreA}-${scoreB}`;
            try {
              const match = base?.matches.find((m) => m.id === matchId);
              if (match) {
                const teamA = getTeamLabel(match.teamAId);
                const teamB = getTeamLabel(match.teamBId);
                msg = `Round ${round}: Team ${teamA} vs Team ${teamB} — ${scoreA}-${scoreB}`;
              }
            } catch {}
            setToast(msg);
            setTimeout(() => setToast(null), 3000);
          },
        });

        if (isTournamentComplete(parsedTournament)) {
          setActiveTab('rank');
        }
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [params]);

  const handleScoreUpdate = async (matchId: number, scoreA: number, scoreB: number, isEdit: boolean = false) => {
    if (!tournament) return;

    if (tournament.isFinalized) return; // guard: no updates after finalize
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
        console.log('Score saved successfully');
      }
    } catch (error) {
      console.error('Failed to save score to database:', error);
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
          // Force another save to be absolutely sure
          localStorage.setItem('currentTournament', JSON.stringify(updatedTournament));
          
          if (updatedTournament.currentRound === NUM_ROUNDS && currentRoundComplete) {
            // Tournament complete - go to rank tab
            setActiveTab('rank');
          } else {
            // Move to next round - the tournament state already updated currentRound
            // Force re-render by updating the tournament state
            setTournament({...updatedTournament});
          }
        }, 1500);
      }
    }

    // Fallback: If all matches are completed, make sure we switch to Rank tab
    if (activeTab === 'matches' && isTournamentComplete(updatedTournament)) {
      setActiveTab('rank');
    }
  };

  const handleTeamUpdate = async (teams: { player1: string; player2: string }[]) => {
    if (!tournament) return;
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
    }
  };

  const handleFinalizeTournament = async () => {
    if (!tournament) return;

    try {
      // Persist to Neon so Home active-state reflects immediately
      const res = await fetch(`/api/tournaments/${tournament.id}/finalize`, { method: 'POST' });
      const updated = res.ok ? await res.json() : { ...tournament, isFinalized: true };

      setTournament(updated);
      try { localStorage.setItem('currentTournament', JSON.stringify(updated)); } catch {}

      // Save to tournament history locally
      const history = JSON.parse(localStorage.getItem('tournamentHistory') || '[]');
      history.push(updated);
      localStorage.setItem('tournamentHistory', JSON.stringify(history));
    } catch {}
  };

  if (loading) {
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

  return (
    <PageShell className="page-shell-tournament relative !min-h-0">
      <div className="tournament-shell">
        <TournamentHeader
          date={tournament.date}
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
                onFinalize={handleFinalizeTournament}
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

'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Tournament, getRankedTeams, isTournamentComplete } from '@/lib/gameLogic';
import { TrophyIcon } from '@heroicons/react/24/outline';
import TeamStandingsPanel from '@/components/TeamStandingsPanel';
import MatchCard from '@/components/matches/MatchCard';
import WinnerCelebrationSpotlight from '@/components/matches/WinnerCelebrationSpotlight';

interface MatchesDesktopLayoutProps {
  tournament: Tournament;
  onScoreUpdate: (matchId: number, scoreA: number, scoreB: number, isEdit?: boolean) => void;
  onFinalize?: () => void;
}

export default function MatchesDesktopLayout({
  tournament,
  onScoreUpdate,
  onFinalize,
}: MatchesDesktopLayoutProps) {
  const [modalMatchId, setModalMatchId] = useState<number | null>(null);
  const miniCarouselRef = useRef<HTMLDivElement>(null);

  const tournamentComplete = isTournamentComplete(tournament);
  const winners = useMemo(
    () => getRankedTeams(tournament).filter((team) => team.rank === 1),
    [tournament]
  );

  const sortedMatches = useMemo(
    () => [...tournament.matches].sort((a, b) => a.id - b.id),
    [tournament.matches]
  );

  const completedCount = useMemo(
    () => sortedMatches.filter((m) => m.completed).length,
    [sortedMatches]
  );

  const incompleteMatches = useMemo(
    () => sortedMatches.filter((m) => !m.completed),
    [sortedMatches]
  );

  const spotlightMatches = useMemo(() => incompleteMatches.slice(0, 2), [incompleteMatches]);

  const spotlightIds = useMemo(
    () => new Set(spotlightMatches.map((m) => m.id)),
    [spotlightMatches]
  );

  const nextQueueMatchId = incompleteMatches[2]?.id;

  const minimizedMatches = useMemo(
    () => sortedMatches.filter((m) => !spotlightIds.has(m.id)),
    [sortedMatches, spotlightIds]
  );

  const modalMatch = useMemo(
    () => (modalMatchId ? tournament.matches.find((m) => m.id === modalMatchId) ?? null : null),
    [modalMatchId, tournament.matches]
  );

  const scrollMiniToMatch = (matchId: number) => {
    const el = miniCarouselRef.current?.querySelector(`[data-match-id="${matchId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  useEffect(() => {
    if (spotlightMatches[0]) scrollMiniToMatch(spotlightMatches[0].id);
  }, [spotlightMatches[0]?.id]);

  const handleModalScoreUpdate = useCallback(
    (matchId: number, scoreA: number, scoreB: number, isEdit?: boolean) => {
      onScoreUpdate(matchId, scoreA, scoreB, isEdit);
      setModalMatchId(null);
    },
    [onScoreUpdate]
  );

  useEffect(() => {
    if (!modalMatchId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalMatchId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMatchId]);

  const progressLabel =
    completedCount === 15
      ? '15/15 complete'
      : spotlightMatches[0]
        ? `Match ${spotlightMatches[0].id} of 15`
        : `${completedCount}/15 complete`;

  return (
    <div className="matches-desktop-layout">
      <div className="matches-desktop-main">
        <div className="matches-desktop-header">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-gray-900 shrink-0" />
            <h3 className="text-lg font-bold text-gray-900">Matches</h3>
          </div>
          <span className="tab-meta">{progressLabel}</span>
        </div>

        <div className="matches-desktop-spotlight">
          {tournamentComplete && winners.length > 0 ? (
            <WinnerCelebrationSpotlight tournament={tournament} winners={winners} />
          ) : (
            <div className="matches-spotlight-grid">
              {spotlightMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  tournament={tournament}
                  onScoreUpdate={onScoreUpdate}
                  variant="spotlight"
                  labelMode="sequential"
                />
              ))}
            </div>
          )}
        </div>

        <div className="matches-desktop-minimized">
          <div className="matches-minimized-header">
            <h4 className="matches-minimized-title">All Matches</h4>
            <span className="matches-minimized-count">
              {tournamentComplete ? '15 complete' : `${minimizedMatches.length} remaining`}
            </span>
          </div>
          <div className="matches-mini-carousel" ref={miniCarouselRef}>
            {minimizedMatches.map((match) => (
              <div key={match.id} data-match-id={match.id} className="match-mini-wrap">
                <MatchCard
                  match={match}
                  tournament={tournament}
                  onScoreUpdate={onScoreUpdate}
                  variant="mini"
                  labelMode="sequential"
                  nextMatchId={nextQueueMatchId}
                  onSelect={() => setModalMatchId(match.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="matches-desktop-sidebar">
        <TeamStandingsPanel tournament={tournament} onFinalize={onFinalize} />
      </aside>

      {modalMatch && (
        <div
          className="match-edit-modal-backdrop"
          role="presentation"
          onClick={() => setModalMatchId(null)}
        >
          <div
            className="match-edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-edit-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="match-edit-modal-header">
              <h3 id="match-edit-modal-title" className="match-edit-modal-title">
                Match {modalMatch.id}
              </h3>
              <button
                type="button"
                onClick={() => setModalMatchId(null)}
                className="match-edit-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="match-edit-modal-body">
              <MatchCard
                match={modalMatch}
                tournament={tournament}
                onScoreUpdate={handleModalScoreUpdate}
                variant="default"
                labelMode="sequential"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
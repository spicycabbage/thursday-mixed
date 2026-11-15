'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Tournament,
  getDesktopSpotlightMatches,
  getRankedTeams,
  isTournamentComplete,
} from '@/lib/gameLogic';
import TeamStandingsPanel from '@/components/TeamStandingsPanel';
import MatchCard from '@/components/matches/MatchCard';
import WinnerCelebrationSpotlight from '@/components/matches/WinnerCelebrationSpotlight';
import TeamSummaryModal from '@/components/matches/TeamSummaryModal';

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
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [modalMatchId, setModalMatchId] = useState<number | null>(null);
  const miniCarouselRef = useRef<HTMLDivElement>(null);

  const tournamentComplete = isTournamentComplete(tournament);
  const podium = useMemo(
    () => getRankedTeams(tournament).filter((team) => team.rank <= 3),
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

  const { spotlight: spotlightMatches, deferred: deferredMatches } = useMemo(
    () => getDesktopSpotlightMatches(sortedMatches),
    [sortedMatches]
  );

  const completedMatches = useMemo(
    () => sortedMatches.filter((match) => match.completed),
    [sortedMatches]
  );

  const modalMatch = useMemo(
    () => (modalMatchId ? tournament.matches.find((match) => match.id === modalMatchId) ?? null : null),
    [modalMatchId, tournament.matches]
  );

  const handleModalScoreUpdate = useCallback(
    (matchId: number, scoreA: number, scoreB: number, isEdit?: boolean) => {
      onScoreUpdate(matchId, scoreA, scoreB, isEdit);
      setModalMatchId(null);
    },
    [onScoreUpdate]
  );

  useEffect(() => {
    if (miniCarouselRef.current) miniCarouselRef.current.scrollLeft = 0;
  }, [deferredMatches[0]?.id]);

  useEffect(() => {
    if (!modalMatchId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalMatchId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMatchId]);

  const totalMatches = sortedMatches.length;
  const progressLabel =
    completedCount === totalMatches
      ? `${totalMatches}/${totalMatches} complete`
      : spotlightMatches[0]
        ? `Match ${spotlightMatches[0].id} of ${totalMatches}`
        : `${completedCount}/${totalMatches} complete`;

  return (
    <div className="matches-desktop-layout">
      <div className="matches-desktop-main">
        <div className="matches-playing-now">
          <div className="matches-desktop-header">
            <h3 className="text-lg font-bold text-gray-900">Playing Now</h3>
            <span className="tab-meta">{progressLabel}</span>
          </div>

          <div className="matches-desktop-spotlight">
            {tournamentComplete && podium.length > 0 ? (
              <WinnerCelebrationSpotlight tournament={tournament} podium={podium} />
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
        </div>

        <div className="matches-desktop-minimized">
          <div className="matches-queue-row">
            <div className="matches-minimized-header">
              <h4 className="matches-minimized-title">Next in Queue</h4>
              <span className="matches-minimized-count">
                {tournamentComplete ? 'No more matches' : `${deferredMatches.length} left`}
              </span>
            </div>
            {deferredMatches.length > 0 && (
              <div className="matches-mini-carousel" ref={miniCarouselRef}>
                {deferredMatches.map((match) => (
                  <div key={match.id} data-match-id={match.id} className="match-mini-wrap">
                    <MatchCard
                      match={match}
                      tournament={tournament}
                      onScoreUpdate={onScoreUpdate}
                      variant="mini"
                      roster
                      labelMode="sequential"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="matches-completed-row">
            <div className="matches-minimized-header">
              <h4 className="matches-minimized-title">Completed Matches</h4>
              <span className="matches-minimized-count">{completedMatches.length}</span>
            </div>
            {completedMatches.length > 0 && (
              <div className="matches-completed-grid">
                {completedMatches.map((match) => (
                  <div key={match.id} data-match-id={match.id} className="match-mini-wrap">
                    <MatchCard
                      match={match}
                      tournament={tournament}
                      onScoreUpdate={onScoreUpdate}
                      variant="mini"
                      roster
                      labelMode="sequential"
                      onSelect={() => setModalMatchId(match.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="matches-desktop-sidebar">
        <TeamStandingsPanel
          tournament={tournament}
          onFinalize={onFinalize}
          onTeamSelect={setSelectedTeamId}
        />
      </aside>

      <TeamSummaryModal
        tournament={tournament}
        teamId={selectedTeamId}
        onClose={() => setSelectedTeamId(null)}
      />

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
            onClick={(event) => event.stopPropagation()}
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
                initialEditing
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
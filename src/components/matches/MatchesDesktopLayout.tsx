'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Tournament,
  Team,
  getDesktopSpotlightMatches,
  orderPlayingNow,
  buildQueueCards,
  queuePlaceLabel,
  restingCourts,
  getCourtNumbers,
  type QueueCard,
  courtCountForTeams,
  getRankedTeams,
  isTournamentComplete,
  playingNowTitle,
} from '@/lib/gameLogic';
import TeamStandingsPanel from '@/components/TeamStandingsPanel';
import MatchCard from '@/components/matches/MatchCard';
import RestingCourtCard from '@/components/matches/RestingCourtCard';
import WinnerCelebrationSpotlight from '@/components/matches/WinnerCelebrationSpotlight';
import TeamSummaryModal from '@/components/matches/TeamSummaryModal';
import QueueExplainModal from '@/components/matches/QueueExplainModal';

interface MatchesDesktopLayoutProps {
  tournament: Tournament;
  onScoreUpdate: (matchId: number, scoreA: number, scoreB: number, isEdit?: boolean) => void;
  onRequeue?: (matchId: number) => void;
  onFinalize?: () => void;
  onUnsavedScoreChange?: (matchId: number, unsaved: boolean) => void;
  onStart?: () => void;
  startDisabled?: boolean;
}

export default function MatchesDesktopLayout({
  tournament,
  onScoreUpdate,
  onRequeue,
  onFinalize,
  onUnsavedScoreChange,
  onStart,
  startDisabled = false,
}: MatchesDesktopLayoutProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [modalMatchId, setModalMatchId] = useState<number | null>(null);
  const [queueCard, setQueueCard] = useState<QueueCard | null>(null);
  const miniCarouselRef = useRef<HTMLDivElement>(null);

  const tournamentComplete = isTournamentComplete(tournament);
  const podium = useMemo(
    () =>
      getRankedTeams(tournament).filter(
        (team): team is Team & { rank: number } => team.rank != null && team.rank <= 3
      ),
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

  const courtCount = courtCountForTeams(tournament.teams.length);
  const { spotlight: spotlightMatches, deferred: deferredMatches } = useMemo(
    () => getDesktopSpotlightMatches(sortedMatches, courtCount),
    [sortedMatches, courtCount]
  );
  const playingNow = useMemo(() => orderPlayingNow(spotlightMatches), [spotlightMatches]);
  const openCourts = useMemo(
    () => restingCourts(tournament.matches, getCourtNumbers(tournament)),
    [tournament]
  );
  const queueCards = useMemo(
    () => buildQueueCards(tournament.matches, deferredMatches, courtCount),
    [tournament.matches, deferredMatches, courtCount]
  );

  const completedMatches = useMemo(
    () =>
      sortedMatches
        .filter((match) => match.completed)
        .sort((a, b) => (a.matchNumber ?? a.id) - (b.matchNumber ?? b.id)),
    [sortedMatches]
  );

  const modalMatch = useMemo(
    () => (modalMatchId ? tournament.matches.find((match) => match.id === modalMatchId) ?? null : null),
    [modalMatchId, tournament.matches]
  );

  const requestRequeue = useCallback(
    (matchId: number) => {
      if (!onRequeue || tournament.isFinalized) return;
      const matchNumber = tournament.matches.find((match) => match.id === matchId)?.matchNumber;
      const confirmed = window.confirm(
        `Requeue ${matchNumber ? `Match ${matchNumber}` : 'this match'}? The score will be cleared and it will go to the end of the queue.`
      );
      if (!confirmed) return;
      onRequeue(matchId);
      setModalMatchId(null);
    },
    [onRequeue, tournament.isFinalized, tournament.matches]
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
  }, [queueCards[0]?.match.id]);

  useEffect(() => {
    if (!modalMatchId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModalMatchId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalMatchId]);

  const totalMatches = sortedMatches.length;
  const latestNumber = sortedMatches.reduce((max, match) => Math.max(max, match.matchNumber ?? 0), 0);
  const progressLabel =
    completedCount === totalMatches
      ? `${totalMatches}/${totalMatches} complete`
      : latestNumber > 0
        ? `Match ${latestNumber} of ${totalMatches}`
        : `${completedCount}/${totalMatches} complete`;

  return (
    <div className="matches-desktop-layout">
      <div className="matches-desktop-main">
        <div className="matches-playing-now">
          {onStart && (
            <div className="playing-now-start">
              <button type="button" className="tournament-start-btn" onClick={onStart} disabled={startDisabled}>
                {startDisabled ? 'Starting...' : 'Start'}
              </button>
            </div>
          )}
          <div className="matches-desktop-header">
            <h3 className="text-lg font-bold text-gray-900">{playingNowTitle(tournament.matches)}</h3>
            <span className="tab-meta">{progressLabel}</span>
          </div>

          <div className="matches-desktop-spotlight">
            {tournamentComplete && podium.length > 0 ? (
              <WinnerCelebrationSpotlight tournament={tournament} podium={podium} />
            ) : (
              <div className={`matches-spotlight-grid${courtCount >= 3 ? ' matches-spotlight-grid-3' : ''}`}>
                {playingNow.map((match) => (
                  <MatchCard
                    onUnsavedScoreChange={onUnsavedScoreChange}
                    key={match.id}
                    match={match}
                    tournament={tournament}
                    onScoreUpdate={onScoreUpdate}
                    variant="spotlight"
                    labelMode="sequential"
                  />
                ))}
                {openCourts.map((court) => (
                  <RestingCourtCard key={court.court} tournament={tournament} court={court} />
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
            {queueCards.length > 0 && (
              <div className="matches-mini-carousel" ref={miniCarouselRef}>
                {queueCards.map((card) => (
                  <div key={card.match.id} data-match-id={card.match.id} className="match-mini-wrap">
                    <MatchCard
                      onUnsavedScoreChange={onUnsavedScoreChange}
                      match={card.match}
                      tournament={tournament}
                      onScoreUpdate={onScoreUpdate}
                      variant="mini"
                      roster
                      labelMode="sequential"
                      queueLabel={queuePlaceLabel(card.place)}
                      onSelect={() => setQueueCard(card)}
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
                    onUnsavedScoreChange={onUnsavedScoreChange}
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

      {queueCard && (
        <QueueExplainModal card={queueCard} tournament={tournament} onClose={() => setQueueCard(null)} />
      )}

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
                {modalMatch.matchNumber ? `Match ${modalMatch.matchNumber}` : 'Match'}
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
                    onUnsavedScoreChange={onUnsavedScoreChange}
                match={modalMatch}
                tournament={tournament}
                onScoreUpdate={handleModalScoreUpdate}
                variant="default"
                labelMode="sequential"
                initialEditing
                onRequeue={requestRequeue}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
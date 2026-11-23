'use client';

import { useEffect } from 'react';
import { Tournament, formatSideNames, getTeamMatchSummaries, isSinglesEvent } from '@/lib/gameLogic';

interface TeamSummaryModalProps {
  tournament: Tournament;
  teamId: number | null;
  onClose: () => void;
}

export default function TeamSummaryModal({
  tournament,
  teamId,
  onClose,
}: TeamSummaryModalProps) {
  const team = teamId ? tournament.teams.find((t) => t.id === teamId) ?? null : null;
  const summaries = teamId ? getTeamMatchSummaries(tournament, teamId) : [];

  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  const opponentNames = (opponentTeamId: number) => {
    const opponent = tournament.teams.find((entry) => entry.id === opponentTeamId);
    if (!opponent) return 'Unknown';
    return formatSideNames(getPlayerName(opponent.player1Id), getPlayerName(opponent.player2Id));
  };

  useEffect(() => {
    if (!teamId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [teamId, onClose]);

  if (!team) return null;

  return (
    <div
      className="match-edit-modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="team-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-summary-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="match-edit-modal-header">
          <div className="min-w-0">
            <h3 id="team-summary-modal-title" className="match-edit-modal-title">
              {isSinglesEvent(tournament.eventType) ? 'Player' : 'Team'} {team.label}
            </h3>
            <p className="team-summary-modal-players">
              {formatSideNames(getPlayerName(team.player1Id), getPlayerName(team.player2Id))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="match-edit-modal-close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="team-summary-modal-stats">
          <span>
            {team.wins}-{team.losses}
          </span>
          <span>
            {team.pointDiff > 0 ? '+' : ''}
            {team.pointDiff} pts
          </span>
        </div>
        <div className="team-summary-modal-body">
          <h4 className="team-summary-modal-subtitle">Match schedule</h4>
          <ul className="team-summary-match-list">
            {summaries.map((summary) => (
              <li
                key={summary.matchId}
                className={`team-summary-match-row ${
                  summary.completed
                    ? summary.won
                      ? 'team-summary-match-win'
                      : 'team-summary-match-loss'
                    : 'team-summary-match-pending'
                }`}
              >
                <div className="team-summary-match-main">
                  <span className="team-summary-match-id">#{summary.matchId}</span>
                  <span className="team-summary-match-opponent">
                    vs {opponentNames(summary.opponentTeamId)}
                  </span>
                </div>
                <div className="team-summary-match-result">
                  {summary.completed && summary.teamScore != null && summary.opponentScore != null ? (
                    <>
                      <span className="team-summary-match-score">
                        {summary.teamScore}-{summary.opponentScore}
                      </span>
                      <span className="team-summary-match-outcome">
                        {summary.won ? 'W' : 'L'}
                      </span>
                    </>
                  ) : (
                    <span className="team-summary-match-pending-label">Pending</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

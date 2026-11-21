'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Tournament, Match, validateScore, getTeamLabel, formatCourtLabel } from '@/lib/gameLogic';
import { hasUnsavedScoreInput } from '@/lib/tournamentSync';

export type MatchCardVariant = 'default' | 'spotlight' | 'mini';
export type MatchCardLabelMode = 'round' | 'sequential';

interface MatchCardProps {
  match: Match;
  tournament: Tournament;
  onScoreUpdate: (matchId: number, scoreA: number, scoreB: number, isEdit?: boolean) => void;
  variant?: MatchCardVariant;
  labelMode?: MatchCardLabelMode;
  onSelect?: () => void;
  onRequeue?: (matchId: number) => void;
  nextMatchId?: number;
  roster?: boolean;
  initialEditing?: boolean;
  readOnly?: boolean;
  onUnsavedScoreChange?: (matchId: number, unsaved: boolean) => void;
}

export default function MatchCard({
  match,
  tournament,
  onScoreUpdate,
  variant = 'default',
  labelMode = 'round',
  onSelect,
  onRequeue,
  nextMatchId,
  roster = false,
  initialEditing = false,
  readOnly = false,
  onUnsavedScoreChange,
}: MatchCardProps) {
  const [scoreA, setScoreA] = useState(match.scoreA?.toString() || '');
  const [scoreB, setScoreB] = useState(match.scoreB?.toString() || '');
  const [showValidation, setShowValidation] = useState(false);
  const [isEditing, setIsEditing] = useState(
    initialEditing && match.completed && !tournament.isFinalized
  );
  const isLocked = tournament.isFinalized;

  useEffect(() => {
    if (!isEditing) {
      setScoreA(match.scoreA?.toString() || '');
      setScoreB(match.scoreB?.toString() || '');
    }
  }, [match.scoreA, match.scoreB, isEditing]);

  const unsaved = hasUnsavedScoreInput({
    readOnly,
    isLocked: tournament.isFinalized,
    isEditing,
    scoreA,
    scoreB,
    storedScoreA: match.scoreA,
    storedScoreB: match.scoreB,
  });
  const onUnsavedScoreChangeRef = useRef(onUnsavedScoreChange);
  onUnsavedScoreChangeRef.current = onUnsavedScoreChange;

  useEffect(() => {
    onUnsavedScoreChangeRef.current?.(match.id, unsaved);
  }, [match.id, unsaved]);

  useEffect(() => {
    const matchId = match.id;
    return () => onUnsavedScoreChangeRef.current?.(matchId, false);
  }, [match.id]);

  const getPlayerName = useCallback(
    (playerId: number) => tournament.players.find((p) => p.id === playerId)?.name || `P${playerId}`,
    [tournament.players]
  );

  const handleSubmit = useCallback(() => {
    const numScoreA = parseInt(scoreA) || 0;
    const numScoreB = parseInt(scoreB) || 0;
    if (!validateScore(numScoreA, numScoreB)) {
      setShowValidation(true);
      setTimeout(() => setShowValidation(false), 3000);
      return;
    }
    onScoreUpdate(match.id, numScoreA, numScoreB, match.completed || isEditing);
    setIsEditing(false);
  }, [scoreA, scoreB, match.id, match.completed, onScoreUpdate, isEditing]);

  const isValid = useMemo(() => {
    const numScoreA = parseInt(scoreA) || 0;
    const numScoreB = parseInt(scoreB) || 0;
    return validateScore(numScoreA, numScoreB);
  }, [scoreA, scoreB]);

  const teamALabel = getTeamLabel(match.teamAId);
  const teamBLabel = getTeamLabel(match.teamBId);
  const isCompleted = match.completed;

  if (variant === 'mini' && roster) {
    const statusClass = isCompleted ? 'match-mini-completed' : 'match-mini-future';

    const matchLabel =
      labelMode === 'sequential' ? `Match ${match.id}` : `Round ${match.round}`;

    const side = (
      label: string,
      labelClass: string,
      player1: number,
      player2: number,
      score: number | null
    ) => (
      <div className="match-mini-side">
        <span className={`match-mini-badge ${labelClass}`}>{label}</span>
        <span className="match-mini-names">
          {getPlayerName(player1)} & {getPlayerName(player2)}
        </span>
        {score != null && <span className="match-mini-score">{score}</span>}
      </div>
    );

    const body = (
      <>
        <div className="match-mini-top">
          <span className="match-mini-round">{matchLabel}</span>
        </div>
        {side(
          teamALabel,
          'match-mini-team-a',
          match.teamA.player1,
          match.teamA.player2,
          isCompleted ? match.scoreA : null
        )}
        {side(
          teamBLabel,
          'match-mini-team-b',
          match.teamB.player1,
          match.teamB.player2,
          isCompleted ? match.scoreB : null
        )}
      </>
    );

    if (!onSelect) {
      return (
        <div className={`match-mini-card ${statusClass}`}>
          {body}
        </div>
      );
    }

    return (
      <div className={`match-mini-card ${statusClass}`}>
        <button type="button" onClick={onSelect} className="match-mini-open">
          {body}
        </button>
      </div>
    );
  }

  if (variant === 'mini') {
    const scoreText =
      isCompleted && match.scoreA != null && match.scoreB != null
        ? `${match.scoreA}-${match.scoreB}`
        : '—';
    const isUpNext = !isCompleted && match.id === nextMatchId;
    const statusClass = isCompleted
      ? 'match-mini-completed'
      : isUpNext
        ? 'match-mini-active'
        : 'match-mini-future';
    const matchLabel = labelMode === 'sequential' ? `#${match.id}` : `R${match.round}`;
    const miniCourtLabel = formatCourtLabel(match.court, true);
    const body = (
      <>
        <div className="match-mini-top">
          <span className="match-mini-round">{matchLabel}</span>
          {miniCourtLabel ? <span className="match-mini-court">{miniCourtLabel}</span> : null}
        </div>
        <div className="match-mini-teams">
          <span className="match-mini-team-a">{teamALabel}</span>
          <span className="match-mini-vs">vs</span>
          <span className="match-mini-team-b">{teamBLabel}</span>
        </div>
        <div className="match-mini-score">
          {isCompleted ? `✓ ${scoreText}` : isUpNext ? 'Up next' : 'Waiting'}
        </div>
      </>
    );

    if (!onSelect) {
      return <div className={`match-mini-card ${statusClass}`}>{body}</div>;
    }

    return (
      <button type="button" onClick={onSelect} className={`match-mini-card ${statusClass}`}>
        {body}
      </button>
    );
  }

  const isSpotlight = variant === 'spotlight';
  const containerClass = [
    'tab-card',
    isCompleted ? 'tab-card-completed' : '',
    isSpotlight ? 'match-card-spotlight' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const renderScore = (value: string, onChange: (v: string) => void, display?: number | null) => {
    const showInput = !readOnly && !isLocked && (!isCompleted || isEditing);
    return (
      <div className={isSpotlight ? 'tab-score-slot match-score-slot-spotlight' : 'tab-score-slot'}>
        {showInput ? (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={isSpotlight ? 'tab-score-input match-score-input-spotlight' : 'tab-score-input'}
            min="0"
            max="30"
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            disabled={isLocked}
          />
        ) : (
          <span className={isSpotlight ? 'match-score-display-spotlight' : 'tab-score-display'}>
            {display ?? '-'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={containerClass}>
      <p className={isSpotlight ? 'match-caption-spotlight' : 'tab-caption mb-3'}>
        {(() => {
          const courtLabel = formatCourtLabel(match.court);
          if (labelMode === 'sequential') {
            return courtLabel ? `Match ${match.id} · ${courtLabel}` : `Match ${match.id}`;
          }
          return courtLabel ? `Round ${match.round} · ${courtLabel}` : `Round ${match.round}`;
        })()}
      </p>

      <div className="space-y-2">
        <div className={`tab-entry-row tab-entry-row-a ${isSpotlight ? 'match-entry-spotlight' : ''}`}>
          <div className={`team-badge team-badge-a ${isSpotlight ? 'match-badge-spotlight' : ''}`}>
            {teamALabel}
          </div>
          <div className="flex-1 min-w-0 tab-player-names !mt-0">
            <div>{getPlayerName(match.teamA.player1)}</div>
            <div>{getPlayerName(match.teamA.player2)}</div>
          </div>
          {renderScore(scoreA, setScoreA, match.scoreA)}
        </div>

        <div className={`tab-entry-row tab-entry-row-b ${isSpotlight ? 'match-entry-spotlight' : ''}`}>
          <div className={`team-badge team-badge-b ${isSpotlight ? 'match-badge-spotlight' : ''}`}>
            {teamBLabel}
          </div>
          <div className="flex-1 min-w-0 tab-player-names !mt-0">
            <div>{getPlayerName(match.teamB.player1)}</div>
            <div>{getPlayerName(match.teamB.player2)}</div>
          </div>
          {renderScore(scoreB, setScoreB, match.scoreB)}
        </div>
      </div>

      {showValidation && !readOnly && !isLocked && (
        <div className="mt-3 app-alert-error">
          <p className="font-semibold">Invalid Score!</p>
          <p>First to 21 win by 2. Past 20-20, win by 2 until someone hits 30 (30-28, 30-29 OK).</p>
        </div>
      )}

      {readOnly && isCompleted && (
        <div className="tab-match-completed mt-3">
          <span className="flex-1 text-center">
            ✓ {match.winnerTeam === 'A' ? teamALabel : teamBLabel} Wins
          </span>
        </div>
      )}

      {!readOnly && !tournament.isFinalized && (
        <div className="tab-match-footer">
          {isCompleted && !isEditing ? (
            <div className="tab-match-completed">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setScoreA(match.scoreA?.toString() || '');
                  setScoreB(match.scoreB?.toString() || '');
                }}
                className="tab-match-completed-edit"
                title="Edit scores"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <span className="flex-1 text-center">
                ✓ {match.winnerTeam === 'A' ? teamALabel : teamBLabel} Wins
              </span>
              <div className="w-8 shrink-0" aria-hidden />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid}
              className={isValid ? 'tab-match-action-ready' : 'tab-match-action-disabled'}
            >
              {isValid ? (isEditing ? 'Update Score' : 'Submit') : 'Enter Valid Scores'}
            </button>
          )}
        </div>
      )}

      {!readOnly && isCompleted && !tournament.isFinalized && onRequeue && (
        <button type="button" onClick={() => onRequeue(match.id)} className="tab-btn-muted !py-2 mt-2">
          Requeue
        </button>
      )}

      {!readOnly && isEditing && !tournament.isFinalized && (
        <button
          type="button"
          onClick={() => {
            setIsEditing(false);
            setScoreA(match.scoreA?.toString() || '');
            setScoreB(match.scoreB?.toString() || '');
          }}
          className="tab-btn-muted !py-2 mt-2"
        >
          Cancel
        </button>
      )}

      {!readOnly && tournament.isFinalized && (
        <div className="tab-match-action tab-match-action-disabled mt-3 cursor-default">
          Tournament Finalized
        </div>
      )}
    </div>
  );
}

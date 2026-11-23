'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Tournament, formatSideNames, getCourtNumbers, getRankedTeams, isSinglesEvent, isTournamentComplete, normalizeCourtNumbers } from '@/lib/gameLogic';
import PlayingTimeModal from '@/components/matches/PlayingTimeModal';

interface TeamStandingsPanelProps {
  tournament: Tournament;
  compact?: boolean;
  onFinalize?: () => void;
  onTeamSelect?: (teamId: number) => void;
  canEditCourts?: boolean;
  onSaveCourtNumbers?: (courtNumbers: number[]) => Promise<void> | void;
}

export default function TeamStandingsPanel({
  tournament,
  compact = false,
  onFinalize,
  onTeamSelect,
  canEditCourts = false,
  onSaveCourtNumbers,
}: TeamStandingsPanelProps) {
  const rankedTeams = getRankedTeams(tournament);
  const showFinalize = !!onFinalize && isTournamentComplete(tournament) && !tournament.isFinalized;
  const currentCourts = getCourtNumbers(tournament);
  const [draftCourts, setDraftCourts] = useState<number[]>(currentCourts);
  const [savingCourts, setSavingCourts] = useState(false);
  const [courtError, setCourtError] = useState<string | null>(null);
  const [showPlayingTime, setShowPlayingTime] = useState(false);

  useEffect(() => {
    setDraftCourts(currentCourts);
    setCourtError(null);
  }, [currentCourts.join('-')]);

  const singles = isSinglesEvent(tournament.eventType);
  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  const showCourtEditor = canEditCourts && !!onSaveCourtNumbers && !tournament.isFinalized;
  const normalizedDraft = normalizeCourtNumbers(draftCourts, tournament.teams.length);
  const courtsUnchanged = currentCourts.length === draftCourts.length && currentCourts.every((court, index) => court === draftCourts[index]);

  const handleSaveCourts = async () => {
    if (!onSaveCourtNumbers || !normalizedDraft || courtsUnchanged || savingCourts) return;
    setSavingCourts(true);
    setCourtError(null);
    try {
      await onSaveCourtNumbers(normalizedDraft);
    } catch (error) {
      setCourtError(error instanceof Error ? error.message : 'Could not update court numbers.');
    } finally {
      setSavingCourts(false);
    }
  };

  return (
    <div className={compact ? 'team-standings-panel team-standings-panel-compact' : 'team-standings-panel'}>
      <h4 className="team-standings-title">{singles ? 'Player Standings' : 'Team Standings'}</h4>
      <p className="team-standings-hint">
        {onTeamSelect
          ? `Click a ${singles ? 'player' : 'team'} for match schedule`
          : 'Updates live as scores are entered'}
      </p>
      <div className="team-standings-list">
        {rankedTeams.map((team) => {
          const rowClass = `team-standings-row ${team.rank === 1 ? 'team-standings-row-leader' : ''}${onTeamSelect ? ' team-standings-row-clickable' : ''}`;
          const rowContent = (
            <>
              <div className="team-standings-rank">{team.rank}</div>
              <div className="team-standings-badge">{team.label}</div>
              {!compact ? (
                <div className="team-standings-players min-w-0">
                  <div className="team-standings-player truncate">
                    {formatSideNames(getPlayerName(team.player1Id), getPlayerName(team.player2Id))}
                  </div>
                </div>
              ) : (
                <div className="team-standings-players-spacer" aria-hidden />
              )}
              <div className="team-standings-record">
                {team.wins}-{team.losses}
              </div>
              <div className="team-standings-points">
                {team.pointDiff > 0 ? '+' : ''}
                {team.pointDiff}
              </div>
            </>
          );

          if (onTeamSelect) {
            return (
              <button
                key={team.id}
                type="button"
                className={rowClass}
                onClick={() => onTeamSelect(team.id)}
              >
                {rowContent}
              </button>
            );
          }

          return (
            <div key={team.id} className={rowClass}>
              {rowContent}
            </div>
          );
        })}
      </div>

      {showCourtEditor && (
        <div className="team-standings-courts">
          <h5 className="team-standings-courts-title">Court numbers</h5>
          <div className="team-standings-courts-row">
            {draftCourts.map((court, index) => (
              <input
                key={index}
                type="number"
                min={1}
                max={999}
                value={Number.isFinite(court) ? court : ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? NaN : Number(e.target.value);
                  setDraftCourts((current) => current.map((n, i) => (i === index ? value : n)));
                }}
                aria-label={`Court ${index + 1} number`}
              />
            ))}
            <button
              type="button"
              className="team-standings-courts-save"
              onClick={handleSaveCourts}
              disabled={!normalizedDraft || courtsUnchanged || savingCourts}
            >
              {savingCourts ? 'Saving...' : 'Save'}
            </button>
          </div>
          {!normalizedDraft && (
            <p className="team-standings-courts-error">Enter a unique court number for each court.</p>
          )}
          {courtError && <p className="team-standings-courts-error">{courtError}</p>}
        </div>
      )}

      <button type="button" className="team-standings-playing-btn" onClick={() => setShowPlayingTime(true)}>
        Playing Time
      </button>

      {showFinalize && (
        <button type="button" onClick={onFinalize} className="team-standings-finalize-btn">
          Finalize Tournament
        </button>
      )}

      {tournament.isFinalized && (
        <p className="team-standings-finalized-label">Tournament finalized</p>
      )}

      <Link href="/" className="team-standings-home-link">
        Return to Home
      </Link>

      {showPlayingTime && (
        <PlayingTimeModal tournament={tournament} onClose={() => setShowPlayingTime(false)} />
      )}
    </div>
  );
}

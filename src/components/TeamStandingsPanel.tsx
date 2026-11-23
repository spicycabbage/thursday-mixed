'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tournament, formatSideNames, getRankedTeams, isSinglesEvent, isTournamentComplete } from '@/lib/gameLogic';
import PlayingTimeModal from '@/components/matches/PlayingTimeModal';

interface TeamStandingsPanelProps {
  tournament: Tournament;
  compact?: boolean;
  onFinalize?: () => void;
  onTeamSelect?: (teamId: number) => void;
}

export default function TeamStandingsPanel({
  tournament,
  compact = false,
  onFinalize,
  onTeamSelect,
}: TeamStandingsPanelProps) {
  const rankedTeams = getRankedTeams(tournament);
  const showFinalize = !!onFinalize && isTournamentComplete(tournament) && !tournament.isFinalized;
  const [showPlayingTime, setShowPlayingTime] = useState(false);

  const singles = isSinglesEvent(tournament.eventType);
  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

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

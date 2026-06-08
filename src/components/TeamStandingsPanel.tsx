'use client';

import Link from 'next/link';
import { Tournament, getRankedTeams, isTournamentComplete } from '@/lib/gameLogic';

interface TeamStandingsPanelProps {
  tournament: Tournament;
  compact?: boolean;
  onFinalize?: () => void;
}

export default function TeamStandingsPanel({
  tournament,
  compact = false,
  onFinalize,
}: TeamStandingsPanelProps) {
  const rankedTeams = getRankedTeams(tournament);
  const showFinalize =
    onFinalize && isTournamentComplete(tournament) && !tournament.isFinalized;

  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  return (
    <div className={compact ? 'team-standings-panel team-standings-panel-compact' : 'team-standings-panel'}>
      <h4 className="team-standings-title">Team Standings</h4>
      <p className="team-standings-hint">Updates live as scores are entered</p>
      <div className="team-standings-list">
        {rankedTeams.map((team) => (
          <div
            key={team.id}
            className={`team-standings-row ${team.rank === 1 ? 'team-standings-row-leader' : ''}`}
          >
            <div className="team-standings-rank">{team.rank}</div>
            <div className="team-standings-badge">{team.label}</div>
            {!compact ? (
              <div className="team-standings-players min-w-0">
                <div className="team-standings-player truncate">
                  {getPlayerName(team.player1Id)}
                </div>
                <div className="team-standings-player truncate">
                  {getPlayerName(team.player2Id)}
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
          </div>
        ))}
      </div>

      {showFinalize && (
        <button type="button" onClick={onFinalize} className="team-standings-finalize-btn">
          Finalize Tournament
        </button>
      )}

      {tournament.isFinalized && (
        <p className="team-standings-finalized-label">Tournament finalized</p>
      )}

      {onFinalize && (
        <Link href="/" className="team-standings-home-link">
          Return to Home
        </Link>
      )}
    </div>
  );
}

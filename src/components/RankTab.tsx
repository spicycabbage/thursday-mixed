'use client';
import Link from 'next/link';
import {
  Tournament,
  getRankedTeams,
  getRankedPlayers,
  isTournamentComplete,
} from '@/lib/gameLogic';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import TabPanel from '@/components/TabPanel';

interface RankTabProps {
  tournament: Tournament;
  onFinalize: () => void;
  canManage?: boolean;
  embedded?: boolean;
  onTeamSelect?: (teamId: number) => void;
}

function RankEntry({
  badge,
  title,
  subtitle,
  record,
  points,
  leading = false,
  onClick,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  record: string;
  points: string;
  leading?: boolean;
  onClick?: () => void;
}) {
  const className = `tab-entry-row tab-entry-row-a ${leading ? 'tab-card-leading' : ''}`;
  const body = (
    <>
      {badge ? <div className="team-badge">{badge}</div> : null}
      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-900 truncate">{title}</div>
        {subtitle && <div className="tab-player-names !mt-0 !text-sm truncate">{subtitle}</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="tab-stat-badge">{record}</div>
        <div className="text-sm text-gray-900 font-bold mt-1">{points}</div>
      </div>
    </>
  );

  if (!onClick) return <div className={className}>{body}</div>;

  return (
    <button type="button" className={`${className} rank-entry-button`} onClick={onClick}>
      {body}
    </button>
  );
}

export default function RankTab({
  tournament,
  onFinalize,
  canManage = true,
  embedded = false,
  onTeamSelect,
}: RankTabProps) {
  const rankedTeams = getRankedTeams(tournament);
  const rankedPlayers = embedded ? [] : getRankedPlayers(tournament);
  const isComplete = isTournamentComplete(tournament);

  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  const subtitle = isComplete ? 'Complete' : `Round ${tournament.currentRound}`;

  const standings = (
    <>
      <h4 className="tab-section-title">Team Standings</h4>
      <div className="space-y-3">
        {rankedTeams.map((team) => {
          const players = `${getPlayerName(team.player1Id)} & ${getPlayerName(team.player2Id)}`;
          return (
            <RankEntry
              key={team.id}
              badge={team.label}
              title={embedded ? `#${team.rank} ${players}` : `#${team.rank} Team ${team.label}`}
              subtitle={embedded ? undefined : players}
              record={`${team.wins}-${team.losses}`}
              points={`${team.pointDiff > 0 ? '+' : ''}${team.pointDiff} pts`}
              leading={team.rank === 1}
              onClick={onTeamSelect ? () => onTeamSelect(team.id) : undefined}
            />
          );
        })}
      </div>

      {!embedded && (
        <>
          <h4 className="tab-section-title mt-6">Individual Records</h4>
          <div className="space-y-3">
            {rankedPlayers.map((player) => (
              <RankEntry
                key={player.id}
                badge={`${player.rank}`}
                title={player.name}
                subtitle={`Team ${tournament.teams.find((t) => t.id === player.teamId)?.label}`}
                record={`${player.wins}-${player.losses}`}
                points={`${player.pointDiff > 0 ? '+' : ''}${player.pointDiff}`}
                leading={player.rank === 1}
              />
            ))}
          </div>
        </>
      )}

      {(canManage || !embedded) && (
        <div className="space-y-3 pt-3">
          {canManage && isComplete && !tournament.isFinalized && (
            <button type="button" onClick={onFinalize} className="tab-btn-danger">
              Finalize Tournament
            </button>
          )}
          {!embedded && (
            <Link href="/" className="block w-full">
              <button type="button" className="tab-btn-muted w-full">Return to Home Screen</button>
            </Link>
          )}
        </div>
      )}
    </>
  );

  if (embedded) return <div className="space-y-3">{standings}</div>;

  return (
    <TabPanel
      title={isComplete ? 'Final Standings' : 'Standings'}
      subtitle={subtitle}
      icon={<ChartBarIcon className="w-5 h-5 text-gray-900 shrink-0" />}
      toolbar={<p className="tab-toolbar-hint">Ranked by W-L, then point differential</p>}
    >
      {standings}
    </TabPanel>
  );
}

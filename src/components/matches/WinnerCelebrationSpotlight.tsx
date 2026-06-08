'use client';

import { Tournament, Team } from '@/lib/gameLogic';
import { TrophyIcon } from '@heroicons/react/24/solid';

const BALLOON_LAYOUT = [
  { left: '4%', bottom: '12%', color: '#ef4444', delay: '0s', size: 36 },
  { left: '12%', bottom: '28%', color: '#3b82f6', delay: '0.6s', size: 28 },
  { left: '82%', bottom: '14%', color: '#f59e0b', delay: '0.2s', size: 40 },
  { left: '90%', bottom: '32%', color: '#22c55e', delay: '0.9s', size: 30 },
  { left: '24%', bottom: '8%', color: '#a855f7', delay: '1.1s', size: 26 },
  { left: '72%', bottom: '8%', color: '#ec4899', delay: '0.4s', size: 32 },
  { left: '50%', bottom: '6%', color: '#06b6d4', delay: '0.8s', size: 28 },
  { left: '6%', bottom: '42%', color: '#eab308', delay: '1.5s', size: 24 },
  { left: '58%', bottom: '22%', color: '#6366f1', delay: '0.3s', size: 34 },
] as const;

interface WinnerCelebrationSpotlightProps {
  tournament: Tournament;
  winners: Team[];
}

function WinnerCard({
  team,
  tournament,
}: {
  team: Team;
  tournament: Tournament;
}) {
  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  return (
    <div className="team-standings-row team-standings-row-leader winner-celebration-standing-row">
      <div className="team-standings-rank">{team.rank}</div>
      <div className="team-standings-badge">{team.label}</div>
      <div className="team-standings-players min-w-0">
        <div className="team-standings-player truncate">{getPlayerName(team.player1Id)}</div>
        <div className="team-standings-player truncate">{getPlayerName(team.player2Id)}</div>
      </div>
      <div className="team-standings-record">
        {team.wins}-{team.losses}
      </div>
      <div className="team-standings-points">
        {team.pointDiff > 0 ? '+' : ''}
        {team.pointDiff}
      </div>
    </div>
  );
}

export default function WinnerCelebrationSpotlight({
  tournament,
  winners,
}: WinnerCelebrationSpotlightProps) {
  const isTie = winners.length > 1;
  const title = isTie ? 'Co-Champions!' : 'Winner!';

  return (
    <div className="winner-celebration-spotlight">
      <div className="winner-celebration-balloons" aria-hidden>
        {BALLOON_LAYOUT.map((balloon, index) => (
          <div
            key={index}
            className="winner-celebration-balloon"
            style={{
              left: balloon.left,
              bottom: balloon.bottom,
              width: `${balloon.size}px`,
              height: `${Math.round(balloon.size * 1.25)}px`,
              backgroundColor: balloon.color,
              animationDelay: balloon.delay,
            }}
          />
        ))}
      </div>

      <div className="relative z-[1] flex min-h-[22rem] flex-col justify-center px-10 py-8 text-left">
        <p className="mb-2.5 text-base font-bold uppercase tracking-widest text-amber-700">
          Tournament Complete
        </p>
        <h2 className="mb-2.5 text-6xl font-black leading-none tracking-tight text-gray-900">
          {title}
        </h2>
        <p className="mb-6 text-xl font-semibold text-gray-500">
          {isTie
            ? `${winners.length} teams tied for first place`
            : 'Congratulations to the champions'}
        </p>

        <div className="flex items-center gap-10">
          <aside className="flex w-36 shrink-0 items-center justify-center self-stretch">
            <TrophyIcon
              className="h-28 w-28 shrink-0 text-amber-500"
              style={{ filter: 'drop-shadow(0 6px 12px rgba(245, 158, 11, 0.45))' }}
            />
          </aside>

          <div
            className={
              isTie ? 'winner-celebration-winners winner-celebration-winners-tie' : 'winner-celebration-winners'
            }
          >
            {winners.map((team) => (
              <WinnerCard key={team.id} team={team} tournament={tournament} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

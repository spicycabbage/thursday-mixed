'use client';

import { Tournament, Team, getTeamLabel } from '@/lib/gameLogic';
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
    <div className="winner-celebration-team flex items-center gap-5 rounded-xl border border-amber-200 bg-white px-8 py-6 shadow-md">
      <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-xl bg-slate-800 text-2xl font-extrabold text-white">
        {getTeamLabel(team.id)}
      </div>
      <div className="min-w-0 text-left">
        <div className="text-2xl font-bold leading-snug text-gray-900">
          {getPlayerName(team.player1Id)}
        </div>
        <div className="text-2xl font-bold leading-snug text-gray-900">
          {getPlayerName(team.player2Id)}
        </div>
        <div className="mt-2 text-lg font-bold tabular-nums text-gray-600">
          {team.wins}-{team.losses}
          <span className="ml-2 text-green-700">
            {team.pointDiff > 0 ? '+' : ''}
            {team.pointDiff}
          </span>
        </div>
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
              isTie
                ? 'grid min-w-0 flex-1 grid-cols-2 gap-5'
                : 'min-w-0 flex-1 max-w-2xl'
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

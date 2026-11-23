'use client';

import { useId } from 'react';
import { Tournament, Team } from '@/lib/gameLogic';

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

function CelebrationBalloon({ color }: { color: string }) {
  const id = useId().replace(/:/g, '');

  return (
    <svg viewBox="0 0 100 214" className="winner-celebration-balloon-svg" aria-hidden>
      <defs>
        <radialGradient id={`${id}-body`} cx="32%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="16%" stopColor={color} stopOpacity="0.95" />
          <stop offset="58%" stopColor={color} />
          <stop offset="100%" stopColor="#1e293b" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id={`${id}-string`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="62" rx="40" ry="52" fill={`url(#${id}-body)`} />
      <ellipse cx="34" cy="42" rx="10" ry="18" fill="#fff" opacity="0.42" transform="rotate(-28 34 42)" />
      <path d="M44 112c2 6 10 8 12 4 2-4 4-8 0-10-3 2-8 2-12 6z" fill={color} opacity="0.9" />
      <path
        d="M50 118c8 16-14 28-4 46 8 14-12 24-2 40"
        fill="none"
        stroke={`url(#${id}-string)`}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CelebrationTrophy({ className = 'h-28 w-28 shrink-0' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const metal = `${id}-metal`;
  const cup = `${id}-cup`;
  const shine = `${id}-shine`;

  return (
    <svg viewBox="0 0 128 128" className={className} aria-hidden>
      <defs>
        <linearGradient id={metal} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff6d0" />
          <stop offset="22%" stopColor="#f0c14b" />
          <stop offset="48%" stopColor="#b7791f" />
          <stop offset="70%" stopColor="#ffe08a" />
          <stop offset="100%" stopColor="#8a5a08" />
        </linearGradient>
        <linearGradient id={cup} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff4c4" />
          <stop offset="28%" stopColor="#f6c453" />
          <stop offset="62%" stopColor="#c4841d" />
          <stop offset="100%" stopColor="#7c4a09" />
        </linearGradient>
        <radialGradient id={shine} cx="34%" cy="30%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        d="M36 40c-18 2-24 20-16 32 5 8 16 10 22 4"
        fill="none"
        stroke={`url(#${metal})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M92 40c18 2 24 20 16 32-5 8-16 10-22 4"
        fill="none"
        stroke={`url(#${metal})`}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M38 30h52c1 20-4 38-14 50-6 8-12 11-12 11s-6-3-12-11C42 68 37 50 38 30z"
        fill={`url(#${cup})`}
      />
      <ellipse cx="64" cy="30" rx="26" ry="8" fill="#ffe7a3" />
      <ellipse cx="64" cy="31" rx="18" ry="4.5" fill="#9a6412" opacity="0.35" />
      <ellipse cx="52" cy="50" rx="12" ry="18" fill={`url(#${shine})`} />
      <path d="M56 90h16l5 12H51z" fill={`url(#${metal})`} />
      <rect x="42" y="100" width="44" height="8" rx="2" fill={`url(#${cup})`} />
      <rect x="30" y="108" width="68" height="11" rx="3" fill="#a56b12" />
      <rect x="30" y="108" width="68" height="4" rx="2" fill="#fff1c2" opacity="0.75" />
    </svg>
  );
}

interface WinnerCelebrationSpotlightProps {
  tournament: Tournament;
  podium: Team[];
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
  const place = team.rank === 1 ? 'leader' : `place-${team.rank}`;

  return (
    <div
      className={`team-standings-row winner-celebration-standing-row winner-celebration-${place} ${
        team.rank === 1 ? 'team-standings-row-leader' : ''
      }`}
    >
      <div className="team-standings-rank">{team.rank}</div>
      <div className="team-standings-badge">{team.label}</div>
      <div className="team-standings-players min-w-0">
        <div className="team-standings-player truncate">{getPlayerName(team.player1Id)}</div>
        {getPlayerName(team.player2Id) ? (
          <div className="team-standings-player truncate">{getPlayerName(team.player2Id)}</div>
        ) : null}
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
  podium,
}: WinnerCelebrationSpotlightProps) {
  const firstPlace = podium.filter((team) => team.rank === 1);
  const isTie = firstPlace.length > 1;
  const title = isTie ? 'Co-Champions!' : 'Podium';

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
              animationDelay: balloon.delay,
            }}
          >
            <CelebrationBalloon color={balloon.color} />
          </div>
        ))}
      </div>

      <div className="relative z-[1] flex min-h-[22.5rem] flex-col justify-center px-8 py-7 text-left">
        <p className="mb-2 text-lg font-bold uppercase tracking-widest text-amber-700">
          Tournament Complete
        </p>
        <h2 className="mb-2 text-6xl font-black leading-none tracking-tight text-gray-900">
          {title}
        </h2>
        <p className="mb-5 text-2xl font-semibold text-gray-500">
          {isTie ? `${firstPlace.length} teams tied for 1st` : '1st, 2nd, and 3rd'}
        </p>

        <div className="flex items-center gap-10">
          <aside className="flex w-[8.6rem] shrink-0 items-center justify-center">
            <CelebrationTrophy />
          </aside>

          <div className="winner-celebration-winners">
            {podium.map((team) => (
              <WinnerCard key={team.id} team={team} tournament={tournament} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

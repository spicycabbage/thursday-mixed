'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Tournament,
  Team,
  getDesktopSpotlightMatches,
  courtCountForTeams,
  getRankedTeams,
  isTournamentComplete,
} from '@/lib/gameLogic';
import MatchCard from '@/components/matches/MatchCard';
import TeamSummaryModal from '@/components/matches/TeamSummaryModal';
import { CelebrationTrophy } from '@/components/matches/WinnerCelebrationSpotlight';
import RankTab from '@/components/RankTab';

type SpectatorTab = 'playing' | 'queue' | 'completed' | 'ranking';

const TABS: { id: SpectatorTab; label: string }[] = [
  { id: 'playing', label: 'Playing Now' },
  { id: 'queue', label: 'Queue' },
  { id: 'completed', label: 'Completed' },
  { id: 'ranking', label: 'Ranking' },
];

function formatDate(dateString: string) {
  const [y, m, d] = dateString.split('-').map(Number);
  const middayUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  return middayUtc.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const CONFETTI = [
  { left: '6%', delay: '0s', color: '#fbbf24', duration: '5.2s' },
  { left: '15%', delay: '1.8s', color: '#f472b6', duration: '6.1s' },
  { left: '24%', delay: '0.7s', color: '#60a5fa', duration: '4.8s' },
  { left: '33%', delay: '2.6s', color: '#34d399', duration: '5.6s' },
  { left: '42%', delay: '1.2s', color: '#fde68a', duration: '6.4s' },
  { left: '51%', delay: '3.1s', color: '#a78bfa', duration: '5s' },
  { left: '60%', delay: '0.4s', color: '#f87171', duration: '5.8s' },
  { left: '69%', delay: '2.2s', color: '#fbbf24', duration: '4.6s' },
  { left: '78%', delay: '1.5s', color: '#22d3ee', duration: '6s' },
  { left: '87%', delay: '0.9s', color: '#f472b6', duration: '5.4s' },
  { left: '94%', delay: '2.9s', color: '#fde68a', duration: '4.9s' },
] as const;

const PLACE_LABEL: Record<number, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

function SpectatorChampions({
  tournament,
  podium,
  onViewStandings,
}: {
  tournament: Tournament;
  podium: Array<Team & { rank: number }>;
  onViewStandings: () => void;
}) {
  const name = (playerId: number) =>
    tournament.players.find((player) => player.id === playerId)?.name ?? '';
  const firstPlace = podium.filter((team) => team.rank === 1);
  const isTie = firstPlace.length > 1;

  return (
    <section className="spectator-champions" aria-label="Top three places">
      <div className="spectator-champions-hero">
        <div className="spectator-champions-confetti" aria-hidden>
          {CONFETTI.map((piece, index) => (
            <span
              key={index}
              style={{
                left: piece.left,
                background: piece.color,
                animationDelay: piece.delay,
                animationDuration: piece.duration,
              }}
            />
          ))}
        </div>
        <div className="spectator-champions-trophy">
          <CelebrationTrophy className="spectator-champions-trophy-svg" />
        </div>
        <p className="spectator-champions-kicker">Tournament complete</p>
        <h2 className="spectator-champions-title">{isTie ? 'Co-Champions' : 'Podium'}</h2>
        <p className="spectator-champions-sub">
          {isTie ? `${firstPlace.length} teams tied for 1st` : '1st, 2nd, and 3rd'}
        </p>
      </div>

      <div className="spectator-champions-teams">
        {podium.map((team) => {
          const rank = team.rank ?? 0;
          return (
          <div
            key={team.id}
            className={`spectator-champion-card spectator-champion-place-${rank}`}
          >
            <div className="spectator-champion-head">
              <div className="spectator-champion-place">{PLACE_LABEL[rank] ?? `${rank}`}</div>
              <div className="spectator-champion-badge">{team.label}</div>
              <div className="spectator-champion-names">
                <span>{name(team.player1Id)}</span>
                <span>{name(team.player2Id)}</span>
              </div>
            </div>
            <div className="spectator-champion-stats">
              <div>
                <span className="spectator-champion-stat-value">
                  {team.wins}-{team.losses}
                </span>
                <span className="spectator-champion-stat-label">Record</span>
              </div>
              <div>
                <span className="spectator-champion-stat-value">
                  {team.pointDiff > 0 ? '+' : ''}
                  {team.pointDiff}
                </span>
                <span className="spectator-champion-stat-label">Point diff</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      <button type="button" className="spectator-champions-cta" onClick={onViewStandings}>
        View final standings
      </button>
    </section>
  );
}

export default function SpectatorView({ tournament }: { tournament: Tournament }) {
  const [tab, setTab] = useState<SpectatorTab>('playing');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const sortedMatches = useMemo(
    () => [...tournament.matches].sort((a, b) => a.id - b.id),
    [tournament.matches]
  );
  const { spotlight, deferred } = useMemo(
    () => getDesktopSpotlightMatches(sortedMatches, courtCountForTeams(tournament.teams.length)),
    [sortedMatches, tournament.teams.length]
  );
  const completed = useMemo(
    () => sortedMatches.filter((match) => match.completed),
    [sortedMatches]
  );
  const tournamentComplete = isTournamentComplete(tournament);
  const podium = useMemo(
    () =>
      getRankedTeams(tournament).filter(
        (team): team is Team & { rank: number } => team.rank != null && team.rank <= 3
      ),
    [tournament]
  );

  const noopScore = () => {};

  let pane: ReactNode;
  switch (tab) {
    case 'playing':
      pane = (
        <>
          <div className="spectator-meta">
            <span>{tournamentComplete ? 'Final' : 'On court'}</span>
            <span>
              {completed.length}/{sortedMatches.length}
            </span>
          </div>
          {tournamentComplete && podium.length > 0 ? (
            <SpectatorChampions
              tournament={tournament}
              podium={podium}
              onViewStandings={() => setTab('ranking')}
            />
          ) : spotlight.length > 0 ? (
            <div className="space-y-3">
              {spotlight.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  tournament={tournament}
                  onScoreUpdate={noopScore}
                  readOnly
                  labelMode="sequential"
                />
              ))}
            </div>
          ) : (
            <div className="spectator-empty">No courts in play</div>
          )}
        </>
      );
      break;
    case 'queue':
      pane = (
        <>
          <div className="spectator-meta">
            <span>Up next</span>
            <span>{deferred.length}</span>
          </div>
          {deferred.length > 0 ? (
            <div className="spectator-list">
              {deferred.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  tournament={tournament}
                  onScoreUpdate={noopScore}
                  variant="mini"
                  roster
                  labelMode="sequential"
                />
              ))}
            </div>
          ) : (
            <div className="spectator-empty">No matches waiting</div>
          )}
        </>
      );
      break;
    case 'completed':
      pane = (
        <>
          <div className="spectator-meta">
            <span>Final scores</span>
            <span>{completed.length}</span>
          </div>
          {completed.length > 0 ? (
            <div className="spectator-list">
              {[...completed].reverse().map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  tournament={tournament}
                  onScoreUpdate={noopScore}
                  variant="mini"
                  roster
                  labelMode="sequential"
                />
              ))}
            </div>
          ) : (
            <div className="spectator-empty">No completed matches yet</div>
          )}
        </>
      );
      break;
    case 'ranking':
      pane = (
        <RankTab
          tournament={tournament}
          onFinalize={noopScore}
          canManage={false}
          embedded
          onTeamSelect={setSelectedTeamId}
        />
      );
      break;
    default: {
      const unreachable: never = tab;
      pane = unreachable;
    }
  }

  return (
    <div className="spectator-shell">
      <header className="spectator-header">
        <div className="spectator-title-row">
          <Link href="/" className="spectator-home-link">
            Home
          </Link>
          <div className="spectator-date">
            <div className="spectator-event">
              {tournament.eventType || 'XD'}
              {tournament.name?.trim() ? ` · ${tournament.name.trim()}` : ''}
            </div>
            {formatDate(tournament.date)}
          </div>
          <span className="spectator-home-link spectator-title-balance" aria-hidden>
            Home
          </span>
        </div>
        <nav className="spectator-nav" aria-label="Tournament">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`spectator-tab ${tab === item.id ? 'spectator-tab-active' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className={`spectator-scroll spectator-pane-${tab}`}>
        <div className="spectator-pane">{pane}</div>
      </div>
      <TeamSummaryModal
        tournament={tournament}
        teamId={selectedTeamId}
        onClose={() => setSelectedTeamId(null)}
      />
    </div>
  );
}

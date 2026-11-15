'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageLoading, PageShell, PageTitleBlock } from '@/components/PageShell';
import { EVENT_TYPE_LABELS, type EventType } from '@/lib/gameLogic';

type AnalyticsTab = EventType | 'ALL';
const ANALYTICS_TABS: AnalyticsTab[] = ['MD', 'WD', 'XD', 'ALL'];

function statsCacheKey(tab: AnalyticsTab) {
  return `analytics:player-stats:${tab}`;
}

interface PlayerMatch {
  date: string;
  tournamentName: string;
  eventType: string;
  round: number;
  partner: string;
  opponent1: string;
  opponent2: string;
  playerScore: number;
  opponentScore: number;
  won: boolean;
}

interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winPercentage: number;
}

function formatMatchDate(dateString: string) {
  const [y, m, d] = dateString.split('-').map(Number);
  const middayUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
  return middayUtc.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AnalyticsContent() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [matches, setMatches] = useState<PlayerMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eventTab, setEventTab] = useState<AnalyticsTab>('ALL');

  const fetchPlayerStats = async (tab: AnalyticsTab, attempt: number): Promise<PlayerStats[] | null> => {
    const controller = new AbortController();
    const timeoutMs = attempt === 0 ? 30000 : 45000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(
        `/api/analytics/player-stats?year=all&event=${tab}&t=${Date.now()}`,
        { cache: 'no-store', signal: controller.signal }
      );
      if (!response.ok) return null;
      return (await response.json()) as PlayerStats[];
    } finally {
      clearTimeout(timeout);
    }
  };

  const loadPlayerStats = async (
    tab: AnalyticsTab,
    opts?: { refresh?: boolean; hadCache?: boolean }
  ) => {
    const isRefresh = opts?.refresh ?? false;
    const hadCache = opts?.hadCache ?? false;

    if (isRefresh) setRefreshing(true);
    else setLoadError(null);

    let stats: PlayerStats[] | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        stats = await fetchPlayerStats(tab, attempt);
        if (stats) break;
      } catch {
        if (attempt === 1) break;
      }
    }

    if (stats) {
      setPlayerStats(stats);
      setLoadError(null);
      try {
        sessionStorage.setItem(statsCacheKey(tab), JSON.stringify(stats));
      } catch {}
    } else if (isRefresh) {
      setLoadError('Could not refresh analytics. Try again in a moment.');
    } else if (!hadCache) {
      setLoadError('Analytics server is slow to wake up. Tap refresh to try again.');
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!selectedPlayer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMatches();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPlayer]);

  useEffect(() => {
    let hadCache = false;
    try {
      const cached = sessionStorage.getItem(statsCacheKey(eventTab));
      if (cached) {
        setPlayerStats(JSON.parse(cached) as PlayerStats[]);
        setLoading(false);
        hadCache = true;
      }
    } catch {}

    loadPlayerStats(eventTab, { hadCache });
  }, [eventTab]);

  const loadPlayerMatches = async (playerName: string) => {
    setSelectedPlayer(playerName);
    setMatches([]);
    setLoadingMatches(true);
    try {
      const eventQuery = eventTab === 'ALL' ? '' : `&event=${eventTab}`;
      const response = await fetch(
        `/api/analytics/player-matches?player=${encodeURIComponent(playerName)}${eventQuery}`,
        { cache: 'no-store' }
      );
      if (response.ok) setMatches((await response.json()) as PlayerMatch[]);
    } catch {}
    setLoadingMatches(false);
  };

  const closeMatches = () => {
    setSelectedPlayer(null);
    setMatches([]);
  };

  const selectTab = (tab: AnalyticsTab) => {
    if (tab === eventTab) return;
    closeMatches();
    let cached: PlayerStats[] | null = null;
    try {
      const raw = sessionStorage.getItem(statsCacheKey(tab));
      if (raw) cached = JSON.parse(raw) as PlayerStats[];
    } catch {}
    if (cached) {
      setPlayerStats(cached);
      setLoading(false);
    } else {
      setPlayerStats([]);
      setLoading(true);
    }
    setEventTab(tab);
  };

  return (
    <PageShell>
      <PageCard>
        <nav className="event-type-tabs event-type-tabs-4" aria-label="Event type">
          {ANALYTICS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`event-type-tab ${eventTab === tab ? 'event-type-tab-active' : ''}`}
              aria-current={eventTab === tab ? 'page' : undefined}
              onClick={() => selectTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
        <PageHeader
          title="Advanced Analytics"
          icon={<ChartBarIcon className="w-5 h-5" />}
        />

        <PageContent>
          <PageTitleBlock
            title="Player Win-Loss Records"
            subtitle={eventTab === 'ALL' ? 'All events' : EVENT_TYPE_LABELS[eventTab]}
          />
          <div className="flex justify-center -mt-4 mb-4">
            <button
              type="button"
              onClick={() => loadPlayerStats(eventTab, { refresh: true })}
              disabled={refreshing}
              className="text-blue-600 hover:text-blue-800 transition-colors disabled:opacity-50"
              title="Refresh data"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {loadError && (
            <div className="app-alert-error mb-4">{loadError}</div>
          )}

          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading analytics">
              <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-1 app-data-header">
                <div>Player</div>
                <div className="text-center">W</div>
                <div className="text-center">L</div>
                <div className="text-center">Win%</div>
              </div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : playerStats.length === 0 ? (
            <div className="app-empty-state">
              <ChartBarIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="page-title">No Data Available</h3>
              <p className="text-gray-500 mb-6">
                Complete and finalize tournaments to see player statistics
              </p>
              <Link href="/create-tournament">
                <button type="button" className="app-btn-action app-btn-sm max-w-xs mx-auto">
                  Create Your First Tournament
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-1 app-data-header">
                <div>Player</div>
                <div className="text-center">W</div>
                <div className="text-center">L</div>
                <div className="text-center">Win%</div>
              </div>

              {/* Player Stats */}
              {playerStats.map((player, index) => (
                <div key={player.name} className="grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-1 app-data-row">
                  <div className="flex items-center">
                    <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold mr-3">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => loadPlayerMatches(player.name)}
                      className="font-semibold truncate text-left hover:text-blue-600 hover:underline transition-colors"
                      disabled={loadingMatches}
                    >
                      {player.name}
                    </button>
                  </div>
                  <div className="text-center font-semibold text-green-600">{player.wins}</div>
                  <div className="text-center font-semibold text-red-600">{player.losses}</div>
                  <div className="text-center">
                    <span className={`font-semibold ${
                      player.winPercentage >= 70 ? 'text-green-600' :
                      player.winPercentage >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {player.winPercentage}%
                    </span>
                  </div>
                </div>
              ))}

              {/* Summary */}
              <div className="mt-6 app-summary-box">
                <h3 className="app-summary-title">Summary</h3>
                <div className="app-summary-text">
                  <p>• Total Players: {playerStats.length}</p>
                  <p>• Total Matches: {playerStats.reduce((sum, p) => sum + p.totalMatches, 0)}</p>
                </div>
              </div>
            </div>
          )}
        </PageContent>
      </PageCard>

      {selectedPlayer && (
        <div
          className="match-edit-modal-backdrop"
          role="presentation"
          onClick={closeMatches}
        >
          <div
            className="team-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-matches-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="match-edit-modal-header">
              <div className="min-w-0">
                <h3 id="player-matches-title" className="match-edit-modal-title">
                  {selectedPlayer}
                </h3>
                <p className="team-summary-modal-players">
                  {loadingMatches ? 'Loading matches…' : `${matches.length} matches`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMatches}
                className="match-edit-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="team-summary-modal-body">
              {loadingMatches ? null : matches.length === 0 ? (
                <p className="text-sm font-semibold text-gray-500">No completed matches</p>
              ) : (
                <ul className="team-summary-match-list">
                  {matches.map((match, index) => (
                    <li
                      key={`${match.date}-${match.round}-${index}`}
                      className={`team-summary-match-row ${
                        match.won ? 'team-summary-match-win' : 'team-summary-match-loss'
                      }`}
                    >
                      <div className="team-summary-match-main">
                        <span className="text-xs font-bold text-gray-500">
                          {match.eventType} · {formatMatchDate(match.date)}
                          {match.tournamentName.trim() ? ` · ${match.tournamentName.trim()}` : ''}
                        </span>
                        <span className="team-summary-match-opponent">
                          vs {match.opponent1} & {match.opponent2}
                        </span>
                        <span className="text-xs font-semibold text-gray-600">with {match.partner}</span>
                      </div>
                      <div className="team-summary-match-result">
                        <span className="team-summary-match-score">
                          {match.playerScore}-{match.opponentScore}
                        </span>
                        <span className="team-summary-match-outcome">{match.won ? 'W' : 'L'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageLoading message="Loading analytics..." />}>
      <AnalyticsContent />
    </Suspense>
  );
}

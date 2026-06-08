'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageLoading, PageShell, PageTitleBlock } from '@/components/PageShell';

interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winPercentage: number;
}

interface HeadToHeadRecord {
  opponent: string;
  wins: number;
  losses: number;
  totalMatches: number;
  winPercentage: number;
  avgMargin: number;
}

function AnalyticsContent() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [headToHeadData, setHeadToHeadData] = useState<HeadToHeadRecord[]>([]);
  const [loadingHeadToHead, setLoadingHeadToHead] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const cacheKey = 'analytics:player-stats:all';

  const fetchPlayerStats = async (attempt: number): Promise<PlayerStats[] | null> => {
    const controller = new AbortController();
    const timeoutMs = attempt === 0 ? 30000 : 45000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`/api/analytics/player-stats?year=all&t=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return (await response.json()) as PlayerStats[];
    } finally {
      clearTimeout(timeout);
    }
  };

  const loadPlayerStats = async (opts?: { refresh?: boolean; hadCache?: boolean }) => {
    const isRefresh = opts?.refresh ?? false;
    const hadCache = opts?.hadCache ?? false;

    if (isRefresh) setRefreshing(true);
    else setLoadError(null);

    let stats: PlayerStats[] | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        stats = await fetchPlayerStats(attempt);
        if (stats) break;
      } catch {
        if (attempt === 1) break;
      }
    }

    if (stats) {
      setPlayerStats(stats);
      setLoadError(null);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(stats));
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
    let hadCache = false;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setPlayerStats(JSON.parse(cached) as PlayerStats[]);
        setLoading(false);
        hadCache = true;
      }
    } catch {}

    loadPlayerStats({ hadCache });
  }, []);

  const loadHeadToHeadData = async (playerName: string) => {
    setLoadingHeadToHead(true);
    try {
      // Add timestamp to bypass cache
      const response = await fetch(`/api/analytics/head-to-head?t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, year: 'all' }),
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        setHeadToHeadData(data);
        setSelectedPlayer(playerName);
      } else {
        console.error('Failed to load head-to-head data:', response.status);
      }
    } catch (error) {
      console.error('Error loading head-to-head data:', error);
    }
    setLoadingHeadToHead(false);
  };

  const closeHeadToHead = () => {
    setSelectedPlayer(null);
    setHeadToHeadData([]);
  };

  return (
    <PageShell>
      <PageCard>
        <PageHeader
          title="Advanced Analytics"
          icon={<ChartBarIcon className="w-5 h-5" />}
        />

        <PageContent>
          <PageTitleBlock
            title="Player Win-Loss Records"
            subtitle="Statistics across all tournaments"
          />
          <div className="flex justify-center -mt-4 mb-4">
            <button
              type="button"
              onClick={() => loadPlayerStats({ refresh: true })}
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
                      onClick={() => loadHeadToHeadData(player.name)}
                      className="font-semibold truncate text-left hover:text-blue-600 hover:underline transition-colors"
                      disabled={loadingHeadToHead}
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

      {/* Head-to-Head Modal */}
      {selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b bg-blue-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">
                  {selectedPlayer}&apos;s Head-to-Head
                </h3>
                <button
                  onClick={closeHeadToHead}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingHeadToHead ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">Loading head-to-head data...</div>
                </div>
              ) : headToHeadData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-600">No head-to-head data available</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1.2fr] gap-1 px-2 py-2 bg-gray-100 rounded text-xs font-semibold text-gray-600">
                    <div>Opponent</div>
                    <div className="text-center">W</div>
                    <div className="text-center">L</div>
                    <div className="text-center">Win%</div>
                    <div className="text-center">Margin</div>
                  </div>

                  {/* Head-to-Head Records */}
                  {headToHeadData.map((record) => (
                    <div key={record.opponent} className="grid grid-cols-[2fr_0.8fr_0.8fr_1fr_1.2fr] gap-1 px-2 py-2 bg-gray-50 rounded items-center">
                      <div className="font-semibold truncate">{record.opponent}</div>
                      <div className="text-center font-semibold text-green-600">{record.wins}</div>
                      <div className="text-center font-semibold text-red-600">{record.losses}</div>
                      <div className="text-center">
                        <span className={`font-semibold ${
                          record.winPercentage >= 70 ? 'text-green-600' :
                          record.winPercentage >= 50 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {record.winPercentage}%
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={`font-semibold ${
                          record.avgMargin > 0 ? 'text-green-600' :
                          record.avgMargin < 0 ? 'text-red-600' :
                          'text-gray-600'
                        }`}>
                          {record.avgMargin > 0 ? '+' : ''}{record.avgMargin}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Summary */}
                  <div className="mt-4 p-3 bg-blue-50 rounded">
                    <div className="text-sm text-blue-700">
                      <p>• Total Opponents: {headToHeadData.length}</p>
                      <p>• Best Record: {headToHeadData.length > 0 ? `${headToHeadData[0].wins}-${headToHeadData[0].losses} vs ${headToHeadData[0].opponent}` : 'N/A'}</p>
                    </div>
                  </div>
                </div>
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

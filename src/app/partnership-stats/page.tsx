'use client';

import { useState, useEffect, Suspense } from 'react';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageLoading, PageShell } from '@/components/PageShell';

interface PartnershipStats {
  totalGames: number;
  wins: number;
  losses: number;
  winPercentage: number;
  avgMarginVictory: number;
}

interface PartnershipMatch {
  tournamentId: string;
  date: string;
  round: number;
  partnerScore: number;
  opponentScore: number;
  won: boolean;
}

interface PartnershipData {
  exists: boolean;
  message?: string;
  player1?: string;
  player2?: string;
  stats?: PartnershipStats;
  matches?: PartnershipMatch[];
}

function PartnershipStatsContent() {
  const [players, setPlayers] = useState<string[]>([]);
  const [player1, setPlayer1] = useState<string>('');
  const [player2, setPlayer2] = useState<string>('');
  const [partnershipData, setPartnershipData] = useState<PartnershipData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Fetch all players on component mount
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/analytics/partnership-stats');
        if (response.ok) {
          const data = await response.json();
          setPlayers(data.players || []);
        }
      } catch (err) {
        console.error('Failed to fetch players:', err);
      }
    };

    fetchPlayers();
  }, []);

  const handleSearch = async () => {
    if (!player1 || !player2) {
      setError('Please select both players');
      return;
    }

    if (player1 === player2) {
      setError('Players cannot be the same person');
      return;
    }

    setLoading(true);
    setError('');
    setPartnershipData(null);

    try {
      const response = await fetch(
        `/api/analytics/partnership-stats?player1=${encodeURIComponent(player1)}&player2=${encodeURIComponent(player2)}&year=all`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          setPartnershipData(data);
        }
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Failed to fetch partnership statistics');
      }
    } catch (err) {
      setError('An error occurred while fetching data');
    } finally {
      setLoading(false);
    }
  };

  const availablePlayer2Options = players.filter(p => p !== player1);

  return (
    <PageShell>
      <PageCard>
        <PageHeader
          title="Partnership Statistics"
          icon={<UserGroupIcon className="w-5 h-5" />}
        />

        <PageContent>
          <div className="space-y-4">
            <div>
              <label className="app-label">Select First Player</label>
              <select
                value={player1}
                onChange={(e) => {
                  setPlayer1(e.target.value);
                  if (e.target.value === player2) {
                    setPlayer2('');
                  }
                }}
                className="app-select"
              >
                <option value="">Choose a player...</option>
                {players.map((player) => (
                  <option key={player} value={player}>
                    {player}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="app-label">Select Second Player</label>
              <select
                value={player2}
                onChange={(e) => setPlayer2(e.target.value)}
                className="app-select"
                disabled={!player1}
              >
                <option value="">Choose a partner...</option>
                {availablePlayer2Options.map((player) => (
                  <option key={player} value={player}>
                    {player}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSearch}
              disabled={!player1 || !player2 || loading}
              className={!player1 || !player2 || loading ? 'app-btn-disabled' : 'app-btn-action'}
            >
              {loading ? 'Searching...' : 'Get Partnership Stats'}
            </button>

            {error && <div className="app-alert-error">{error}</div>}
          </div>

          {/* Results */}
          {partnershipData && (
            <div className="mt-6">
              {!partnershipData.exists ? (
                <div className="text-center py-8">
                  <div className="text-gray-600 text-lg">
                    {partnershipData.message || 'No such partnership'}
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    {player1} and {player2} have never played together as partners.
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="page-title text-center mb-2">
                    {partnershipData.player1} & {partnershipData.player2}
                  </h2>
                  <p className="page-subtitle text-center mb-4">
                    Partnership stats across all tournaments
                  </p>
                  
                  {partnershipData.stats && (
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="tab-card text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {partnershipData.stats.wins}
                        </div>
                        <div className="text-sm text-gray-600">Wins</div>
                      </div>
                      
                      <div className="tab-card text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {partnershipData.stats.losses}
                        </div>
                        <div className="text-sm text-gray-600">Losses</div>
                      </div>
                      
                      <div className="tab-card text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {partnershipData.stats.winPercentage}%
                        </div>
                        <div className="text-sm text-gray-600">Win Rate</div>
                      </div>
                      
                      <div className="tab-card text-center">
                        <div className="text-2xl font-bold text-gray-800">
                          {partnershipData.stats.avgMarginVictory > 0 ? `+${partnershipData.stats.avgMarginVictory}` : partnershipData.stats.avgMarginVictory}
                        </div>
                        <div className="text-sm text-gray-600">Avg Margin</div>
                      </div>
                    </div>
                  )}

                  {partnershipData.matches && partnershipData.matches.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-800 mb-3">Match History</h3>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {partnershipData.matches.map((match, index) => (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border ${
                              match.won 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div className="text-sm">
                                <div className="font-medium">
                                  Round {match.round} - {match.date}
                                </div>
                                <div className="text-gray-600">
                                  Score: {match.partnerScore} - {match.opponentScore}
                                </div>
                              </div>
                              <div className={`text-sm font-bold ${
                                match.won ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {match.won ? 'WIN' : 'LOSS'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </PageContent>
      </PageCard>
    </PageShell>
  );
}

export default function PartnershipStatsPage() {
  return (
    <Suspense fallback={<PageLoading message="Loading..." />}>
      <PartnershipStatsContent />
    </Suspense>
  );
}
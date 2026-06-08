'use client';



import { useState, useLayoutEffect } from 'react';

import { TrophyIcon, CalendarIcon } from '@heroicons/react/24/outline';

import { AppLinkButton, PageCard, PageContent, PageHeader, PageShell, PageTitleBlock } from '@/components/PageShell';

import { Tournament, getRankedTeams, NUM_TEAMS, nameKey, normalizeName, pickDisplayName } from '@/lib/gameLogic';



function loadLocalTournaments(): Tournament[] {

  if (typeof window === 'undefined') return [];



  const history = JSON.parse(localStorage.getItem('tournamentHistory') || '[]') as Tournament[];

  const currentRaw = localStorage.getItem('currentTournament');

  if (currentRaw) {

    try {

      const current = JSON.parse(currentRaw) as Tournament;

      const isComplete = current.matches?.every((m) => m.completed);

      if (isComplete && !history.find((t) => t.id === current.id)) {

        history.unshift(current);

      }

    } catch {}

  }

  return history;

}



type ActiveResponse = { active: boolean; tournament: { id: string } | null };

function syncTournamentStorage(history: Tournament[], active: ActiveResponse | null) {

  try {

    localStorage.setItem('tournamentHistory', JSON.stringify(history));

    const currentRaw = localStorage.getItem('currentTournament');

    if (!currentRaw) return;

    const current = JSON.parse(currentRaw) as Tournament;

    const activeId = active?.active ? active.tournament?.id : null;

    if (!activeId || current.id !== activeId) {

      localStorage.removeItem('currentTournament');

    }

  } catch {}

}



export default function TournamentResultsPage() {

  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  const [syncing, setSyncing] = useState(true);

  const [activeTab, setActiveTab] = useState<'history' | 'finishes'>('history');

  const [loadError, setLoadError] = useState<string | null>(null);



  useLayoutEffect(() => {

    const local = loadLocalTournaments();

    const fetchHistory = async (attempt: number): Promise<Tournament[] | null> => {

      const controller = new AbortController();

      const timeoutMs = attempt === 0 ? 30000 : 45000;

      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {

        const response = await fetch(`/api/tournaments/history?t=${Date.now()}`, {

          cache: 'no-store',

          signal: controller.signal,

        });

        if (!response.ok) return null;

        return (await response.json()) as Tournament[];

      } finally {

        clearTimeout(timeout);

      }

    };



    const fetchActive = async (): Promise<ActiveResponse | null> => {

      try {

        const response = await fetch(`/api/tournaments/active?t=${Date.now()}`, { cache: 'no-store' });

        if (!response.ok) return null;

        return (await response.json()) as ActiveResponse;

      } catch {

        return null;

      }

    };

    const loadTournaments = async () => {

      setLoadError(null);

      let dbTournaments: Tournament[] | null = null;

      for (let attempt = 0; attempt < 2; attempt++) {

        try {

          dbTournaments = await fetchHistory(attempt);

          if (dbTournaments) break;

        } catch {

          if (attempt === 1) break;

        }

      }

      if (dbTournaments) {

        const active = await fetchActive();

        syncTournamentStorage(dbTournaments, active);

        setTournaments(dbTournaments);

        setLoadError(null);

      } else if (local.length === 0) {

        setLoadError('Could not load tournament history. Check your connection and try again.');

      } else {

        setTournaments(local);

        setLoadError('Server is slow to wake up — showing saved tournaments. Refresh in a moment for latest.');

      }

      setSyncing(false);

    };



    loadTournaments();

  }, []);



  const formatDate = (dateString: string) => {

    const [y, m, d] = dateString.split('-').map(Number);

    const middayUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));

    return middayUtc.toLocaleDateString('en-US', {

      timeZone: 'America/Los_Angeles',

      year: 'numeric',

      month: 'short',

      day: 'numeric',

    });

  };



  const showSkeleton = syncing && tournaments.length === 0;



  return (

    <PageShell>

      <PageCard className="results-page-card">

        <PageHeader

          title="Tournament Results"

          icon={<TrophyIcon className="w-5 h-5" />}

        />



        <div className="flex-1 flex flex-col min-h-0">

          <div className="app-tab-nav">

            <button

              type="button"

              onClick={() => setActiveTab('history')}

              className={`app-tab-btn ${activeTab === 'history' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}

            >

              Tournament History

            </button>

            <button

              type="button"

              onClick={() => setActiveTab('finishes')}

              className={`app-tab-btn ${activeTab === 'finishes' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}

            >

              Historical Finishes

            </button>

          </div>



          <PageContent>

            {loadError && (

              <div className="app-alert-error mb-4">{loadError}</div>

            )}



            {activeTab === 'history' ? (

              <div>

                <PageTitleBlock

                  title="Tournament History"

                  subtitle={

                    showSkeleton

                      ? '\u00a0'

                      : `${tournaments.length} tournament${tournaments.length !== 1 ? 's' : ''}`

                  }

                />



                {showSkeleton ? (

                  <div className="space-y-4" aria-busy="true" aria-label="Loading tournament results">

                    {Array.from({ length: 3 }).map((_, i) => (

                      <div key={i} className="results-card-skeleton" />

                    ))}

                  </div>

                ) : tournaments.length === 0 ? (

                  <div className="app-empty-state">

                    <TrophyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />

                    <h3 className="page-title">No Tournament Results</h3>

                    <p className="text-gray-500 mb-6">

                      Complete tournaments will appear here for future reference

                    </p>

                    <AppLinkButton href="/create-tournament" className="app-btn-sm max-w-xs mx-auto">

                      Create Your First Tournament

                    </AppLinkButton>

                  </div>

                ) : (

                  <div className="space-y-4">

                    {tournaments.map((tournament) => (

                      <TournamentResultCard

                        key={tournament.id}

                        tournament={tournament}

                        formatDate={formatDate}

                      />

                    ))}

                  </div>

                )}

              </div>

            ) : syncing && tournaments.length === 0 ? (

              <div className="space-y-3" aria-busy="true" aria-label="Loading historical finishes">

                <div className="h-8 bg-gray-100 rounded animate-pulse" />

                <div className="h-48 bg-gray-100 rounded animate-pulse" />

              </div>

            ) : (

              <HistoricalFinishesTab tournaments={tournaments} />

            )}

          </PageContent>

        </div>

      </PageCard>

    </PageShell>

  );

}



interface TournamentResultCardProps {

  tournament: Tournament;

  formatDate: (date: string) => string;

}



function TournamentResultCard({ tournament, formatDate }: TournamentResultCardProps) {

  const [expanded, setExpanded] = useState(false);

  const rankedTeams = getRankedTeams(tournament);

  const winner = rankedTeams[0];

  const getPlayerName = (id: number) => tournament.players.find((p) => p.id === id)?.name ?? '';



  return (

    <div className="tab-card overflow-hidden p-0">

      <div

        className="p-4 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors min-h-[4.5rem]"

        onClick={() => setExpanded(!expanded)}

      >

        <div className="flex items-center justify-between">

          <div className="flex items-center">

            <CalendarIcon className="w-5 h-5 text-gray-300 mr-2" />

            <div>

              <p className="font-semibold text-white">{formatDate(tournament.date)}</p>

            </div>

          </div>

          <div className="text-right">

            <div className="flex items-center text-yellow-400">

              <TrophyIcon className="w-5 h-5 mr-1" />

              <span className="font-semibold">Team {winner?.label}</span>

            </div>

            <p className="text-sm text-gray-300">

              {winner?.wins}-{winner?.losses} ({winner && winner.pointDiff > 0 ? '+' : ''}

              {winner?.pointDiff} pts)

            </p>

          </div>

        </div>

      </div>



      {expanded && (

        <div className="p-4 border-t bg-white">

          <h4 className="font-semibold mb-3 text-gray-800">Final Team Standings</h4>

          <div className="space-y-2">

            {rankedTeams.map((team) => (

              <div key={team.id} className="flex items-center justify-between py-2">

                <div className="flex items-center">

                  <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-semibold mr-3">

                    {team.rank}

                  </span>

                  <div>

                    <span className={team.rank === 1 ? 'font-semibold text-yellow-600' : 'text-gray-800'}>

                      Team {team.label}

                    </span>

                    <p className="text-xs text-gray-500">

                      {getPlayerName(team.player1Id)} & {getPlayerName(team.player2Id)}

                    </p>

                  </div>

                </div>

                <span className="font-semibold text-gray-800">

                  {team.wins}-{team.losses} ({team.pointDiff > 0 ? '+' : ''}

                  {team.pointDiff})

                </span>

              </div>

            ))}

          </div>

        </div>

      )}

    </div>

  );

}



interface HistoricalFinishesTabProps {

  tournaments: Tournament[];

}



function HistoricalFinishesTab({ tournaments }: HistoricalFinishesTabProps) {

  const playerFinishes: Record<string, number[]> = {};

  const playerScores: Record<string, number[]> = {};

  const playerRanks: Record<string, number[]> = {};

  const displayNames: Record<string, string> = {};



  tournaments.forEach((tournament) => {

    const teamRankById = new Map(

      getRankedTeams(tournament).map((team) => [team.id, team.rank])

    );

    tournament.players.forEach((player) => {

      const finishRank = teamRankById.get(player.teamId);

      if (!finishRank || finishRank > NUM_TEAMS) return;

      const trimmedName = normalizeName(player.name);

      const key = nameKey(trimmedName);

      if (!playerFinishes[key]) {

        playerFinishes[key] = new Array(NUM_TEAMS).fill(0);

        playerScores[key] = [];

        playerRanks[key] = [];

        displayNames[key] = trimmedName;

      } else {

        displayNames[key] = pickDisplayName(displayNames[key], trimmedName);

      }

      playerFinishes[key][finishRank - 1]++;

      playerRanks[key].push(finishRank);

      playerScores[key].push(player.pointDiff);

    });

  });



  const playerStats = Object.entries(playerFinishes).map(([key, finishes]) => {

    const ranks = playerRanks[key] ?? [];

    return {

      name: displayNames[key] ?? key,

      finishes,

      totalTournaments: finishes.reduce((sum, count) => sum + count, 0),

      avgScoreDiff: playerScores[key].length > 0

        ? Math.round(playerScores[key].reduce((sum, score) => sum + score, 0) / playerScores[key].length)

        : 0,

      personalBest: ranks.length > 0 ? Math.min(...ranks) : null,

      personalWorst: ranks.length > 0 ? Math.max(...ranks) : null,

    };

  }).sort((a, b) => b.totalTournaments - a.totalTournaments);



  const getPositionColor = (position: number) => {

    switch (position) {

      case 0: return 'text-yellow-600';

      case 1: return 'text-gray-500';

      case 2: return 'text-amber-600';

      default: return 'text-gray-700';

    }

  };



  const getPositionBg = (position: number) => {

    switch (position) {

      case 0: return 'bg-yellow-100';

      case 1: return 'bg-gray-200';

      case 2: return 'bg-orange-100';

      default: return 'bg-gray-50';

    }

  };



  if (playerStats.length === 0) {

    return (

      <div className="text-center py-8">

        <TrophyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />

        <h3 className="text-xl font-bold text-gray-600 mb-2">No Historical Data</h3>

        <p className="text-gray-500">

          Complete more tournaments to see historical finishes

        </p>

      </div>

    );

  }



  return (

    <div>

      <PageTitleBlock

        title="Historical Finishes"

        subtitle="Player finishes across all tournaments"

      />



      <div className="relative">

        <div className="overflow-x-auto">

          <table className="w-full border-collapse">

            <thead>

              <tr className="bg-gray-100 text-xs font-semibold text-gray-600">

                <th className="sticky left-0 z-20 bg-gray-100 w-32 px-3 py-2 text-left border-r border-gray-200">

                  Player

                </th>

                <th className="w-16 px-2 py-2 text-center border-r border-gray-200 bg-gray-100">Avg</th>

                <th className="w-12 px-2 py-2 text-center border-r border-gray-200 bg-yellow-100">1st</th>

                <th className="w-12 px-2 py-2 text-center border-r border-gray-200 bg-gray-200">2nd</th>

                <th className="w-12 px-2 py-2 text-center border-r border-gray-200 bg-orange-100">3rd</th>

                <th className="w-12 px-2 py-2 text-center border-r border-gray-200">4th</th>

                <th className="w-12 px-2 py-2 text-center border-r border-gray-200">5th</th>

                <th className="w-12 px-2 py-2 text-center border-r border-gray-200">6th</th>

                <th className="w-16 px-2 py-2 text-center border-r border-gray-200 bg-green-100" title="Personal best finish">PB</th>

                <th className="w-16 px-2 py-2 text-center bg-red-100" title="Personal worst finish">PW</th>

              </tr>

            </thead>



            <tbody>

              {playerStats.map((player) => (

                <tr key={player.name} className="bg-gray-50 border-t border-gray-200">

                  <td className="sticky left-0 z-10 bg-gray-50 w-32 px-3 py-3 border-r border-gray-200">

                    <div className="flex items-center">

                      <span className="font-semibold truncate text-sm mr-1">{player.name}</span>

                      <span className="text-xs text-gray-500">({player.totalTournaments})</span>

                    </div>

                  </td>

                  <td className="w-16 px-2 py-3 text-center border-r border-gray-200 bg-gray-100">

                    <span className="text-xs font-semibold text-gray-700">

                      {player.avgScoreDiff >= 0 ? '+' : ''}{player.avgScoreDiff}

                    </span>

                  </td>

                  {player.finishes.map((count, position) => (

                    <td key={position} className={`w-12 px-2 py-3 text-center border-r border-gray-200 ${getPositionBg(position)}`}>

                      <span className={`text-xs font-semibold ${getPositionColor(position)}`}>

                        {count || '-'}

                      </span>

                    </td>

                  ))}

                  <td className="w-16 px-2 py-3 text-center border-r border-gray-200 bg-green-50">

                    <span className="text-xs font-semibold text-green-700">

                      {player.personalBest ?? '-'}

                    </span>

                  </td>

                  <td className="w-16 px-2 py-3 text-center bg-red-50">

                    <span className="text-xs font-semibold text-red-700">

                      {player.personalWorst ?? '-'}

                    </span>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>




      </div>



      <div className="mt-6 app-summary-box">

        <h3 className="app-summary-title">Summary</h3>

        <div className="app-summary-text">

          <p>• Total Players: {playerStats.length}</p>

          <p>• Total Tournaments: {tournaments.length}</p>

          <p>• Most Active: {playerStats[0]?.name} ({playerStats[0]?.totalTournaments} tournaments)</p>

        </div>

      </div>

    </div>

  );

}



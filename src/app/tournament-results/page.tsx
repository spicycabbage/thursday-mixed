'use client';

import { useState, useLayoutEffect } from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageShell } from '@/components/PageShell';
import TeamSummaryModal from '@/components/matches/TeamSummaryModal';
import { EVENT_TYPES, EVENT_TYPE_LABELS, Tournament, eventTypeOf, getRankedTeams, type EventType } from '@/lib/gameLogic';

function loadLocalTournaments(): Tournament[] {
  if (typeof window === 'undefined') return [];

  const history = JSON.parse(localStorage.getItem('tournamentHistory') || '[]') as Tournament[];
  return history.filter((tournament) => tournament.isFinalized);
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
  const [eventType, setEventType] = useState<EventType>('XD');
  const [syncing, setSyncing] = useState(true);
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
  const visible = tournaments.filter((tournament) => eventTypeOf(tournament.eventType) === eventType);

  return (
    <PageShell>
      <PageCard className="results-page-card">
        <div className="results-page-top">
          <PageHeader title="Past Tournaments" icon={<TrophyIcon className="w-5 h-5" />} />
          <nav className="event-type-tabs" aria-label="Event type">
            {EVENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`event-type-tab ${eventType === type ? 'event-type-tab-active' : ''}`}
                aria-current={eventType === type ? 'page' : undefined}
                onClick={() => setEventType(type)}
              >
                {type}
              </button>
            ))}
          </nav>
        </div>

        <PageContent>
          {loadError && <div className="app-alert-error mb-4">{loadError}</div>}

          {showSkeleton ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading tournament results">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="results-card-skeleton" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="app-empty-state">
              <TrophyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="page-title">No {EVENT_TYPE_LABELS[eventType]} Results</h3>
              <p className="text-gray-500 mb-6">
                Finalized {EVENT_TYPE_LABELS[eventType]} tournaments show up here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="tab-meta">
                {visible.length} {eventType} tournament{visible.length !== 1 ? 's' : ''}
              </p>
              {visible.map((tournament) => (
                <TournamentResultCard
                  key={tournament.id}
                  tournament={tournament}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </PageContent>
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
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const rankedTeams = getRankedTeams(tournament);
  const winner = rankedTeams[0];
  const title = tournament.name?.trim();
  const getPlayerName = (id: number) => tournament.players.find((p) => p.id === id)?.name ?? '';

  return (
    <div className="tab-card results-card">
      <div
        className="p-4 bg-gray-900 cursor-pointer hover:bg-gray-800 transition-colors min-h-[4.5rem]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="results-summary">
          <div className="results-summary-date">
            <div>
              <p className="font-semibold text-white">{title || formatDate(tournament.date)}</p>
              {title && <p className="text-xs font-bold text-gray-300">{formatDate(tournament.date)}</p>}
            </div>
          </div>
          <div className="results-summary-winner">
            <p className="results-summary-players">
              {winner ? `${getPlayerName(winner.player1Id)} & ${getPlayerName(winner.player2Id)}` : ''}
            </p>
            <p className="results-summary-record">
              <span>
                {winner?.wins}-{winner?.losses}
              </span>
              <span>
                {winner && winner.pointDiff > 0 ? '+' : ''}
                {winner?.pointDiff}
              </span>
            </p>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-4 border-t bg-white">
          <h4 className="font-semibold mb-1 text-gray-800">Final Team Standings</h4>
          <p className="results-standing-hint">Tap a player for their matches</p>
          <div className="space-y-2">
            {rankedTeams.map((team) => (
              <div key={team.id} className="results-standing-row">
                <span className="results-standing-rank">{team.rank}</span>
                <div className="results-standing-team">
                  <span className={team.rank === 1 ? 'font-semibold text-yellow-600' : 'text-gray-800'}>
                    Team {team.label}
                  </span>
                  <p>
                    <button type="button" onClick={() => setSelectedTeamId(team.id)}>
                      {getPlayerName(team.player1Id)}
                    </button>
                    <span aria-hidden="true"> & </span>
                    <button type="button" onClick={() => setSelectedTeamId(team.id)}>
                      {getPlayerName(team.player2Id)}
                    </button>
                  </p>
                </div>
                <span className="results-standing-record">
                  {team.wins}-{team.losses}
                </span>
                <span className="results-standing-diff">
                  {team.pointDiff > 0 ? '+' : ''}
                  {team.pointDiff}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <TeamSummaryModal
        tournament={tournament}
        teamId={selectedTeamId}
        onClose={() => setSelectedTeamId(null)}
      />
    </div>
  );
}

'use client';

import { useState, useLayoutEffect } from 'react';
import { TrophyIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageShell } from '@/components/PageShell';
import TeamSummaryModal from '@/components/matches/TeamSummaryModal';
import { EVENT_TYPES, EVENT_TYPE_LABELS, Tournament, eventTypeOf, formatSideNames, getRankedTeams, isSinglesEvent, type EventType, type Team } from '@/lib/gameLogic';

const MEDALS = {
  1: { label: 'Gold medal', fill: '#f5c518', edge: '#a16207', ribbon: '#eab308' },
  2: { label: 'Silver medal', fill: '#e5e7eb', edge: '#6b7280', ribbon: '#9ca3af' },
  3: { label: 'Bronze medal', fill: '#e8a15a', edge: '#9a3412', ribbon: '#c2410c' },
} as const;

type MedalPlace = keyof typeof MEDALS;

function MedalIcon({ place }: { place: MedalPlace }) {
  const medal = MEDALS[place];
  return (
    <svg viewBox="0 0 24 24" className="results-medal" role="img" aria-label={medal.label}>
      <path d="M8 2.2h2.7L12 8.6H9.1L8 2.2z" fill={medal.ribbon} />
      <path d="M16 2.2h-2.7L12 8.6h2.9L16 2.2z" fill={medal.edge} />
      <circle cx="12" cy="15.1" r="6.2" fill={medal.edge} />
      <circle cx="12" cy="15.1" r="5" fill={medal.fill} />
      <circle cx="12" cy="15.1" r="3.5" fill="none" stroke={medal.edge} strokeWidth="0.7" />
      <text x="12" y="16.7" textAnchor="middle" fontSize="5" fontWeight="700" fill={medal.edge}>
        {place}
      </text>
    </svg>
  );
}

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
  const [eventType, setEventType] = useState<EventType>('MD');
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

function teamNames(tournament: Tournament, team: Team) {
  const nameOf = (id: number) => tournament.players.find((player) => player.id === id)?.name ?? '';
  return formatSideNames(nameOf(team.player1Id), nameOf(team.player2Id));
}

function TournamentResultCard({ tournament, formatDate }: TournamentResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const rankedTeams = getRankedTeams(tournament);
  const podium = rankedTeams.slice(0, 3);
  const rest = rankedTeams.slice(3);
  const title = tournament.name?.trim();
  const getPlayerName = (id: number) => tournament.players.find((p) => p.id === id)?.name ?? '';

  return (
    <div className="tab-card results-card">
      <div className="results-podium">
        <div className="results-podium-header">
          <p className="results-podium-date">{formatDate(tournament.date)}</p>
          {title && <p className="results-podium-name">{title}</p>}
        </div>
        <ol className="results-podium-list">
          {podium.map((team, index) => {
            const place = (index + 1) as MedalPlace;
            return (
              <li key={team.id} className="results-podium-row">
                <MedalIcon place={place} />
                <button type="button" className="results-podium-players" onClick={() => setSelectedTeamId(team.id)}>
                  {teamNames(tournament, team)}
                </button>
                <span className="results-podium-record">
                  {team.wins}-{team.losses}
                </span>
                <span className="results-podium-diff">
                  {team.pointDiff > 0 ? '+' : ''}
                  {team.pointDiff}
                </span>
              </li>
            );
          })}
        </ol>
        {rest.length > 0 && (
          <button type="button" className="results-podium-more" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide full standings' : 'Full standings'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="p-4 border-t bg-white">
          <h4 className="font-semibold mb-1 text-gray-800">
            {isSinglesEvent(tournament.eventType) ? 'Final Player Standings' : 'Final Team Standings'}
          </h4>
          <p className="results-standing-hint">Tap a player for their matches</p>
          <div className="space-y-2">
            {rest.map((team) => (
              <div key={team.id} className="results-standing-row">
                <span className="results-standing-rank">{team.rank}</span>
                <div className="results-standing-team">
                  <span className={team.rank === 1 ? 'font-semibold text-yellow-600' : 'text-gray-800'}>
                    {isSinglesEvent(tournament.eventType) ? 'Player' : 'Team'} {team.label}
                  </span>
                  <p>
                    <button type="button" onClick={() => setSelectedTeamId(team.id)}>
                      {getPlayerName(team.player1Id)}
                    </button>
                    {getPlayerName(team.player2Id) ? (
                      <>
                        <span aria-hidden="true"> & </span>
                        <button type="button" onClick={() => setSelectedTeamId(team.id)}>
                          {getPlayerName(team.player2Id)}
                        </button>
                      </>
                    ) : null}
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

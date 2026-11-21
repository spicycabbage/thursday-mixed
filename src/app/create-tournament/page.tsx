'use client';

import { useState, useEffect, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import AdminUnlock from '@/components/AdminUnlock';
import { PageCard, PageContent, PageHeader, PageLoading, PageShell } from '@/components/PageShell';
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  TEAM_LABELS,
  TEAM_COUNTS,
  canonicalName,
  duplicateNameKeys,
  nameKey,
  normalizeName,
  matchCountForTeams,
  courtCountForTeams,
  type EventType,
  type TeamCount,
} from '@/lib/gameLogic';
import { markTournamentAdmin } from '@/lib/viewerRole';

interface TeamInput {
  player1: string;
  player2: string;
}

export default function CreateTournamentPage() {
  const router = useRouter();
  const [tournamentDate, setTournamentDate] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [eventType, setEventType] = useState<EventType>('XD');
  const [teamCount, setTeamCount] = useState<TeamCount>(6);
  const [teams, setTeams] = useState<TeamInput[]>(
    Array.from({ length: 6 }, () => ({ player1: '', player2: '' }))
  );
  const [filledCount, setFilledCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [adminGate, setAdminGate] = useState<'loading' | 'locked' | 'open'>('loading');
  const [suggestions, setSuggestions] = useState<string[][][]>(
    Array.from({ length: 6 }, () => [[], []])
  );
  const [knownNames, setKnownNames] = useState<string[]>([]);

  const handleTeamCountChange = (count: TeamCount) => {
    setTeamCount(count);
    setTeams((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? { player1: '', player2: '' })
    );
    setSuggestions((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? [[], []])
    );
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/session', { cache: 'no-store' });
        const data = res.ok ? await res.json() : null;
        if (!ignore) setAdminGate(data?.admin ? 'open' : 'locked');
      } catch {
        if (!ignore) setAdminGate('locked');
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    setTournamentDate(today);
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch('/api/players/names', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!ignore && Array.isArray(data?.players)) setKnownNames(data.players);
      } catch {}
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const filled = teams.reduce(
      (count, team) =>
        count + (team.player1.trim() ? 1 : 0) + (team.player2.trim() ? 1 : 0),
      0
    );
    setFilledCount(filled);
  }, [teams]);

  const getAllUsedNames = (excludeTeam?: number, excludeSlot?: number) =>
    teams.flatMap((team, ti) =>
      [team.player1, team.player2]
        .filter((_, si) => ti !== excludeTeam || si !== excludeSlot)
        .filter((n) => n.trim())
        .map((n) => nameKey(n))
    );

  const getFilteredSuggestions = (value: string, teamIndex: number, slot: number) => {
    if (value.length < 1) return [];
    const usedNames = getAllUsedNames(teamIndex, slot);
    const valueKey = nameKey(value);
    const starts = knownNames.filter(
      (name) => nameKey(name).startsWith(valueKey) && !usedNames.includes(nameKey(name))
    );
    const contains = knownNames.filter(
      (name) =>
        !nameKey(name).startsWith(valueKey) &&
        nameKey(name).includes(valueKey) &&
        !usedNames.includes(nameKey(name))
    );
    return [...starts, ...contains].slice(0, 6);
  };

  const handlePlayerChange = (teamIndex: number, slot: 0 | 1, value: string) => {
    const limited = value.slice(0, 24);
    const newTeams = [...teams];
    if (slot === 0) newTeams[teamIndex] = { ...newTeams[teamIndex], player1: limited };
    else newTeams[teamIndex] = { ...newTeams[teamIndex], player2: limited };
    setTeams(newTeams);

    const newSuggestions = [...suggestions];
    newSuggestions[teamIndex] = [...newSuggestions[teamIndex]];
    newSuggestions[teamIndex][slot] = getFilteredSuggestions(limited, teamIndex, slot);
    setSuggestions(newSuggestions);
  };

  const handleSuggestionClick = (teamIndex: number, slot: 0 | 1, suggestion: string) => {
    handlePlayerChange(teamIndex, slot, suggestion);
    const newSuggestions = [...suggestions];
    newSuggestions[teamIndex] = [[], []];
    setSuggestions(newSuggestions);
  };

  const handleStartTournament = async () => {
    if (filledCount !== teamCount * 2 || isCreating) return;
    setIsCreating(true);
    const normalizedTeams = teams.map((team) => ({
      player1: normalizeName(team.player1),
      player2: normalizeName(team.player2),
    }));
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teams: normalizedTeams,
          date: tournamentDate,
          name: tournamentName.trim(),
          eventType,
        }),
      });
      if (res.status === 401) {
        setAdminGate('locked');
        setIsCreating(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to create tournament');
      const tournament = await res.json();
      try {
        localStorage.setItem('currentTournament', JSON.stringify(tournament));
        markTournamentAdmin(tournament.id);
      } catch {}
      router.push(`/tournament/${tournament.id}`);
    } catch {
      setIsCreating(false);
      alert('Unable to create tournament right now. Please try again.');
    }
  };

  const focusPlayerInput = (teamIndex: number, slot: 0 | 1) => {
    document
      .querySelector<HTMLInputElement>(
        `input[data-registration-player="${teamIndex}-${slot}"]`
      )
      ?.focus();
  };

  const focusNextPlayerInput = (teamIndex: number, slot: 0 | 1) => {
    if (slot === 0) {
      focusPlayerInput(teamIndex, 1);
      return;
    }
    if (teamIndex < teams.length - 1) {
      focusPlayerInput(teamIndex + 1, 0);
    }
  };

  const handlePlayerKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    teamIndex: number,
    slot: 0 | 1
  ) => {
    if (e.key !== 'Tab' || e.shiftKey) return;

    const slotSuggestions = suggestions[teamIndex]?.[slot] ?? [];
    if (slotSuggestions.length === 0) return;

    e.preventDefault();
    const newSuggestions = [...suggestions];
    newSuggestions[teamIndex] = [[], []];
    setSuggestions(newSuggestions);
    focusNextPlayerInput(teamIndex, slot);
  };

  const enteredNames = teams.flatMap((team) => [team.player1, team.player2]);
  const duplicateKeys = duplicateNameKeys(enteredNames);
  const isStartDisabled =
    filledCount < teamCount * 2 || duplicateKeys.length > 0;
  const lastLabel = TEAM_LABELS[teamCount - 1];

  if (adminGate === 'loading') {
    return <PageLoading message="Checking admin..." className="page-shell-registration" />;
  }

  if (adminGate === 'locked') {
    return (
      <PageShell className="page-shell-registration">
        <PageCard className="page-card-registration">
          <PageHeader title="Admin" icon={<UserGroupIcon className="w-5 h-5" />} />
          <PageContent>
            <p className="page-subtitle mb-4">Enter your code to create a tournament.</p>
            <AdminUnlock onUnlocked={() => setAdminGate('open')} />
          </PageContent>
        </PageCard>
      </PageShell>
    );
  }

  return (
    <PageShell className="page-shell-registration">
      <PageCard className="page-card-registration">
        <PageHeader
          className="registration-header"
          title="Create Tournament"
          icon={<UserGroupIcon className="w-5 h-5" />}
          right={
            <div className="text-sm text-gray-600 shrink-0 ml-2">
              <span className="font-semibold">{filledCount}/{teamCount * 2}</span>
            </div>
          }
        />

        <div className="registration-toolbar page-section-divider px-4 py-4">
          <div className="mb-4">
            <label className="app-label mb-1">Event</label>
            <div className="flex gap-2">
              {EVENT_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setEventType(type)}
                  className={`rounded-lg border-2 px-3 py-2 text-left ${
                    eventType === type
                      ? 'border-blue-900 bg-blue-600 text-white'
                      : 'border-slate-700 bg-white text-slate-900'
                  }`}
                >
                  <span className="block text-sm font-bold">{type}</span>
                  <span
                    className={`block text-xs font-semibold ${
                      eventType === type ? 'text-blue-100' : 'text-slate-700'
                    }`}
                  >
                    {EVENT_TYPE_LABELS[type]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4">
            <label className="app-label mb-1" htmlFor="tournament-name">
              Tournament Name
            </label>
            <input
              id="tournament-name"
              type="text"
              value={tournamentName}
              onChange={(e) => setTournamentName(e.target.value.slice(0, 40))}
              className="app-input"
              placeholder="Saturday Open"
              maxLength={40}
              autoComplete="off"
            />
          </div>
          <div className="registration-toolbar-inner">
            <div>
              <label className="app-label mb-1">Teams</label>
              <div className="flex gap-2">
                {TEAM_COUNTS.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => handleTeamCountChange(count)}
                    className={`rounded-lg border-2 px-3 py-2 text-left ${
                      teamCount === count
                        ? 'border-blue-900 bg-blue-600 text-white'
                        : 'border-slate-700 bg-white text-slate-900'
                    }`}
                  >
                    <span className="block text-sm font-bold">{count} teams</span>
                    <span
                      className={`block text-xs font-semibold ${
                        teamCount === count ? 'text-blue-100' : 'text-slate-700'
                      }`}
                    >
                      {matchCountForTeams(count)} games
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="app-label mb-1">Tournament Date</label>
              <input
                type="date"
                value={tournamentDate}
                onChange={(e) => setTournamentDate(e.target.value)}
                className="app-input"
              />
            </div>
          </div>
        </div>

        <PageContent className="registration-page-content">
          <p className="page-subtitle text-center mb-4 md:text-left md:mb-6">
            Register {teamCount} teams (A–{lastLabel}), 2 players each. {matchCountForTeams(teamCount)} games, round robin on {courtCountForTeams(teamCount)} courts.
          </p>

          <div className="registration-teams-grid">
            {teams.map((team, teamIndex) => (
              <div key={TEAM_LABELS[teamIndex] ?? teamIndex} className="tab-card registration-team-card">
                <div className="registration-team-header flex items-center">
                  <div className="registration-team-badge player-button flex items-center justify-center mr-2 text-sm font-bold">
                    {TEAM_LABELS[teamIndex]}
                  </div>
                  <span className="registration-team-label font-semibold text-gray-700">Team {TEAM_LABELS[teamIndex]}</span>
                </div>
                <div className="registration-team-fields">
                  {([0, 1] as const).map((slot) => (
                    <div key={slot} className="relative">
                      <input
                        type="text"
                        data-registration-player={`${teamIndex}-${slot}`}
                        value={slot === 0 ? team.player1 : team.player2}
                        onChange={(e) => handlePlayerChange(teamIndex, slot, e.target.value)}
                        onKeyDown={(e) => handlePlayerKeyDown(e, teamIndex, slot)}
                        maxLength={24}
                        onFocus={() => {
                          const val = slot === 0 ? team.player1 : team.player2;
                          const newSuggestions = [...suggestions];
                          newSuggestions[teamIndex] = [...newSuggestions[teamIndex]];
                          newSuggestions[teamIndex][slot] = getFilteredSuggestions(val, teamIndex, slot);
                          setSuggestions(newSuggestions);
                        }}
                        onBlur={(e) => {
                          const trimmed = canonicalName(e.target.value, knownNames);
                          if (trimmed !== e.target.value) {
                            handlePlayerChange(teamIndex, slot, trimmed);
                          }
                          setTimeout(() => {
                            const newSuggestions = [...suggestions];
                            newSuggestions[teamIndex] = [[], []];
                            setSuggestions(newSuggestions);
                          }, 150);
                        }}
                        placeholder={`Player ${slot + 1}`}
                        className={`app-input ${
                          duplicateKeys.includes(nameKey(slot === 0 ? team.player1 : team.player2))
                            ? '!border-red-500'
                            : ''
                        }`}
                        autoComplete="off"
                      />
                      {suggestions[teamIndex]?.[slot]?.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-lg shadow-lg mt-1">
                          {suggestions[teamIndex][slot].map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleSuggestionClick(teamIndex, slot, suggestion)}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {duplicateKeys.length > 0 && (
            <p className="app-alert-error mt-4">
              Each player needs a unique name so their record stays in one place.
            </p>
          )}

          <div className="registration-footer mt-6">
            <div className="registration-footer-inner">
              <button
                type="button"
                onClick={handleStartTournament}
                disabled={isStartDisabled || isCreating}
                className={
                  isStartDisabled || isCreating ? 'app-btn-disabled' : 'app-btn-success'
                }
              >
                {isCreating ? 'Creating Tournament...' : 'Submit'}
              </button>
            </div>
          </div>
        </PageContent>
      </PageCard>
    </PageShell>
  );
}

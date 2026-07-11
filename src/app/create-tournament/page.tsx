'use client';

import { useState, useEffect, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { PageCard, PageContent, PageHeader, PageShell } from '@/components/PageShell';
import { DEFAULT_PLAYER_NAMES, TEAM_LABELS, NUM_TEAMS, createTournament, nameKey, normalizeName } from '@/lib/gameLogic';

interface TeamInput {
  player1: string;
  player2: string;
}

export default function CreateTournamentPage() {
  const router = useRouter();
  const [tournamentDate, setTournamentDate] = useState('');
  const [teams, setTeams] = useState<TeamInput[]>(
    TEAM_LABELS.map(() => ({ player1: '', player2: '' }))
  );
  const [filledCount, setFilledCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[][][]>(
    TEAM_LABELS.map(() => [[], []])
  );

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
    return DEFAULT_PLAYER_NAMES.filter(
      (name) =>
        nameKey(name).startsWith(valueKey) &&
        !usedNames.includes(nameKey(name))
    ).slice(0, 3);
  };

  const handlePlayerChange = (teamIndex: number, slot: 0 | 1, value: string) => {
    const limited = value.slice(0, 12);
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
    if (filledCount !== NUM_TEAMS * 2 || isCreating) return;
    setIsCreating(true);
    const normalizedTeams = teams.map((team) => ({
      player1: normalizeName(team.player1),
      player2: normalizeName(team.player2),
    }));
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: normalizedTeams, date: tournamentDate }),
      });
      if (res.status === 409) {
        alert('An active tournament already exists. Please finalize it first, or use it.');
        setIsCreating(false);
        return;
      }
      let tournament;
      if (res.ok) {
        tournament = await res.json();
      } else if (res.status === 500) {
        tournament = createTournament(normalizedTeams, tournamentDate);
      } else {
        throw new Error('Failed to create tournament');
      }
      try {
        localStorage.setItem('currentTournament', JSON.stringify(tournament));
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

  const isStartDisabled = filledCount < NUM_TEAMS * 2;

  return (
    <PageShell className="page-shell-registration">
      <PageCard className="page-card-registration">
        <PageHeader
          className="registration-header"
          title="Create Tournament"
          icon={<UserGroupIcon className="w-5 h-5" />}
          right={
            <div className="text-sm text-gray-600 shrink-0 ml-2">
              <span className="font-semibold">{filledCount}/{NUM_TEAMS * 2}</span>
            </div>
          }
        />

        <div className="registration-toolbar page-section-divider px-4 py-4">
          <div className="registration-toolbar-inner">
            <label className="app-label mb-1">Tournament Date</label>
            <input
              type="date"
              value={tournamentDate}
              onChange={(e) => setTournamentDate(e.target.value)}
              className="app-input"
            />
          </div>
        </div>

        <PageContent className="registration-page-content">
          <p className="page-subtitle text-center mb-4 md:text-left md:mb-6">
            Register 6 teams (A–F), 2 players each. Round robin on 2 courts.
          </p>

          <div className="registration-teams-grid">
            {teams.map((team, teamIndex) => (
              <div key={TEAM_LABELS[teamIndex]} className="tab-card registration-team-card">
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
                        maxLength={12}
                        onFocus={() => {
                          const val = slot === 0 ? team.player1 : team.player2;
                          const newSuggestions = [...suggestions];
                          newSuggestions[teamIndex] = [...newSuggestions[teamIndex]];
                          newSuggestions[teamIndex][slot] = getFilteredSuggestions(val, teamIndex, slot);
                          setSuggestions(newSuggestions);
                        }}
                        onBlur={(e) => {
                          const trimmed = normalizeName(e.target.value);
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
                        className="app-input"
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

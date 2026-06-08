'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Tournament, NUM_ROUNDS } from '@/lib/gameLogic';
import TabPanel from '@/components/TabPanel';
import { TrophyIcon } from '@heroicons/react/24/outline';
import MatchCard from '@/components/matches/MatchCard';
import MatchesDesktopLayout from '@/components/matches/MatchesDesktopLayout';

interface MatchesTabProps {
  tournament: Tournament;
  onScoreUpdate: (matchId: number, scoreA: number, scoreB: number, isEdit?: boolean) => void;
  onFinalize?: () => void;
}

export default function MatchesTab({ tournament, onScoreUpdate, onFinalize }: MatchesTabProps) {
  const [selectedRound, setSelectedRound] = useState(tournament.currentRound);
  const [autoFollow, setAutoFollow] = useState(true);

  useEffect(() => {
    if (autoFollow) setSelectedRound(tournament.currentRound);
  }, [tournament.currentRound, autoFollow]);

  const getRoundStatus = useCallback(
    (round: number) => {
      const roundMatches = tournament.matches.filter((m) => m.round === round);
      const allCompleted = roundMatches.every((m) => m.completed);
      if (round === tournament.currentRound && !allCompleted) return 'current';
      if (allCompleted) return 'completed';
      return 'pending';
    },
    [tournament.matches, tournament.currentRound]
  );

  const canSelectRound = useCallback(
    (round: number) => getRoundStatus(round) !== 'pending',
    [getRoundStatus]
  );

  const currentRoundMatches = useMemo(
    () => tournament.matches.filter((m) => m.round === selectedRound),
    [tournament.matches, selectedRound]
  );

  const roundToolbar = (
    <div className="round-nav">
      {Array.from({ length: NUM_ROUNDS }, (_, i) => i + 1).map((round) => {
        const status = getRoundStatus(round);
        const isSelected = round === selectedRound;
        const canSelect = canSelectRound(round);
        return (
          <button
            key={round}
            type="button"
            onClick={() => {
              if (!canSelect) return;
              setSelectedRound(round);
              setAutoFollow(round === tournament.currentRound);
            }}
            disabled={!canSelect}
            className={`round-button ${isSelected ? 'round-selected' : ''} ${
              status === 'current'
                ? 'round-current'
                : status === 'completed'
                  ? 'round-completed'
                  : 'round-pending'
            }`}
          >
            {round}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="matches-tab-mobile">
        <TabPanel
          title="Matches"
          subtitle={`Round ${selectedRound}`}
          icon={<TrophyIcon className="w-5 h-5 text-gray-900 shrink-0" />}
          toolbar={roundToolbar}
        >
          <div className="space-y-3">
            {currentRoundMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                tournament={tournament}
                onScoreUpdate={onScoreUpdate}
              />
            ))}
          </div>
        </TabPanel>
      </div>

      <MatchesDesktopLayout
        tournament={tournament}
        onScoreUpdate={onScoreUpdate}
        onFinalize={onFinalize}
      />
    </>
  );
}

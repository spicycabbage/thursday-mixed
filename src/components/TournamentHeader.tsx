'use client';

import { PencilIcon } from '@heroicons/react/24/outline';

interface TournamentHeaderProps {
  date: string;
  activeTab: 'players' | 'matches' | 'rank';
  onTabChange: (tab: 'players' | 'matches' | 'rank') => void;
  onEditPlayers?: () => void;
  editPlayersDisabled?: boolean;
  editPlayersTitle?: string;
}

export default function TournamentHeader({
  date,
  activeTab,
  onTabChange,
  onEditPlayers,
  editPlayersDisabled = false,
  editPlayersTitle = 'Edit players',
}: TournamentHeaderProps) {
  const formatDate = (dateString: string) => {
    const [y, m, d] = dateString.split('-').map(Number);
    const middayUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0));
    return middayUtc.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const tabClass = (tab: 'players' | 'matches' | 'rank') =>
    `flex-1 py-3 text-center font-semibold transition-colors border-b-2 ${
      activeTab === tab
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-gray-200 text-gray-900 border-transparent hover:bg-gray-300'
    }`;

  return (
    <div className="shrink-0 border-b border-gray-300">
      <div className="tournament-header-bar px-4 py-2.5 border-b border-gray-300 bg-white">
        <div className="text-base text-gray-900 font-bold tournament-header-date">
          {formatDate(date)}
        </div>
        {onEditPlayers && (
          <button
            type="button"
            onClick={onEditPlayers}
            disabled={editPlayersDisabled}
            className="tournament-header-edit-btn hidden md:flex"
            title={editPlayersTitle}
            aria-label={editPlayersTitle}
          >
            <PencilIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="tournament-tab-nav flex bg-white">
        <button type="button" onClick={() => onTabChange('players')} className={tabClass('players')}>
          Players
        </button>
        <button type="button" onClick={() => onTabChange('matches')} className={tabClass('matches')}>
          Matches
        </button>
        <button type="button" onClick={() => onTabChange('rank')} className={tabClass('rank')}>
          Rank
        </button>
      </div>
    </div>
  );
}

'use client';

import { Tournament } from '@/lib/gameLogic';
import { PencilIcon } from '@heroicons/react/24/outline';
import TabPanel from '@/components/TabPanel';
import PlayerListEditor from '@/components/PlayerListEditor';

interface PlayersTabProps {
  tournament: Tournament;
  onUpdateTeams: (teams: { player1: string; player2: string }[]) => void;
  isFinalized: boolean;
  isEditable: boolean;
}

export default function PlayersTab({
  tournament,
  onUpdateTeams,
  isFinalized,
  isEditable,
}: PlayersTabProps) {
  const statusLabel = isFinalized
    ? 'Finalized'
    : !isEditable
      ? 'Locked'
      : '6 teams';

  return (
    <TabPanel
      title="Teams"
      subtitle={statusLabel}
      icon={<PencilIcon className="w-5 h-5 text-gray-900 shrink-0" />}
      toolbar={<p className="tab-toolbar-hint">2 players per team</p>}
    >
      <PlayerListEditor
        tournament={tournament}
        onUpdateTeams={onUpdateTeams}
        isFinalized={isFinalized}
        isEditable={isEditable}
        layout="mobile"
      />
    </TabPanel>
  );
}

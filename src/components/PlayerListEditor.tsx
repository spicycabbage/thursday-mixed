'use client';

import { useState, useEffect } from 'react';
import { Tournament, TEAM_LABELS } from '@/lib/gameLogic';
import { PencilIcon } from '@heroicons/react/24/outline';

interface PlayerListEditorProps {
  tournament: Tournament;
  onUpdateTeams: (teams: { player1: string; player2: string }[]) => void;
  isFinalized: boolean;
  isEditable: boolean;
  layout?: 'mobile' | 'desktop';
  onClose?: () => void;
  autoEdit?: boolean;
}

export default function PlayerListEditor({
  tournament,
  onUpdateTeams,
  isFinalized,
  isEditable,
  layout = 'mobile',
  onClose,
  autoEdit = false,
}: PlayerListEditorProps) {
  const [isEditing, setIsEditing] = useState(autoEdit);
  const [editedTeams, setEditedTeams] = useState(
    tournament.teams.map((team) => {
      const p1 = tournament.players.find((p) => p.id === team.player1Id)?.name ?? '';
      const p2 = tournament.players.find((p) => p.id === team.player2Id)?.name ?? '';
      return { player1: p1, player2: p2 };
    })
  );

  useEffect(() => {
    if (!isEditing) {
      setEditedTeams(
        tournament.teams.map((team) => {
          const p1 = tournament.players.find((p) => p.id === team.player1Id)?.name ?? '';
          const p2 = tournament.players.find((p) => p.id === team.player2Id)?.name ?? '';
          return { player1: p1, player2: p2 };
        })
      );
    }
  }, [tournament, isEditing]);

  const handleSaveEdit = () => {
    onUpdateTeams(editedTeams);
    setIsEditing(false);
    onClose?.();
  };

  const handleCancelEdit = () => {
    setEditedTeams(
      tournament.teams.map((team) => {
        const p1 = tournament.players.find((p) => p.id === team.player1Id)?.name ?? '';
        const p2 = tournament.players.find((p) => p.id === team.player2Id)?.name ?? '';
        return { player1: p1, player2: p2 };
      })
    );
    setIsEditing(false);
    if (autoEdit) onClose?.();
  };

  const isValidTeams = () =>
    editedTeams.every((t) => t.player1.trim() && t.player2.trim());

  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  const isDesktop = layout === 'desktop';
  const canEdit = isEditable && !isFinalized;

  return (
    <div className={isDesktop ? 'player-list-editor-desktop' : 'player-list-editor-mobile'}>
      <div className={isDesktop ? 'player-list-editor-grid' : 'space-y-3'}>
        {tournament.teams.map((team, index) => (
          <div
            key={team.id}
            className={isDesktop ? 'player-list-editor-card' : 'tab-entry-row tab-entry-row-a'}
          >
            <div className={`team-badge ${isDesktop ? 'player-list-editor-badge' : ''}`}>
              {TEAM_LABELS[index]}
            </div>
            <div className="flex-1 min-w-0">
              {!isDesktop && (
                <div className="font-bold text-gray-900 text-base mb-1">
                  Team {TEAM_LABELS[index]}
                </div>
              )}
              {isEditing ? (
                <div className={isDesktop ? 'player-list-editor-inputs' : 'space-y-2 mt-2'}>
                  <input
                    type="text"
                    value={editedTeams[index]?.player1 ?? ''}
                    onChange={(e) => {
                      const next = [...editedTeams];
                      next[index] = { ...next[index], player1: e.target.value };
                      setEditedTeams(next);
                    }}
                    className="app-input"
                    placeholder="Player 1"
                  />
                  <input
                    type="text"
                    value={editedTeams[index]?.player2 ?? ''}
                    onChange={(e) => {
                      const next = [...editedTeams];
                      next[index] = { ...next[index], player2: e.target.value };
                      setEditedTeams(next);
                    }}
                    className="app-input"
                    placeholder="Player 2"
                  />
                </div>
              ) : (
                <div className={isDesktop ? 'player-list-editor-names' : 'tab-player-names'}>
                  <div>{getPlayerName(team.player1Id)}</div>
                  <div>{getPlayerName(team.player2Id)}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={isDesktop ? 'player-list-editor-actions' : 'space-y-3'}>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => canEdit && setIsEditing(true)}
            disabled={!canEdit}
            className={!canEdit ? 'tab-btn-disabled' : 'tab-btn-primary'}
          >
            <PencilIcon className="w-5 h-5 inline mr-2" />
            {isFinalized ? 'Tournament Finalized' : !isEditable ? 'Teams Locked' : 'Update Teams'}
          </button>
        ) : (
          <div className={isDesktop ? 'player-list-editor-edit-actions' : 'space-y-3'}>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!isValidTeams()}
              className={isValidTeams() ? 'tab-btn-success' : 'tab-btn-disabled'}
            >
              Save Changes
            </button>
            <button type="button" onClick={handleCancelEdit} className="tab-btn-muted">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Tournament, TEAM_LABELS, duplicateNameKeys, getCourtNumbers, isSinglesEvent, normalizeCourtNumbers, normalizeName } from '@/lib/gameLogic';
import { PencilIcon } from '@heroicons/react/24/outline';

interface PlayerListEditorProps {
  tournament: Tournament;
  onUpdateTeams: (teams: { player1: string; player2: string }[]) => void;
  isFinalized: boolean;
  isEditable: boolean;
  layout?: 'mobile' | 'desktop';
  onClose?: () => void;
  autoEdit?: boolean;
  canEditCourts?: boolean;
  onSaveCourtNumbers?: (courtNumbers: number[]) => Promise<void> | void;
}

export default function PlayerListEditor({
  tournament,
  onUpdateTeams,
  isFinalized,
  isEditable,
  layout = 'mobile',
  onClose,
  autoEdit = false,
  canEditCourts = false,
  onSaveCourtNumbers,
}: PlayerListEditorProps) {
  const currentCourts = getCourtNumbers(tournament);
  const [draftCourts, setDraftCourts] = useState<number[]>(currentCourts);
  const [savingCourts, setSavingCourts] = useState(false);
  const [courtError, setCourtError] = useState<string | null>(null);
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

  useEffect(() => {
    setDraftCourts(currentCourts);
    setCourtError(null);
  }, [currentCourts.join('-')]);

  const singles = isSinglesEvent(tournament.eventType);
  const duplicateKeys = duplicateNameKeys(
    editedTeams.flatMap((team) => (singles ? [team.player1] : [team.player1, team.player2]))
  );

  const handleSaveEdit = () => {
    if (duplicateKeys.length > 0) return;
    onUpdateTeams(
      editedTeams.map((team) => ({
        player1: normalizeName(team.player1),
        player2: singles ? '' : normalizeName(team.player2),
      }))
    );
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
    editedTeams.every((t) => t.player1.trim() && (singles || t.player2.trim()));

  const getPlayerName = (playerId: number) =>
    tournament.players.find((p) => p.id === playerId)?.name ?? '';

  const isDesktop = layout === 'desktop';
  const canEdit = isEditable && !isFinalized;
  const showCourtEditor = canEditCourts && !!onSaveCourtNumbers && !isFinalized;
  const normalizedDraft = normalizeCourtNumbers(draftCourts, tournament.teams.length);
  const courtsUnchanged =
    currentCourts.length === draftCourts.length && currentCourts.every((court, index) => court === draftCourts[index]);

  const handleSaveCourts = async () => {
    if (!onSaveCourtNumbers || !normalizedDraft || courtsUnchanged || savingCourts) return;
    setSavingCourts(true);
    setCourtError(null);
    try {
      await onSaveCourtNumbers(normalizedDraft);
    } catch (error) {
      setCourtError(error instanceof Error ? error.message : 'Could not update court numbers.');
    } finally {
      setSavingCourts(false);
    }
  };

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
                  {singles ? 'Player' : 'Team'} {TEAM_LABELS[index]}
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
                    onBlur={(e) => {
                      const trimmed = normalizeName(e.target.value);
                      if (trimmed !== e.target.value) {
                        const next = [...editedTeams];
                        next[index] = { ...next[index], player1: trimmed };
                        setEditedTeams(next);
                      }
                    }}
                    className="app-input"
                    placeholder={singles ? 'Player name' : 'Player 1'}
                  />
                  {!singles && (
                  <input
                    type="text"
                    value={editedTeams[index]?.player2 ?? ''}
                    onChange={(e) => {
                      const next = [...editedTeams];
                      next[index] = { ...next[index], player2: e.target.value };
                      setEditedTeams(next);
                    }}
                    onBlur={(e) => {
                      const trimmed = normalizeName(e.target.value);
                      if (trimmed !== e.target.value) {
                        const next = [...editedTeams];
                        next[index] = { ...next[index], player2: trimmed };
                        setEditedTeams(next);
                      }
                    }}
                    className="app-input"
                    placeholder="Player 2"
                  />
                  )}
                </div>
              ) : (
                <div className={isDesktop ? 'player-list-editor-names' : 'tab-player-names'}>
                  <div>{getPlayerName(team.player1Id)}</div>
                  {!singles && <div>{getPlayerName(team.player2Id)}</div>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCourtEditor && (
        <div className="team-standings-courts">
          <h5 className="team-standings-courts-title">Court numbers</h5>
          <div className="team-standings-courts-row">
            {draftCourts.map((court, index) => (
              <input
                key={index}
                type="number"
                min={1}
                max={999}
                value={Number.isFinite(court) ? court : ''}
                onChange={(e) => {
                  const value = e.target.value === '' ? NaN : Number(e.target.value);
                  setDraftCourts((current) => current.map((n, i) => (i === index ? value : n)));
                }}
                aria-label={`Court ${index + 1} number`}
              />
            ))}
            <button
              type="button"
              className="team-standings-courts-save"
              onClick={handleSaveCourts}
              disabled={!normalizedDraft || courtsUnchanged || savingCourts}
            >
              {savingCourts ? 'Saving...' : 'Save'}
            </button>
          </div>
          {!normalizedDraft && (
            <p className="team-standings-courts-error">Enter a unique court number for each court.</p>
          )}
          {courtError && <p className="team-standings-courts-error">{courtError}</p>}
        </div>
      )}

      <div className={isDesktop ? 'player-list-editor-actions' : 'space-y-3'}>
        {!isEditing ? (
          <button
            type="button"
            onClick={() => canEdit && setIsEditing(true)}
            disabled={!canEdit}
            className={!canEdit ? 'tab-btn-disabled' : 'tab-btn-primary'}
          >
            <PencilIcon className="w-5 h-5 inline mr-2" />
            {isFinalized
              ? 'Tournament Finalized'
              : !isEditable
                ? singles
                  ? 'Players Locked'
                  : 'Teams Locked'
                : singles
                  ? 'Update Players'
                  : 'Update Teams'}
          </button>
        ) : (
          <div className={isDesktop ? 'player-list-editor-edit-actions' : 'space-y-3'}>
            {duplicateKeys.length > 0 && (
              <p className="app-alert-error">Each player needs a unique name.</p>
            )}
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={!isValidTeams() || duplicateKeys.length > 0}
              className={
                isValidTeams() && duplicateKeys.length === 0 ? 'tab-btn-success' : 'tab-btn-disabled'
              }
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

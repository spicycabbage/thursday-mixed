'use client';

import { useEffect } from 'react';
import { Tournament, QueueCard, queuePlaceExplanation, queuePlaceLabel, formatSideNames } from '@/lib/gameLogic';

interface QueueExplainModalProps {
  card: QueueCard;
  tournament: Tournament;
  onClose: () => void;
}

export default function QueueExplainModal({ card, tournament, onClose }: QueueExplainModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const nameOf = (playerId: number) => tournament.players.find((player) => player.id === playerId)?.name ?? '';
  const side = (player1: number, player2: number) => formatSideNames(nameOf(player1), nameOf(player2));

  return (
    <div className="match-edit-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="match-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-explain-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="match-edit-modal-header">
          <h3 id="queue-explain-title" className="match-edit-modal-title">
            {queuePlaceLabel(card.place)}
          </h3>
          <button type="button" className="match-edit-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="match-edit-modal-body queue-explain-body">
          <p className="queue-explain-names">
            {side(card.match.teamA.player1, card.match.teamA.player2)}
            <span> vs </span>
            {side(card.match.teamB.player1, card.match.teamB.player2)}
          </p>
          <p>{queuePlaceExplanation(card.place)}</p>
        </div>
      </div>
    </div>
  );
}

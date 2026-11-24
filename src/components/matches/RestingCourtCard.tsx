import {
  formatCourtLabel,
  formatSideNames,
  gamesInARowLabel,
  type RestingCourt,
  type Tournament,
} from '@/lib/gameLogic';

function sideName(tournament: Tournament, teamId: number): string {
  const team = tournament.teams.find((item) => item.id === teamId);
  if (!team) return `Team ${teamId}`;
  const primary = tournament.players.find((player) => player.id === team.player1Id)?.name ?? '';
  const partner = team.player2Id
    ? (tournament.players.find((player) => player.id === team.player2Id)?.name ?? '')
    : '';
  return formatSideNames(primary, partner) || `Team ${team.label}`;
}

function whoWaits(tournament: Tournament, court: RestingCourt): string {
  const named = court.holds.map((hold) => ({
    name: sideName(tournament, hold.teamId),
    games: hold.gamesInARow,
  }));
  if (named.length === 0) return 'The next match would run too long without a break';
  const same = named.every((hold) => hold.games === named[0].games);
  if (named.length === 1 || same) {
    const names = named.map((hold) => hold.name);
    const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    return `${who} would be playing ${gamesInARowLabel(named[0].games)} game in a row`;
  }
  const parts = named.map((hold, index) =>
    index === 0
      ? `${hold.name} would be playing ${gamesInARowLabel(hold.games)} game in a row`
      : `${hold.name} ${gamesInARowLabel(hold.games)}`
  );
  return parts.join(', and ');
}

export default function RestingCourtCard({ tournament, court }: { tournament: Tournament; court: RestingCourt }) {
  const label = formatCourtLabel(court.court) ?? 'Court';
  return (
    <div className="resting-court-card">
      <p className="resting-court-title">{label}</p>
      <p className="resting-court-status">Open</p>
      <p className="resting-court-body">
        {whoWaits(tournament, court)}, so this court waits until another game finishes.
      </p>
    </div>
  );
}

import { createTournament, startTournament, updateMatchScore } from '../gameLogic';
import { BREAK_COLOR, buildCourtTimeline, buildTeamRows, formatAxisClock, formatMatchWindow, teamColor, timelineAxis } from '../matchClock';

const sampleTeams = [
  { player1: 'Alice', player2: 'Amy' },
  { player1: 'Bob', player2: 'Ben' },
  { player1: 'Cara', player2: 'Chen' },
  { player1: 'Dana', player2: 'Drew' },
  { player1: 'Evan', player2: 'Elle' },
  { player1: 'Finn', player2: 'Faye' },
];

describe('match clock display', () => {
  it('formats a same-meridiem window without repeating AM/PM', () => {
    const start = '2026-11-23T18:00:00.000Z';
    const end = '2026-11-23T18:20:00.000Z';
    const endLabel = new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const startLabel = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const startShort = startLabel.slice(-2) === endLabel.slice(-2) ? startLabel.slice(0, -3).trimEnd() : startLabel;
    expect(formatMatchWindow(start, end)).toBe(`${startShort}–${endLabel}`);
  });

  it('keeps both meridiems when the start and end differ', () => {
    const start = '2026-11-23T00:00:00.000Z';
    const end = '2026-11-23T12:30:00.000Z';
    const startLabel = new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const endLabel = new Date(end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const label = formatMatchWindow(start, end);
    expect(startLabel.slice(-2)).not.toBe(endLabel.slice(-2));
    expect(label).toBe(`${startLabel}–${endLabel}`);
  });

  it('returns nothing until both ends of the match are known', () => {
    expect(formatMatchWindow('2026-11-23T18:00:00.000Z', null)).toBeNull();
    expect(formatMatchWindow(null, null)).toBeNull();
  });

  it('lays matches out on their courts across time', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T18:20:00.000Z'));
    const started = startTournament(
      createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] }),
      '2026-11-23T18:00:00.000Z'
    );
    const first = started.matches.find((match) => match.court === 11)!;
    const scored = updateMatchScore(started, first.id, 21, 15);
    const timeline = buildCourtTimeline(scored, new Date('2026-11-23T18:20:00.000Z').getTime());
    expect(timeline?.courts).toEqual([11, 12]);
    const finished = timeline?.bars.filter((bar) => bar.matchId === first.id) ?? [];
    expect(finished.map((bar) => bar.lane).sort()).toEqual(['bottom', 'top']);
    expect(finished.every((bar) => bar.court === 11 && !bar.live)).toBe(true);
    expect(finished.some((bar) => bar.names.includes('Alice'))).toBe(true);
    const stillPlaying = timeline?.bars.find((bar) => bar.court === 12 && bar.live);
    expect(stillPlaying?.endMs).toBe(new Date('2026-11-23T18:20:00.000Z').getTime());
    jest.useRealTimers();
  });

  it('keeps a back-to-back team on the same lane and colors that team once', () => {
    const tournament = startTournament(
      createTournament(sampleTeams, undefined, { courtNumbers: [11, 12] }),
      '2026-11-23T18:00:00.000Z'
    );
    for (const match of tournament.matches) {
      match.startedAt = undefined;
      match.endedAt = undefined;
      match.completed = false;
      match.court = 0;
    }
    const [first, second, third] = tournament.matches;
    first.court = 11;
    first.teamAId = 1;
    first.teamBId = 2;
    first.startedAt = '2026-11-23T18:00:00.000Z';
    first.endedAt = '2026-11-23T18:15:00.000Z';
    first.completed = true;
    second.court = 11;
    second.teamAId = 3;
    second.teamBId = 1;
    second.startedAt = '2026-11-23T18:15:00.000Z';
    second.endedAt = '2026-11-23T18:30:00.000Z';
    second.completed = true;
    third.court = 11;
    third.teamAId = 4;
    third.teamBId = 3;
    third.startedAt = '2026-11-23T18:30:00.000Z';
    third.endedAt = '2026-11-23T18:45:00.000Z';
    third.completed = true;

    const timeline = buildCourtTimeline(tournament, new Date('2026-11-23T18:45:00.000Z').getTime());
    const laneOf = (matchId: number, teamId: number) =>
      timeline?.bars.find((bar) => bar.matchId === matchId && bar.teamId === teamId)?.lane;
    expect(laneOf(first.id, 1)).toBe('top');
    expect(laneOf(first.id, 2)).toBe('bottom');
    expect(laneOf(second.id, 1)).toBe('top');
    expect(laneOf(second.id, 3)).toBe('bottom');
    expect(laneOf(third.id, 3)).toBe('bottom');
    expect(laneOf(third.id, 4)).toBe('top');
    const teamOne = timeline?.bars.filter((bar) => bar.teamId === 1) ?? [];
    expect(teamOne.every((bar) => teamColor(bar.teamId) === teamColor(1))).toBe(true);
    expect(timeline?.legend.find((team) => team.teamId === 1)?.color).toBe(teamColor(1));
  });

  it('labels every 10 minutes and skips a mark under 3 minutes away', () => {
    const end = new Date(2026, 10, 23, 3, 0, 0, 0).getTime();
    const at224 = timelineAxis(new Date(2026, 10, 23, 2, 24, 0, 0).getTime(), end);
    expect(formatAxisClock(at224.startMs)).toBe('2:24');
    expect(at224.ticks.map((tick) => formatAxisClock(tick))).toEqual(['2:30', '2:40', '2:50', '3:00']);

    const at228 = timelineAxis(new Date(2026, 10, 23, 2, 28, 0, 0).getTime(), end);
    expect(formatAxisClock(at228.startMs)).toBe('2:28');
    expect(at228.ticks.map((tick) => formatAxisClock(tick))).toEqual(['2:40', '2:50', '3:00']);
  });

  it('charts each team and fills the gaps with breaks', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T18:20:00.000Z'));
    const tournament = startTournament(createTournament(sampleTeams), '2026-11-23T18:00:00.000Z');
    const finished = tournament.matches.find((match) => match.court > 0);
    if (!finished) throw new Error('expected a match on court');
    finished.endedAt = '2026-11-23T18:15:00.000Z';
    finished.completed = true;
    const timeline = buildCourtTimeline(tournament, Date.now());
    const rows = buildTeamRows(tournament, timeline!);
    expect(rows).toHaveLength(tournament.teams.length);
    const rested = rows.find((row) => row.teamId === finished.teamAId);
    expect(rested?.segments.map((segment) => segment.kind)).toEqual(['play', 'break']);
    const playingIds = new Set(
      tournament.matches.filter((match) => match.court > 0 && !match.endedAt).flatMap((match) => [match.teamAId, match.teamBId])
    );
    const waiting = rows.find((row) => !playingIds.has(row.teamId) && row.teamId !== finished.teamAId && row.teamId !== finished.teamBId);
    expect(waiting?.segments.map((segment) => segment.kind)).toEqual(['break']);
    expect(BREAK_COLOR).toBe('#111111');
    jest.useRealTimers();
  });

  it('has no timeline before the tournament starts', () => {
    const tournament = createTournament(sampleTeams);
    expect(buildCourtTimeline(tournament)).toBeNull();
  });
});

import type { Tournament } from './gameLogic';
import { formatSideNames, getCourtNumbers } from './gameLogic';

export const TEAM_COLORS = [
  '#6ea8fe',
  '#ff8f7a',
  '#3dbe8c',
  '#f0b429',
  '#b197fc',
  '#3ec6d6',
  '#f48cba',
  '#b5d86a',
  '#ffb15a',
];

export const BREAK_COLOR = '#111111';

export function teamColor(teamId: number): string {
  const index = Math.max(teamId, 1) - 1;
  return TEAM_COLORS[index % TEAM_COLORS.length];
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  // Follow the computer clock. Forcing America/Los_Angeles shows PST (UTC-8)
  // in November, which is an hour behind Yukon / this machine (UTC-7).
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Compact range for a completed-match card, e.g. "10:00–10:20 AM". */
export function formatMatchWindow(start?: string | null, end?: string | null): string | null {
  const startLabel = formatClock(start);
  const endLabel = formatClock(end);
  if (!startLabel || !endLabel) return null;
  const startMeridiem = startLabel.slice(-2);
  const endMeridiem = endLabel.slice(-2);
  const startShort = startMeridiem === endMeridiem ? startLabel.slice(0, -3).trimEnd() : startLabel;
  return `${startShort}–${endLabel}`;
}

export type CourtLane = 'top' | 'bottom';

export interface CourtTimeBar {
  matchId: number;
  court: number;
  teamId: number;
  lane: CourtLane;
  startMs: number;
  endMs: number;
  live: boolean;
  names: string;
}

export interface TeamLegendEntry {
  teamId: number;
  names: string;
  color: string;
}

export interface CourtTimeline {
  courts: number[];
  originMs: number;
  endMs: number;
  bars: CourtTimeBar[];
  legend: TeamLegendEntry[];
}

export function buildCourtTimeline(tournament: Tournament, now = Date.now()): CourtTimeline | null {
  if (!tournament.startedAt) return null;
  const originMs = new Date(tournament.startedAt).getTime();
  if (Number.isNaN(originMs)) return null;

  const nameOf = (playerId: number) => {
    if (playerId <= 0) return '';
    return tournament.players.find((player) => player.id === playerId)?.name ?? '';
  };

  const slots: CourtSlot[] = [];
  for (const match of tournament.matches) {
    if (!match.startedAt || match.court <= 0) continue;
    const startMs = new Date(match.startedAt).getTime();
    if (Number.isNaN(startMs)) continue;
    const live = !match.endedAt;
    const endMs = match.endedAt ? new Date(match.endedAt).getTime() : now;
    if (Number.isNaN(endMs) || endMs <= startMs) continue;
    slots.push({
      matchId: match.id,
      court: match.court,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      startMs,
      endMs,
      live,
      namesA: formatSideNames(nameOf(match.teamA.player1), nameOf(match.teamA.player2)),
      namesB: formatSideNames(nameOf(match.teamB.player1), nameOf(match.teamB.player2)),
    });
  }

  const bars = layCourtLanes(slots);

  const courts = [...new Set([...getCourtNumbers(tournament), ...bars.map((bar) => bar.court)])].sort(
    (a, b) => a - b
  );
  const lastEvent = bars.reduce((max, bar) => Math.max(max, bar.endMs), originMs);
  const live = bars.some((bar) => bar.live);
  const endMs = Math.max(lastEvent, live ? now : lastEvent, originMs + 2 * 60 * 1000);
  const legend = teamLegend(bars);
  return { courts, originMs, endMs, bars, legend };
}

interface CourtSlot {
  matchId: number;
  court: number;
  teamAId: number;
  teamBId: number;
  startMs: number;
  endMs: number;
  live: boolean;
  namesA: string;
  namesB: string;
}

/** Top lane is the first team. A team that stays on the court keeps that lane. */
function layCourtLanes(slots: CourtSlot[]): CourtTimeBar[] {
  const byCourt = new Map<number, CourtSlot[]>();
  for (const slot of slots) {
    const list = byCourt.get(slot.court);
    if (list) list.push(slot);
    else byCourt.set(slot.court, [slot]);
  }

  const bars: CourtTimeBar[] = [];
  for (const courtSlots of byCourt.values()) {
    courtSlots.sort((a, b) => a.startMs - b.startMs || a.matchId - b.matchId);
    let previousTop: number | null = null;
    let previousBottom: number | null = null;
    for (const slot of courtSlots) {
      const placed = placeTeams(slot.teamAId, slot.teamBId, previousTop, previousBottom);
      previousTop = placed.top;
      previousBottom = placed.bottom;
      bars.push(barFor(slot, placed.top, 'top'));
      bars.push(barFor(slot, placed.bottom, 'bottom'));
    }
  }
  return bars;
}

function placeTeams(
  teamAId: number,
  teamBId: number,
  previousTop: number | null,
  previousBottom: number | null
): { top: number; bottom: number } {
  if (previousTop === teamAId || previousTop === teamBId) {
    const top = previousTop;
    return { top, bottom: top === teamAId ? teamBId : teamAId };
  }
  if (previousBottom === teamAId || previousBottom === teamBId) {
    const bottom = previousBottom;
    return { bottom, top: bottom === teamAId ? teamBId : teamAId };
  }
  return { top: teamAId, bottom: teamBId };
}

function barFor(slot: CourtSlot, teamId: number, lane: CourtLane): CourtTimeBar {
  const firstTeam = teamId === slot.teamAId;
  return {
    matchId: slot.matchId,
    court: slot.court,
    teamId,
    lane,
    startMs: slot.startMs,
    endMs: slot.endMs,
    live: slot.live,
    names: firstTeam ? slot.namesA : slot.namesB,
  };
}

export interface TeamTimeSegment {
  startMs: number;
  endMs: number;
  kind: 'play' | 'break';
  live: boolean;
}

export interface TeamTimeRow {
  teamId: number;
  names: string;
  segments: TeamTimeSegment[];
}

/** One row per team. Playing time keeps the team color. Gaps are breaks. */
export function buildTeamRows(tournament: Tournament, timeline: CourtTimeline): TeamTimeRow[] {
  const nameOf = (playerId: number) => {
    if (playerId <= 0) return '';
    return tournament.players.find((player) => player.id === playerId)?.name ?? '';
  };

  return [...tournament.teams]
    .sort((a, b) => a.id - b.id)
    .map((team) => {
      const plays = mergePlays(timeline.bars.filter((bar) => bar.teamId === team.id));
      const segments: TeamTimeSegment[] = [];
      let cursor = timeline.originMs;
      for (const play of plays) {
        const start = Math.max(play.startMs, timeline.originMs);
        const end = Math.min(play.endMs, timeline.endMs);
        if (start > cursor) segments.push({ startMs: cursor, endMs: start, kind: 'break', live: false });
        if (end > start) segments.push({ startMs: start, endMs: end, kind: 'play', live: play.live });
        cursor = Math.max(cursor, end);
      }
      if (timeline.endMs > cursor) segments.push({ startMs: cursor, endMs: timeline.endMs, kind: 'break', live: false });
      return {
        teamId: team.id,
        names: formatSideNames(nameOf(team.player1Id), nameOf(team.player2Id)),
        segments,
      };
    });
}

function mergePlays(bars: CourtTimeBar[]): { startMs: number; endMs: number; live: boolean }[] {
  const sorted = [...bars].sort((a, b) => a.startMs - b.startMs || a.matchId - b.matchId);
  const merged: { startMs: number; endMs: number; live: boolean }[] = [];
  for (const bar of sorted) {
    const last = merged[merged.length - 1];
    if (last && bar.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, bar.endMs);
      last.live = last.live || bar.live;
      continue;
    }
    merged.push({ startMs: bar.startMs, endMs: bar.endMs, live: bar.live });
  }
  return merged;
}

function teamLegend(bars: CourtTimeBar[]): TeamLegendEntry[] {
  const seen = new Map<number, TeamLegendEntry>();
  for (const bar of bars) {
    if (seen.has(bar.teamId)) continue;
    seen.set(bar.teamId, {
      teamId: bar.teamId,
      names: bar.names,
      color: teamColor(bar.teamId),
    });
  }
  return [...seen.values()].sort((a, b) => a.teamId - b.teamId);
}

/** Axis label, e.g. "2:30". No AM/PM — the chart is one sitting. */
export function formatAxisClock(ms: number): string {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  const hour = date.getHours() % 12 || 12;
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

const AXIS_STEP_MINUTES = 10;
const AXIS_MIN_GAP_MS = 3 * 60 * 1000;

/** First local 10-minute mark (:00, :10, :20…) at or after `startMs`. */
function firstClockTenMinute(startMs: number): number {
  const date = new Date(startMs);
  date.setSeconds(0, 0);
  const remainder = date.getMinutes() % AXIS_STEP_MINUTES;
  if (remainder !== 0) date.setMinutes(date.getMinutes() + (AXIS_STEP_MINUTES - remainder));
  if (date.getTime() < startMs) date.setMinutes(date.getMinutes() + AXIS_STEP_MINUTES);
  return date.getTime();
}

export function timelineAxis(originMs: number, endMs: number): { startMs: number; endMs: number; ticks: number[] } {
  const startMs = originMs;
  const alignedEnd = Math.max(endMs, startMs);
  const ticks: number[] = [];
  let previous = startMs;
  const cursor = new Date(firstClockTenMinute(startMs));
  while (cursor.getTime() <= alignedEnd) {
    const tick = cursor.getTime();
    if (tick - previous >= AXIS_MIN_GAP_MS) {
      ticks.push(tick);
      previous = tick;
    }
    cursor.setMinutes(cursor.getMinutes() + AXIS_STEP_MINUTES);
  }
  return { startMs, endMs: alignedEnd, ticks };
}

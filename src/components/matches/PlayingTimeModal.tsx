'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tournament } from '@/lib/gameLogic';
import {
  BREAK_COLOR,
  axisLabelTicks,
  buildCourtTimeline,
  buildTeamRows,
  formatAxisClock,
  formatClock,
  formatMatchWindow,
  teamColor,
  timelineAxis,
  type CourtTimeline,
  type TeamTimeRow,
} from '@/lib/matchClock';

interface PlayingTimeModalProps {
  tournament: Tournament;
  onClose: () => void;
}

export default function PlayingTimeModal({ tournament, onClose }: PlayingTimeModalProps) {
  const [now, setNow] = useState(() => Date.now());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.clearInterval(timer);
    };
  }, []);

  const timeline = useMemo(() => buildCourtTimeline(tournament, now), [tournament, now]);
  const teamRows = useMemo(() => (timeline ? buildTeamRows(tournament, timeline) : []), [tournament, timeline]);

  return (
    <div className="playing-time-backdrop" role="presentation" onClick={onClose}>
      <div
        className="playing-time-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playing-time-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="playing-time-header">
          <div>
            <h3 id="playing-time-title" className="playing-time-title">
              Playing Time
            </h3>
          </div>
          <button type="button" className="playing-time-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="playing-time-body">
          {!timeline ? (
            <p className="playing-time-empty">Hit Start to begin the clock. Matches land on the chart as they go on court.</p>
          ) : (
            <TeamChart timeline={timeline} rows={teamRows} />
          )}
        </div>
      </div>
    </div>
  );
}

function breakSeconds(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

function rowBreakSeconds(row: TeamTimeRow): number {
  return row.segments.reduce(
    (total, segment) =>
      segment.kind === 'break' && segment.counted ? total + breakSeconds(segment.startMs, segment.endMs) : total,
    0
  );
}

function formatBreakTotal(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function TeamChart({ timeline, rows }: { timeline: CourtTimeline; rows: TeamTimeRow[] }) {
  const labelW = 210;
  const totalW = 88;
  const top = 22;
  const rowH = 44;
  const laneH = 26;
  const rowPad = 9;
  const axisH = 36;
  const axis = timelineAxis(timeline.originMs, timeline.endMs);
  const slots = Math.max(1, (axis.endMs - axis.startMs) / (5 * 60 * 1000));
  const plotW = Math.max(640, slots * 72);
  const width = labelW + plotW + totalW;
  const height = top + rows.length * rowH + axisH;
  const span = Math.max(axis.endMs - axis.startMs, 1);
  const xOf = (ms: number) => labelW + ((Math.min(Math.max(ms, axis.startMs), axis.endMs) - axis.startMs) / span) * plotW;

  return (
    <div className="playing-time-chart-fit">
      <svg
        className="playing-time-chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label="Playing time by team. Each row is a team. Bars show the opponent. Break bars show seconds."
      >
        <text x={width - 8} y={14} textAnchor="end" className="playing-time-tick">
          Break
        </text>
        <clipPath id="playing-time-team-labels">
          <rect x={0} y={0} width={labelW - 8} height={height} />
        </clipPath>
        {rows.map((row, index) => {
          const y = top + index * rowH + rowPad;
          const rowLabel = `${row.label} ${row.names}`.trim();
          return (
            <g key={row.teamId}>
              <rect x={labelW} y={y} width={plotW} height={laneH} className="playing-time-lane" />
              <text
                x={8}
                y={y + laneH / 2 + 4}
                textAnchor="start"
                className="playing-time-court"
                clipPath="url(#playing-time-team-labels)"
              >
                {rowLabel}
              </text>
              <text x={width - 8} y={y + laneH / 2 + 4} textAnchor="end" className="playing-time-court">
                {formatBreakTotal(rowBreakSeconds(row))}
              </text>
              <title>{rowLabel}</title>
            </g>
          );
        })}
        {axis.ticks.map((tick) => (
          <line
            key={tick}
            x1={xOf(tick)}
            y1={top + rowPad}
            x2={xOf(tick)}
            y2={top + rows.length * rowH - rowPad}
            className="playing-time-grid"
          />
        ))}
        {rows.map((row, rowIndex) =>
          row.segments.map((segment, index) => {
            const y = top + rowIndex * rowH + rowPad;
            const x = xOf(segment.startMs);
            const w = Math.max(xOf(segment.endMs) - x, 2);
            const play = segment.kind === 'play';
            const seconds = !play && !segment.counted ? 0 : breakSeconds(segment.startMs, segment.endMs);
            const windowLabel = play
              ? segment.live
                ? `${formatClock(new Date(segment.startMs).toISOString())}–now`
                : formatMatchWindow(new Date(segment.startMs).toISOString(), new Date(segment.endMs).toISOString())
              : `Break ${seconds}s`;
            const clipId = `playing-time-team-bar-${row.teamId}-${index}`;
            const versus = play && segment.opponent ? ` vs ${segment.opponent}` : '';
            return (
              <g key={`${row.teamId}-${index}`}>
                <clipPath id={clipId}>
                  <rect x={x + 4} y={y} width={Math.max(w - 8, 0)} height={laneH} />
                </clipPath>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={laneH}
                  rx={4}
                  fill={play ? teamColor(row.teamId) : BREAK_COLOR}
                  stroke={play ? '#1f2937' : 'none'}
                  strokeOpacity={play ? 0.16 : 0}
                  opacity={play && segment.live ? 0.85 : 1}
                />
                {play && segment.opponent ? (
                  <text
                    x={x + w / 2}
                    y={y + laneH / 2 + 4}
                    textAnchor="middle"
                    className="playing-time-bar-label"
                    clipPath={`url(#${clipId})`}
                  >
                    {segment.opponent}
                  </text>
                ) : null}
                {!play ? (
                  <text
                    x={x + w / 2}
                    y={y + laneH / 2 + 4}
                    textAnchor="middle"
                    className="playing-time-break-label"
                    clipPath={`url(#${clipId})`}
                  >
                    {seconds}s
                  </text>
                ) : null}
                <title>{`${row.label} ${row.names}${versus} · ${windowLabel ?? ''}`}</title>
              </g>
            );
          })
        )}
        <text x={labelW} y={height - 8} textAnchor="start" className="playing-time-tick">
          {formatAxisClock(axis.startMs)}
        </text>
        {axisLabelTicks(axis.ticks, axis.endMs).map((tick) => (
          <text
            key={`label-${tick}`}
            x={xOf(tick)}
            y={height - 8}
            textAnchor="middle"
            className="playing-time-tick"
          >
            {formatAxisClock(tick)}
          </text>
        ))}
        {axis.endMs !== axis.startMs && (
          <text x={xOf(axis.endMs)} y={height - 8} textAnchor="end" className="playing-time-tick">
            {formatAxisClock(axis.endMs)}
          </text>
        )}
      </svg>
    </div>
  );
}

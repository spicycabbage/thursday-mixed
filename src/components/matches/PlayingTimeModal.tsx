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
  const longest = useMemo(() => longestBreak(teamRows), [teamRows]);

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
          <div className="min-w-0">
            <h3 id="playing-time-title" className="playing-time-title">
              Playing Time
            </h3>
            {timeline || !tournament.isFinalized ? (
              <p className="playing-time-subtitle">Black bars are breaks between games. Letters show the opponent.</p>
            ) : null}
          </div>
          <button type="button" className="playing-time-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {timeline && (
          <div className="playing-time-stats">
            <PlayingTimeStat label="Started" value={formatClock(new Date(timeline.originMs).toISOString())} />
            <PlayingTimeStat label="Elapsed" value={formatElapsed(timeline.endMs - timeline.originMs)} />
            <PlayingTimeStat
              label="Longest break"
              value={longest ? `${formatBreakTotal(longest.seconds)} · ${longest.label}` : '—'}
            />
          </div>
        )}
        <div className="playing-time-body">
          {!timeline ? (
            <p className="playing-time-empty">
              {tournament.isFinalized
                ? 'Playing Time data were not kept for this tournament.'
                : 'Hit Start to begin the clock. Matches land on the chart as they go on court.'}
            </p>
          ) : (
            <TeamChart timeline={timeline} rows={teamRows} />
          )}
        </div>
      </div>
    </div>
  );
}

function PlayingTimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="playing-time-stat">
      <span className="playing-time-stat-label">{label}</span>
      <span className="playing-time-stat-value">{value}</span>
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

function longestBreak(rows: TeamTimeRow[]): { seconds: number; label: string } | null {
  let best: { seconds: number; label: string } | null = null;
  for (const row of rows) {
    for (const segment of row.segments) {
      if (segment.kind !== 'break' || !segment.counted) continue;
      const seconds = breakSeconds(segment.startMs, segment.endMs);
      if (seconds > 0 && (!best || seconds > best.seconds)) best = { seconds, label: row.label };
    }
  }
  return best;
}

function formatBreakTotal(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatElapsed(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** Drawn at the container's real pixel width so labels stay full size. */
function useChartWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setWidth(Math.max(480, Math.floor(node.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function TeamChart({ timeline, rows }: { timeline: CourtTimeline; rows: TeamTimeRow[] }) {
  const { ref, width } = useChartWidth(960);
  const labelW = 196;
  const totalW = 92;
  const plotGap = 12;
  const headerH = 22;
  const rowH = 40;
  const laneH = 26;
  const axisH = 34;
  const plotX = labelW;
  const plotW = Math.max(200, width - labelW - totalW - plotGap);
  const totalX = plotX + plotW + plotGap;
  const height = headerH + rows.length * rowH + axisH;
  const axis = timelineAxis(timeline.originMs, timeline.endMs);
  const span = Math.max(axis.endMs - axis.startMs, 1);
  const xOf = (ms: number) => plotX + ((Math.min(Math.max(ms, axis.startMs), axis.endMs) - axis.startMs) / span) * plotW;
  const laneTop = (rowIndex: number) => headerH + rowIndex * rowH + (rowH - laneH) / 2;
  const plotBottom = headerH + rows.length * rowH;
  const maxTotal = Math.max(0, ...rows.map(rowBreakSeconds));

  return (
    <div ref={ref} className="playing-time-chart-fit">
      <svg
        className="playing-time-chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Playing time by team. Each row is a team. Bars show the opponent. Break bars show seconds."
      >
        <text x={0} y={14} className="playing-time-col-head">
          Team
        </text>
        <text x={totalX + totalW / 2} y={14} textAnchor="middle" className="playing-time-col-head">
          Total break
        </text>

        {rows.map((row, index) => {
          const rowTop = headerH + index * rowH;
          const y = laneTop(index);
          const total = rowBreakSeconds(row);
          const clipId = `playing-time-name-${row.teamId}`;
          return (
            <g key={row.teamId}>
              {index % 2 === 0 && (
                <rect x={0} y={rowTop} width={width} height={rowH} rx={8} className="playing-time-row-stripe" />
              )}
              <rect x={8} y={y} width={laneH} height={laneH} rx={6} className="playing-time-badge" />
              <text x={8 + laneH / 2} y={y + laneH / 2 + 4} textAnchor="middle" className="playing-time-badge-text">
                {row.label}
              </text>
              <clipPath id={clipId}>
                <rect x={8 + laneH + 8} y={rowTop} width={labelW - laneH - 28} height={rowH} />
              </clipPath>
              <text
                x={8 + laneH + 8}
                y={y + laneH / 2 + 4}
                className="playing-time-names"
                clipPath={`url(#${clipId})`}
              >
                {row.names}
              </text>
              <rect x={plotX} y={y} width={plotW} height={laneH} rx={3} className="playing-time-lane" />
              <rect
                x={totalX + 6}
                y={y}
                width={totalW - 12}
                height={laneH}
                rx={laneH / 2}
                className={total > 0 && total === maxTotal ? 'playing-time-total is-max' : 'playing-time-total'}
              />
              <text x={totalX + totalW / 2} y={y + laneH / 2 + 4} textAnchor="middle" className="playing-time-total-text">
                {formatBreakTotal(total)}
              </text>
              <title>{`${row.label} ${row.names}`.trim()}</title>
            </g>
          );
        })}

        {axis.ticks.map((tick) => (
          <line
            key={tick}
            x1={xOf(tick)}
            y1={headerH}
            x2={xOf(tick)}
            y2={plotBottom}
            className="playing-time-grid"
          />
        ))}

        {rows.map((row, rowIndex) =>
          row.segments.map((segment, index, segments) => {
            const y = laneTop(rowIndex);
            const x = xOf(segment.startMs);
            const next = segments[index + 1];
            const endX = next ? xOf(next.startMs) : xOf(segment.endMs);
            const w = Math.max(endX - x, 1);
            const play = segment.kind === 'play';
            const seconds = !play && !segment.counted ? 0 : breakSeconds(segment.startMs, segment.endMs);
            const windowLabel = play
              ? segment.live
                ? `${formatClock(new Date(segment.startMs).toISOString())}–now`
                : formatMatchWindow(new Date(segment.startMs).toISOString(), new Date(segment.endMs).toISOString())
              : `Break ${seconds}s`;
            const versus = play && segment.opponent ? ` vs ${segment.opponent}` : '';
            const label = play ? segment.opponent : `${seconds}s`;
            const showLabel = !!label && w >= (play ? 16 : 30);
            const fill = play ? '#60a5fa' : segment.counted ? BREAK_COLOR : '#cbd5e1';
            const textClass = play
              ? 'playing-time-bar-label'
              : segment.counted
                ? 'playing-time-break-label'
                : 'playing-time-idle-label';
            return (
              <g key={`${row.teamId}-${index}`}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={laneH}
                  fill={fill}
                  className={play && segment.live ? 'playing-time-live' : undefined}
                />
                {showLabel && (
                  <text x={x + w / 2} y={y + laneH / 2 + 4} textAnchor="middle" className={textClass}>
                    {label}
                  </text>
                )}
                <title>{`${row.label} ${row.names}${versus} · ${windowLabel ?? ''}`}</title>
              </g>
            );
          })
        )}

        <line x1={plotX} y1={plotBottom + 4} x2={plotX + plotW} y2={plotBottom + 4} className="playing-time-axis" />
        <text x={plotX} y={height - 8} textAnchor="start" className="playing-time-tick is-edge">
          {formatAxisClock(axis.startMs)}
        </text>
        {axisLabelTicks(axis.ticks, axis.endMs).map((tick) => (
          <text key={`label-${tick}`} x={xOf(tick)} y={height - 8} textAnchor="middle" className="playing-time-tick">
            {formatAxisClock(tick)}
          </text>
        ))}
        {axis.endMs !== axis.startMs && (
          <text x={plotX + plotW} y={height - 8} textAnchor="end" className="playing-time-tick is-edge">
            {formatAxisClock(axis.endMs)}
          </text>
        )}
      </svg>
    </div>
  );
}

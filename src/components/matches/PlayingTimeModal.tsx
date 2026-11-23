'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Tournament, formatCourtLabel } from '@/lib/gameLogic';
import {
  BREAK_COLOR,
  buildCourtTimeline,
  buildTeamRows,
  formatAxisClock,
  formatClock,
  formatMatchWindow,
  teamColor,
  timelineAxis,
  type CourtLane,
  type CourtTimeline,
  type TeamTimeRow,
} from '@/lib/matchClock';

type PlayingTimeTab = 'court' | 'team';

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

  const [tab, setTab] = useState<PlayingTimeTab>('court');
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
        {timeline && (
          <div className="playing-time-tabs" role="tablist" aria-label="Playing time">
            <TabButton tab="court" current={tab} onSelect={setTab}>
              Court
            </TabButton>
            <TabButton tab="team" current={tab} onSelect={setTab}>
              Team
            </TabButton>
          </div>
        )}
        <div className="playing-time-body">
          {!timeline ? (
            <p className="playing-time-empty">Hit Start to begin the clock. Matches land on the chart as they go on court.</p>
          ) : (
            <PlayingTimePane tab={tab} timeline={timeline} teamRows={teamRows} />
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  current,
  onSelect,
  children,
}: {
  tab: PlayingTimeTab;
  current: PlayingTimeTab;
  onSelect: (tab: PlayingTimeTab) => void;
  children: string;
}) {
  const selected = tab === current;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      className={`playing-time-tab${selected ? ' is-active' : ''}`}
      onClick={() => onSelect(tab)}
    >
      {children}
    </button>
  );
}

function PlayingTimePane({
  tab,
  timeline,
  teamRows,
}: {
  tab: PlayingTimeTab;
  timeline: CourtTimeline;
  teamRows: TeamTimeRow[];
}) {
  switch (tab) {
    case 'court':
      return (
        <>
          <CourtChart timeline={timeline} />
          {timeline.legend.length > 0 && (
            <ul className="playing-time-legend">
              {timeline.legend.map((team) => (
                <li key={team.teamId}>
                  <span className="playing-time-swatch" style={{ background: team.color }} />
                  <span className="playing-time-legend-names">{team.names}</span>
                </li>
              ))}
            </ul>
          )}
          {timeline.bars.length === 0 && (
            <p className="playing-time-empty">Matches show up here as soon as they go on court.</p>
          )}
        </>
      );
    case 'team':
      return (
        <>
          <TeamChart timeline={timeline} rows={teamRows} />
          <ul className="playing-time-legend">
            <li>
              <span className="playing-time-swatch" style={{ background: BREAK_COLOR }} />
              <span className="playing-time-legend-names">Break</span>
            </li>
          </ul>
        </>
      );
    default: {
      const unreachable: never = tab;
      return unreachable;
    }
  }
}

function CourtChart({ timeline }: { timeline: CourtTimeline }) {
  const labelW = 84;
  const top = 8;
  const rowH = 76;
  const laneH = 28;
  const laneGap = 4;
  const rowPad = 8;
  const axisH = 36;
  const axis = timelineAxis(timeline.originMs, timeline.endMs);
  const slots = Math.max(1, (axis.endMs - axis.startMs) / (5 * 60 * 1000));
  const plotW = Math.max(640, slots * 72);
  const width = labelW + plotW + 16;
  const height = top + timeline.courts.length * rowH + axisH;
  const span = Math.max(axis.endMs - axis.startMs, 1);
  const xOf = (ms: number) => labelW + ((Math.min(Math.max(ms, axis.startMs), axis.endMs) - axis.startMs) / span) * plotW;
  const laneY = (row: number, lane: CourtLane) => {
    const base = top + row * rowH + rowPad;
    return lane === 'top' ? base : base + laneH + laneGap;
  };

  return (
    <div className="playing-time-chart-scroll">
      <svg
        className="playing-time-chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Playing time by court. Each court has the first team on top and the second team below. Time is marked every 10 minutes."
      >
        {timeline.courts.map((court, index) => {
          const y = top + index * rowH;
          return (
            <g key={court}>
              <rect x={labelW} y={laneY(index, 'top')} width={plotW} height={laneH} className="playing-time-lane" />
              <rect x={labelW} y={laneY(index, 'bottom')} width={plotW} height={laneH} className="playing-time-lane" />
              <text x={labelW - 10} y={y + rowH / 2 + 4} textAnchor="end" className="playing-time-court">
                {formatCourtLabel(court)}
              </text>
            </g>
          );
        })}
        {axis.ticks.map((tick) => (
          <line
            key={tick}
            x1={xOf(tick)}
            y1={top + rowPad}
            x2={xOf(tick)}
            y2={top + timeline.courts.length * rowH - rowPad}
            className="playing-time-grid"
          />
        ))}
        {timeline.bars.map((bar) => {
          const row = timeline.courts.indexOf(bar.court);
          if (row < 0) return null;
          const x = xOf(bar.startMs);
          const w = Math.max(xOf(bar.endMs) - x, 3);
          const y = laneY(row, bar.lane);
          const windowLabel = bar.live
            ? `${formatClock(new Date(bar.startMs).toISOString())}–now`
            : formatMatchWindow(new Date(bar.startMs).toISOString(), new Date(bar.endMs).toISOString());
          const clipId = `playing-time-clip-${bar.matchId}-${bar.teamId}`;
          const text = bar.names;
          return (
            <g key={`${bar.matchId}-${bar.teamId}`}>
              <clipPath id={clipId}>
                <rect x={x + 6} y={y} width={Math.max(w - 12, 0)} height={laneH} />
              </clipPath>
              <rect
                x={x}
                y={y}
                width={w}
                height={laneH}
                rx={5}
                fill={teamColor(bar.teamId)}
                stroke="#1f2937"
                strokeOpacity={0.16}
                opacity={bar.live ? 0.85 : 1}
              />
              <text x={x + 8} y={y + laneH / 2 + 4} className="playing-time-bar-label" clipPath={`url(#${clipId})`}>
                {text}
              </text>
              <title>{`${text} · ${windowLabel ?? ''}`}</title>
            </g>
          );
        })}
        <text x={labelW} y={height - 8} textAnchor="start" className="playing-time-tick">
          {formatAxisClock(axis.startMs)}
        </text>
        {axis.ticks.map((tick) => {
          const nearEnd = axis.endMs - tick < 2.5 * 60 * 1000;
          return (
            <text
              key={`label-${tick}`}
              x={xOf(tick)}
              y={height - 8}
              textAnchor={nearEnd ? 'end' : 'middle'}
              className="playing-time-tick"
            >
              {formatAxisClock(tick)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TeamChart({ timeline, rows }: { timeline: CourtTimeline; rows: TeamTimeRow[] }) {
  const labelW = 168;
  const top = 8;
  const rowH = 44;
  const laneH = 26;
  const rowPad = 9;
  const axisH = 36;
  const axis = timelineAxis(timeline.originMs, timeline.endMs);
  const slots = Math.max(1, (axis.endMs - axis.startMs) / (5 * 60 * 1000));
  const plotW = Math.max(640, slots * 72);
  const width = labelW + plotW + 16;
  const height = top + rows.length * rowH + axisH;
  const span = Math.max(axis.endMs - axis.startMs, 1);
  const xOf = (ms: number) => labelW + ((Math.min(Math.max(ms, axis.startMs), axis.endMs) - axis.startMs) / span) * plotW;

  return (
    <div className="playing-time-chart-scroll">
      <svg
        className="playing-time-chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Playing time by team. Each team is a row. Breaks are black."
      >
        <clipPath id="playing-time-team-labels">
          <rect x={0} y={0} width={labelW - 8} height={height} />
        </clipPath>
        {rows.map((row, index) => {
          const y = top + index * rowH + rowPad;
          return (
            <g key={row.teamId}>
              <rect x={labelW} y={y} width={plotW} height={laneH} className="playing-time-lane" />
              <text
                x={labelW - 10}
                y={y + laneH / 2 + 4}
                textAnchor="end"
                className="playing-time-court"
                clipPath="url(#playing-time-team-labels)"
              >
                {row.names}
              </text>
              <title>{row.names}</title>
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
            const windowLabel = play
              ? segment.live
                ? `${formatClock(new Date(segment.startMs).toISOString())}–now`
                : formatMatchWindow(new Date(segment.startMs).toISOString(), new Date(segment.endMs).toISOString())
              : 'Break';
            return (
              <g key={`${row.teamId}-${index}`}>
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
                <title>{`${row.names} · ${windowLabel ?? ''}`}</title>
              </g>
            );
          })
        )}
        <text x={labelW} y={height - 8} textAnchor="start" className="playing-time-tick">
          {formatAxisClock(axis.startMs)}
        </text>
        {axis.ticks.map((tick) => {
          const nearEnd = axis.endMs - tick < 2.5 * 60 * 1000;
          return (
            <text
              key={`label-${tick}`}
              x={xOf(tick)}
              y={height - 8}
              textAnchor={nearEnd ? 'end' : 'middle'}
              className="playing-time-tick"
            >
              {formatAxisClock(tick)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

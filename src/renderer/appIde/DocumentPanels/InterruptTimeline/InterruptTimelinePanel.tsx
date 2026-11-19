import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";

import {
  clocksPerT,
  decodeInterruptEvents,
  NEXT_INT_SOURCE_NAMES,
  NextIntEventFlag,
  NextIntEventKind,
  type NextIntEvent
} from "@common/zxnext/interrupts/interruptState";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { EmptyState, PanelHeader, PanelHeaderGroup } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { SplitPanel } from "@renderer/controls/SplitPanel";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";

/** What the document keeps between sessions: the splitter's position */
type InterruptTimelineViewState = { splitSize?: string };
import { useEmuApi } from "@renderer/core/EmuApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  beamOf,
  buildTimelineView,
  clocksBetween,
  heldFrames,
  LANES,
  LATENCY_BUDGET_T,
  latencies,
  latencyStats,
  nmiDeviceName,
  toT,
  type LaneId,
  type Marker,
  type TimelineTiming
} from "@renderer/features/interrupts/timelineModel";
import { useEmuStateListener } from "../../useStateRefresh";
import styles from "./InterruptTimelinePanel.module.scss";

/**
 * The Interrupt Timeline document (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §4.2): the interrupt
 * event ring drawn as swimlanes over 1, 2 or 4 frames, with what the ring holds, the selected event,
 * the latency table and the event list. Opening it switches the ring's recording on; closing it
 * switches it off (D4).
 */

/** The SVG's coordinate box: the lanes stretch to the panel's width */
const SVG_W = 900;
const LABEL_W = 92;
/** A lane's height in SVG units: it follows the chart's box between these (the split's position) */
const MIN_LANE_H = 20;
const MAX_LANE_H = 64;
/** The legend's band under the lanes */
const LEGEND_H = 18;
const AXIS_H = 26;
/** The event list shows at most this many rows (a sample player's frame has ~1,000 events) */
const LIST_CAP = 500;

const LANE_KEYS: Record<LaneId, MessageKey> = {
  main: "panels.doc.intTimeline.lane.main",
  line: "panels.doc.intTimeline.lane.line",
  uartRx: "panels.doc.intTimeline.lane.uartRx",
  ctc: "panels.doc.intTimeline.lane.ctc",
  ula: "panels.doc.intTimeline.lane.ula",
  uartTx: "panels.doc.intTimeline.lane.uartTx",
  nmi: "panels.doc.intTimeline.lane.nmi"
};

const KIND_KEYS: Record<number, MessageKey> = {
  [NextIntEventKind.Request]: "panels.doc.intTimeline.kind.request",
  [NextIntEventKind.Acknowledge]: "panels.doc.intTimeline.kind.ack",
  [NextIntEventKind.End]: "panels.doc.intTimeline.kind.end",
  [NextIntEventKind.Reti]: "panels.doc.intTimeline.kind.reti",
  [NextIntEventKind.RetiIgnored]: "panels.doc.intTimeline.kind.retiIgnored",
  [NextIntEventKind.RetnInService]: "panels.doc.intTimeline.kind.retnInService",
  [NextIntEventKind.Lost]: "panels.doc.intTimeline.kind.lost",
  [NextIntEventKind.Wait]: "panels.doc.intTimeline.kind.wait",
  [NextIntEventKind.Nmi]: "panels.doc.intTimeline.kind.nmi",
  [NextIntEventKind.NmiEnd]: "panels.doc.intTimeline.kind.nmiEnd"
};

const fmt = (n: number) => Math.round(n).toLocaleString("en");
const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

function sourceLabel(e: NextIntEvent): string {
  if (e.kind === NextIntEventKind.Nmi || e.kind === NextIntEventKind.NmiEnd)
    return nmiDeviceName(e.source);
  return NEXT_INT_SOURCE_NAMES[e.source] ?? "?";
}

const InterruptTimelinePanel = ({ document, viewState }: DocumentProps) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  // --- Where the splitter between the chart and the lists sits, kept with the document
  const [splitSize] = useState<string | undefined>(
    () => (viewState as InterruptTimelineViewState | undefined)?.splitSize
  );
  const saveSplit = useCallback(
    (size: string) => {
      if (document) documentHubService?.setDocumentViewState(document.id, { splitSize: size });
    },
    [document, documentHubService]
  );
  const emuApi = useEmuApi();
  const { ideCommandsService } = useAppServices();

  const [recording, setRecording] = useState(true);
  const recordingRef = useRef(true);
  const eventsRef = useRef<NextIntEvent[]>([]);
  const countRef = useRef(0);
  const [version, setVersion] = useState(0);
  const [meta, setMeta] = useState<{
    count: number;
    capacity: number;
    timing: TimelineTiming;
    current: number;
  }>();
  const [unavailable, setUnavailable] = useState(false);
  // --- The chart's box in pixels: the lanes share its height (see Geometry)
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartBox, setChartBox] = useState({ w: 0, h: 0 });
  useResizeObserver(chartRef, (entries) => {
    const r = entries[0]?.contentRect;
    if (r)
      setChartBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
  });

  const [nFrames, setNFrames] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [follow, setFollow] = useState(true);
  const [firstFrame, setFirstFrame] = useState<number>();
  const [lateOnly, setLateOnly] = useState(false);
  const [selected, setSelected] = useState<number>();

  // --- Incremental reads: only the records written since the last one (or all, after a clear)
  const refresh = useCallback(async () => {
    try {
      if (recordingRef.current) {
        const st = await emuApi.getInterruptState();
        if (!st.recording.enabled) await emuApi.setInterruptRecording(true);
      }
      let since = countRef.current;
      let ev = await emuApi.getInterruptEvents(since);
      if (ev.count < since) {
        // --- Cleared, or a new machine: start over
        eventsRef.current = [];
        since = 0;
        ev = await emuApi.getInterruptEvents(0);
      }
      const fresh = decodeInterruptEvents(ev);
      if (fresh.length > 0) {
        const all = eventsRef.current.concat(fresh);
        eventsRef.current = all.length > ev.capacity ? all.slice(all.length - ev.capacity) : all;
      }
      countRef.current = ev.count;
      setMeta({
        count: ev.count,
        capacity: ev.capacity,
        timing: { totalHc: ev.totalHc, totalVc: ev.totalVc },
        current: ev.currentFrame
      });
      setUnavailable(false);
      setVersion((v) => v + 1);
    } catch {
      setUnavailable(true);
    }
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  // --- D4: the ring records while the document is open
  useEffect(() => {
    void emuApi.setInterruptRecording(true).catch(() => undefined);
    return () => {
      void emuApi.setInterruptRecording(false).catch(() => undefined);
    };
  }, [emuApi]);

  const toggleRecording = async (on: boolean) => {
    recordingRef.current = on;
    setRecording(on);
    await emuApi.setInterruptRecording(on);
  };
  const clear = async () => {
    await emuApi.clearInterruptEvents();
    eventsRef.current = [];
    countRef.current = 0;
    setSelected(undefined);
    await refresh();
  };

  const events = eventsRef.current;
  const held = useMemo(
    () => heldFrames(events, meta?.count ?? 0, meta?.capacity ?? 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, meta]
  );
  const lat = useMemo(
    () => (meta ? latencies(events, meta.timing) : new Map<number, number>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, meta]
  );

  // --- The view: the newest frames while following, else where the user paged to
  const oldest = held.first;
  const newest = held.last;
  const viewFirst =
    newest === undefined
      ? 0
      : follow || firstFrame === undefined
        ? Math.max(oldest ?? 0, newest - nFrames + 1)
        : Math.min(Math.max(firstFrame, oldest ?? 0), Math.max(oldest ?? 0, newest - nFrames + 1));

  const view = useMemo(
    () =>
      meta && newest !== undefined
        ? buildTimelineView(events, meta.timing, viewFirst, nFrames, held, lat)
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, meta, viewFirst, nFrames, held, lat]
  );
  const stats = useMemo(() => latencyStats(events, lat, held), [events, lat, held]);

  if (unavailable) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState message={t("panels.doc.intTimeline.notAvailable")} />
      </FullPanel>
    );
  }

  const page = (delta: number) => {
    setFollow(false);
    setSelected(undefined);
    setFirstFrame(viewFirst + delta);
  };

  // --- Geometry. The SVG is SVG_W units wide whatever its pixel width; its height in units is the
  // --- chart box's, so the lanes share the height the splitter gives them and nothing stretches
  const fitH = chartBox.w > 0 ? (chartBox.h * SVG_W) / chartBox.w : 0;
  const laneH = Math.max(
    MIN_LANE_H,
    Math.min(MAX_LANE_H, (fitH - AXIS_H - LEGEND_H) / LANES.length)
  );
  const lanesH = LANES.length * laneH;
  const svgH = AXIS_H + lanesH + LEGEND_H;
  // --- A bar and a lane's ground keep their thickness however tall the lane is
  const barH = Math.min(laneH - 10, 16);
  const groundH = Math.min(laneH - 8, 24);
  const span = view ? view.length / zoom : 1;
  const selMarker = view?.markers.find((m) => m.event.seq === selected);
  const t0 =
    view && zoom > 1 && selMarker
      ? Math.max(0, Math.min(view.length - span, selMarker.t - span / 2))
      : 0;
  const X = (tt: number) => LABEL_W + ((tt - t0) / span) * (SVG_W - LABEL_W - 8);
  const laneY = (lane: LaneId) => AXIS_H + LANES.indexOf(lane) * laneH;
  const laneMid = (lane: LaneId) => laneY(lane) + laneH / 2;

  const visibleMarkers = (view?.markers ?? []).filter((m) => !lateOnly || m.late);
  const listRows = visibleMarkers.slice(0, LIST_CAP);

  const select = (m: Marker) => setSelected(m.event.seq);
  const sel = selMarker;
  const timing = meta?.timing;

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={recording}
            label={t("panels.doc.intTimeline.record")}
            title={t("panels.doc.intTimeline.recordTitle")}
            clicked={(v: boolean) => void toggleRecording(v)}
          />
          <SmallIconButton
            iconName="trash"
            title={t("panels.doc.intTimeline.clear")}
            clicked={() => void clear()}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <SmallIconButton
            iconName="chevron-left"
            title={t("panels.doc.intTimeline.prevFrame")}
            enable={
              newest !== undefined &&
              viewFirst > (held.wrapped ? (held.partialFrame ?? 0) : (oldest ?? 0))
            }
            clicked={() => page(-1)}
          />
          <span className={styles.frameLabel}>
            {newest === undefined
              ? "-"
              : nFrames === 1
                ? t("panels.doc.intTimeline.frame", { frame: viewFirst })
                : t("panels.doc.intTimeline.frames", {
                    first: viewFirst,
                    last: viewFirst + nFrames - 1
                  })}
          </span>
          <SmallIconButton
            iconName="chevron-right"
            title={t("panels.doc.intTimeline.nextFrame")}
            enable={newest !== undefined && viewFirst + nFrames - 1 < newest}
            clicked={() => page(1)}
          />
          <LabeledSwitch
            value={follow}
            label={t("panels.doc.intTimeline.follow")}
            title={t("panels.doc.intTimeline.followTitle")}
            clicked={(v: boolean) => setFollow(v)}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <Segmented
            title={t("panels.doc.intTimeline.framesInView")}
            options={[1, 2, 4].map((n) => ({
              value: n,
              label: t("panels.doc.intTimeline.nFrames", { count: n })
            }))}
            value={nFrames}
            onChange={(n) => setNFrames(n)}
          />
          <Segmented
            title={t("panels.doc.intTimeline.zoom")}
            options={[
              { value: 1, label: t("panels.doc.intTimeline.zoomAll") },
              { value: 4, label: "¼" },
              { value: 16, label: "1/16" }
            ]}
            value={zoom}
            onChange={(z) => setZoom(z)}
          />
          <LabeledSwitch
            value={lateOnly}
            label={t("panels.doc.intTimeline.lateOnly")}
            title={t("panels.doc.intTimeline.lateOnlyTitle", { budget: LATENCY_BUDGET_T })}
            clicked={(v: boolean) => setLateOnly(v)}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span
            className={classnames(styles.held, { [styles.full]: held.wrapped })}
            title={t("panels.doc.intTimeline.heldTitle")}
          >
            {held.first === undefined || !meta
              ? t("panels.doc.intTimeline.empty")
              : t(
                  held.wrapped
                    ? "panels.doc.intTimeline.heldWrapped"
                    : "panels.doc.intTimeline.held",
                  {
                    first: held.wrapped ? (held.first ?? 0) + 1 : held.first,
                    last: held.last ?? 0,
                    frames: held.complete,
                    used: Math.min(meta.count, meta.capacity),
                    capacity: meta.capacity
                  }
                )}
          </span>
        </PanelHeaderGroup>
      </PanelHeader>

      {!view || !timing ? (
        <EmptyState
          message={
            recording ? t("panels.doc.intTimeline.waiting") : t("panels.doc.intTimeline.paused")
          }
        />
      ) : (
        <div className={styles.body}>
          <SplitPanel
            primaryLocation="top"
            initialPrimarySize={splitSize ?? "52%"}
            minSize={120}
            onPrimarySizeUpdateCompleted={saveSplit}
          >
            <div className={styles.upper}>
              <div className={styles.chart} ref={chartRef}>
                <svg
                  viewBox={`0 0 ${SVG_W} ${svgH}`}
                  preserveAspectRatio="xMinYMin meet"
                  className={styles.svg}
                  role="img"
                  aria-label={t("panels.doc.intTimeline.chartLabel")}
                >
                  <defs>
                    <pattern
                      id="int-hatch"
                      width="6"
                      height="6"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="6"
                        className={styles.hatchLine}
                        strokeWidth="2"
                      />
                    </pattern>
                    <pattern
                      id="int-gone"
                      width="8"
                      height="8"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(-45)"
                    >
                      <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="8"
                        className={styles.goneLine}
                        strokeWidth="2"
                      />
                    </pattern>
                    <clipPath id="int-clip">
                      <rect x={LABEL_W} y={0} width={SVG_W - LABEL_W} height={svgH} />
                    </clipPath>
                  </defs>
                  {/* --- The axis: frame-relative T-states and beam lines */}
                  {Array.from({ length: 11 }, (_, k) => {
                    const tt = t0 + (span * k) / 10;
                    const ft = Math.round(tt) % Math.round(view.frameT);
                    const x = X(tt);
                    return (
                      <g key={k}>
                        <line
                          x1={x}
                          y1={AXIS_H - 4}
                          x2={x}
                          y2={AXIS_H + lanesH}
                          className={styles.gridLine}
                        />
                        <text x={x} y={AXIS_H - 8} textAnchor="middle" className={styles.axisText}>
                          {`${fmt(ft)} · L${beamOf(ft * 8, timing).line}`}
                        </text>
                      </g>
                    );
                  })}
                  <g clipPath="url(#int-clip)">
                    {view.frames.map((f, k) => {
                      const x = X(k * view.frameT);
                      const partial = held.wrapped && f === held.partialFrame;
                      return (
                        <g key={f}>
                          {k > 0 && (
                            <line
                              x1={x}
                              y1={0}
                              x2={x}
                              y2={AXIS_H + lanesH}
                              className={styles.frameLine}
                            />
                          )}
                          <text
                            x={Math.max(x, LABEL_W) + 4}
                            y={10}
                            className={partial ? styles.partialText : styles.frameText}
                          >
                            {partial
                              ? t("panels.doc.intTimeline.framePartial", { frame: f })
                              : t("panels.doc.intTimeline.frame", { frame: f })}
                          </text>
                        </g>
                      );
                    })}
                    {view.gone && (
                      <rect
                        x={X(view.gone.a)}
                        y={AXIS_H}
                        width={Math.max(0, X(view.gone.b) - X(view.gone.a))}
                        height={lanesH}
                        fill="url(#int-gone)"
                      />
                    )}
                    {LANES.map((lane) => (
                      <rect
                        key={lane}
                        x={LABEL_W}
                        y={laneMid(lane) - groundH / 2}
                        width={SVG_W - LABEL_W}
                        height={groundH}
                        className={styles.laneBg}
                      />
                    ))}
                    {view.segments.map((s, i) => (
                      <rect
                        key={i}
                        x={X(s.a)}
                        y={laneMid(s.lane) - barH / 2}
                        width={Math.max(1, X(s.b) - X(s.a))}
                        height={barH}
                        className={s.running ? styles[`bar_${s.lane}`] : styles[`hatch_${s.lane}`]}
                        fill={s.running ? undefined : "url(#int-hatch)"}
                      />
                    ))}
                    {visibleMarkers.map((m) => (
                      <MarkerGlyph
                        key={m.event.seq}
                        m={m}
                        x={X(m.t)}
                        cy={laneMid(m.lane)}
                        half={barH / 2}
                        selected={m.event.seq === selected}
                        onClick={() => select(m)}
                      />
                    ))}
                  </g>
                  {LANES.map((lane) => (
                    <g key={lane}>
                      <rect
                        x={0}
                        y={laneMid(lane) - barH / 2}
                        width={3}
                        height={barH}
                        className={styles[`bar_${lane}`]}
                      />
                      <text x={8} y={laneMid(lane) + 4} className={styles.laneText}>
                        {t(LANE_KEYS[lane])}
                      </text>
                    </g>
                  ))}
                  <text x={LABEL_W} y={svgH - 4} className={styles.axisText}>
                    {t("panels.doc.intTimeline.legend")}
                  </text>
                </svg>
              </div>
              <div className={styles.info}>
                <ScrollViewer>
                  <div className={styles.infoTitle}>{t("panels.doc.intTimeline.selection")}</div>
                  {sel ? (
                    <SelectionInfo
                      m={sel}
                      events={events}
                      timing={timing}
                      onReveal={(a) =>
                        void ideCommandsService.executeCommand(`show-disass ${hex4(a)}`)
                      }
                    />
                  ) : (
                    <div className={styles.muted}>{t("panels.doc.intTimeline.selectHint")}</div>
                  )}
                </ScrollViewer>
              </div>
            </div>
            <div className={styles.lower}>
              <div className={styles.lowerPane}>
                <div className={styles.infoTitle}>
                  {t("panels.doc.intTimeline.latencyTitle", { frames: held.complete })}
                </div>
                <div className={styles.paneBody}>
                  <ScrollViewer>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t("panels.doc.intTimeline.col.source")}</th>
                          <th>{t("panels.doc.intTimeline.col.taken")}</th>
                          <th>{t("panels.doc.intTimeline.col.min")}</th>
                          <th>{t("panels.doc.intTimeline.col.avg")}</th>
                          <th>{t("panels.doc.intTimeline.col.max")}</th>
                          <th>{t("panels.doc.intTimeline.col.jitter")}</th>
                          <th>{t("panels.doc.intTimeline.col.late")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map((s) => (
                          <tr key={s.source}>
                            <td className={styles.nameCell}>
                              {NEXT_INT_SOURCE_NAMES[s.source] ?? "?"}
                            </td>
                            <td>{fmt(s.taken)}</td>
                            <td>{fmt(s.min)}</td>
                            <td>{s.avg.toFixed(1)}</td>
                            <td className={s.max > LATENCY_BUDGET_T ? styles.late : undefined}>
                              {fmt(s.max)}
                            </td>
                            <td>{fmt(s.jitter)}</td>
                            <td className={s.late > 0 ? styles.late : undefined}>{fmt(s.late)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className={styles.muted}>
                      {t("panels.doc.intTimeline.budget", { budget: LATENCY_BUDGET_T })}
                    </div>
                  </ScrollViewer>
                </div>
              </div>
              <div className={styles.lowerPane}>
                <div className={styles.infoTitle}>{t("panels.doc.intTimeline.eventsTitle")}</div>
                <div className={styles.paneBody}>
                  <ScrollViewer>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>{t("panels.doc.intTimeline.col.frame")}</th>
                          <th>{t("panels.doc.intTimeline.col.tState")}</th>
                          <th>{t("panels.doc.intTimeline.col.beam")}</th>
                          <th>{t("panels.doc.intTimeline.col.source")}</th>
                          <th>{t("panels.doc.intTimeline.col.event")}</th>
                          <th>{t("panels.doc.intTimeline.col.detail")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listRows.map((m) => {
                          const e = m.event;
                          const beam = beamOf(e.pos28, timing);
                          return (
                            <tr
                              key={e.seq}
                              className={classnames(styles.eventRow, {
                                [styles.selectedRow]: e.seq === selected
                              })}
                              onClick={() => select(m)}
                            >
                              <td>{fmt(e.frame)}</td>
                              <td>{fmt(toT(e.pos28))}</td>
                              <td>{`L${beam.line}:${beam.hc}`}</td>
                              <td className={styles.nameCell}>{sourceLabel(e)}</td>
                              <td>
                                {t(KIND_KEYS[e.kind] ?? "panels.doc.intTimeline.kind.request")}
                              </td>
                              <td>
                                <EventDetail m={m} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {visibleMarkers.length > listRows.length && (
                      <div className={styles.muted}>
                        {t("panels.doc.intTimeline.more", {
                          count: visibleMarkers.length - listRows.length
                        })}
                      </div>
                    )}
                  </ScrollViewer>
                </div>
              </div>
            </div>
          </SplitPanel>
        </div>
      )}
    </FullPanel>
  );
};

const MarkerGlyph = ({
  m,
  x,
  cy,
  half,
  selected,
  onClick
}: {
  m: Marker;
  x: number;
  /** The lane's middle, and half the bar's thickness */
  cy: number;
  half: number;
  selected: boolean;
  onClick: () => void;
}) => {
  const k = m.event.kind;
  const cls = classnames(styles.marker, { [styles.markerSelected]: selected });
  if (k === NextIntEventKind.Request || k === NextIntEventKind.Wait) {
    return (
      <path
        d={`M${x - 4} ${cy - half} L${x + 4} ${cy - half} L${x} ${cy - half - 6} Z`}
        className={classnames(cls, styles.markerReq)}
        onClick={onClick}
      />
    );
  }
  if (k === NextIntEventKind.Acknowledge || k === NextIntEventKind.Nmi) {
    return (
      <circle
        cx={x}
        cy={cy}
        r={selected ? 5 : 3.5}
        className={classnames(cls, m.late ? styles.markerLate : styles.markerAck)}
        onClick={onClick}
      />
    );
  }
  if (k === NextIntEventKind.Reti || k === NextIntEventKind.End || k === NextIntEventKind.NmiEnd) {
    return (
      <path
        d={`M${x} ${cy + half - 4} l4 4 l-4 4 l-4 -4 Z`}
        className={classnames(cls, styles.markerReti)}
        onClick={onClick}
      />
    );
  }
  // --- LOST, RETN in service, RETI ignored: a cross
  return (
    <path
      d={`M${x - 4} ${cy - 4} l8 8 M${x + 4} ${cy - 4} l-8 8`}
      className={classnames(cls, styles.markerBad)}
      onClick={onClick}
    />
  );
};

const EventDetail = ({ m }: { m: Marker }) => {
  const t = useT();
  const e = m.event;
  if (e.kind === NextIntEventKind.Acknowledge) {
    const vec = e.vector !== 0xff ? hex2(e.vector) : t("panels.doc.intTimeline.pulse");
    return (
      <span>
        {vec}
        {m.latency !== undefined && (
          <span
            className={m.late ? styles.late : undefined}
          >{` · ${t("panels.doc.intTimeline.latencyT", { t: Math.round(m.latency) })}`}</span>
        )}
      </span>
    );
  }
  if (e.kind === NextIntEventKind.Request) {
    return (
      <span>
        {(e.flags & NextIntEventFlag.Software) !== 0
          ? t("panels.doc.intTimeline.software")
          : (e.flags & NextIntEventFlag.Enabled) !== 0
            ? t("panels.doc.intTimeline.statusSet")
            : t("panels.doc.intTimeline.disabled")}
      </span>
    );
  }
  return <span>{hex4(e.pc)}</span>;
};

const SelectionInfo = ({
  m,
  events,
  timing,
  onReveal
}: {
  m: Marker;
  events: NextIntEvent[];
  timing: TimelineTiming;
  onReveal: (address: number) => void;
}) => {
  const t = useT();
  const e = m.event;
  const beam = beamOf(e.pos28, timing);
  // --- The ack this event belongs to, and its request and return
  const idx = events.findIndex((x) => x.seq === e.seq);
  const ack =
    e.kind === NextIntEventKind.Acknowledge
      ? e
      : events
          .slice(idx)
          .find((x) => x.kind === NextIntEventKind.Acknowledge && x.source === e.source);
  const end = ack
    ? events
        .slice(events.indexOf(ack))
        .find((x) => x.kind === NextIntEventKind.End && x.source === e.source)
    : undefined;
  // --- In the CPU's own T-states at the handler's speed, like the latency
  const ran = ack && end ? clocksBetween(ack, end, timing) / clocksPerT(ack) : undefined;
  const rows: Array<[string, string]> = [
    [
      t("panels.doc.intTimeline.info.event"),
      `${sourceLabel(e)} · ${t(KIND_KEYS[e.kind] ?? "panels.doc.intTimeline.kind.request")}`
    ],
    [t("panels.doc.intTimeline.info.frame"), fmt(e.frame)],
    [t("panels.doc.intTimeline.info.tState"), fmt(toT(e.pos28))],
    [
      t("panels.doc.intTimeline.info.beam"),
      t("panels.doc.intTimeline.beamValue", { line: beam.line, hc: beam.hc })
    ],
    [t("panels.doc.intTimeline.info.pc"), hex4(e.pc)],
    [t("panels.doc.intTimeline.info.sp"), hex4(e.sp)]
  ];
  if (ack) {
    rows.push([
      t("panels.doc.intTimeline.info.vector"),
      ack.vector !== 0xff ? hex2(ack.vector) : t("panels.doc.intTimeline.pulse")
    ]);
    if (m.latency !== undefined || e.kind !== NextIntEventKind.Acknowledge) {
      const l = e.kind === NextIntEventKind.Acknowledge ? m.latency : undefined;
      if (l !== undefined)
        rows.push([
          t("panels.doc.intTimeline.info.latency"),
          t("panels.doc.intTimeline.latencyT", { t: Math.round(l) })
        ]);
    }
    rows.push([t("panels.doc.intTimeline.info.interrupted"), hex4(ack.pc)]);
  }
  if (ran !== undefined)
    rows.push([
      t("panels.doc.intTimeline.info.ran"),
      t("panels.doc.intTimeline.latencyT", { t: Math.round(ran) })
    ]);
  return (
    <div>
      <div className={styles.kv}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.kvRow}>
            <span className={styles.kvKey}>{k}</span>
            <span className={styles.kvValue}>{v}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => onReveal(ack ? ack.pc : e.pc)}
      >
        {ack ? t("panels.doc.intTimeline.goInterrupted") : t("panels.doc.intTimeline.goPc")}
      </button>
    </div>
  );
};

/** A small segmented control: one of a few values */
const Segmented = <T extends number>({
  options,
  value,
  onChange,
  title
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  title: string;
}) => (
  <span className={styles.segmented} title={title} role="group">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={classnames(styles.segment, { [styles.segmentOn]: o.value === value })}
        aria-pressed={o.value === value}
        onClick={() => onChange(o.value)}
      >
        {o.label}
      </button>
    ))}
  </span>
);

export const createInterruptTimelinePanel = ({ document, viewState }: DocumentProps) => (
  <InterruptTimelinePanel document={document} viewState={viewState} />
);

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";

import {
  clocksToT,
  decodeDmaBus,
  dmaBusFrame,
  holdsOfFrame,
  type DmaBusHold
} from "@common/zxnext/dma/dmaBus";
import { useT } from "@common/i18n/useT";
import { SmallIconButton } from "@controls/IconButton";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import { EmptyState, PanelHeader, PanelHeaderGroup } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useEmuStateListener } from "../../useStateRefresh";
import styles from "./DmaBusTimelinePanel.module.scss";

/**
 * The DMA Bus Timeline document (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §13.2): the core's ring of bus
 * holds as an overview of the DMA's share of each frame (with the frames whose interrupt a hold
 * swallowed), a to-scale detail of the selected frame, and its figures. Opening it switches the ring on;
 * closing it switches it off.
 */

/** The overview shows at most this many frames, the newest */
const OVERVIEW_FRAMES = 48;
/** The SVGs' coordinate width: they stretch to the panel's width */
const SVG_W = 900;
const LABEL_W = 60;
const ZOOMS = [1, 16, 128] as const;

const fmt = (n: number) => Math.round(n).toLocaleString("en");

const DmaBusTimelinePanel = (_props: DocumentProps) => {
  const t = useT();
  const emuApi = useEmuApi();

  const [recording, setRecording] = useState(true);
  const recordingRef = useRef(true);
  const holdsRef = useRef<DmaBusHold[]>([]);
  const countRef = useRef(0);
  const [version, setVersion] = useState(0);
  const [meta, setMeta] = useState<{ count: number; capacity: number; currentFrame: number; tactsInFrame: number }>();
  const [unavailable, setUnavailable] = useState(false);
  const [follow, setFollow] = useState(true);
  const [selected, setSelected] = useState<number>();
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [center, setCenter] = useState<number>();

  // --- Incremental reads: only the holds written since the last one (or all, after a clear)
  const refresh = useCallback(async () => {
    try {
      if (recordingRef.current) await emuApi.setDmaBusRecording(true);
      let since = countRef.current;
      let bus = await emuApi.getDmaBus(since);
      if (bus.count < since) {
        holdsRef.current = [];
        since = 0;
        bus = await emuApi.getDmaBus(0);
      }
      const fresh = decodeDmaBus(bus);
      if (fresh.length > 0) {
        const all = holdsRef.current.concat(fresh);
        holdsRef.current = all.length > bus.capacity ? all.slice(all.length - bus.capacity) : all;
      }
      countRef.current = bus.count;
      setMeta({ count: bus.count, capacity: bus.capacity, currentFrame: bus.currentFrame, tactsInFrame: bus.tactsInFrame });
      setUnavailable(false);
      setVersion((v) => v + 1);
    } catch {
      setUnavailable(true);
    }
  }, [emuApi]);
  useEmuStateListener(emuApi, refresh);

  // --- The ring records while the document is open (§13.1)
  useEffect(() => {
    void emuApi.setDmaBusRecording(true).catch(() => undefined);
    return () => {
      void emuApi.setDmaBusRecording(false).catch(() => undefined);
    };
  }, [emuApi]);

  const toggleRecording = async (on: boolean) => {
    recordingRef.current = on;
    setRecording(on);
    await emuApi.setDmaBusRecording(on);
  };
  const clear = async () => {
    await emuApi.clearDmaBus();
    holdsRef.current = [];
    countRef.current = 0;
    setSelected(undefined);
    await refresh();
  };

  const holds = holdsRef.current;
  // --- The overview's frames: from the oldest held one (at most OVERVIEW_FRAMES back) to the last complete one
  const frames = useMemo(() => {
    if (!meta || holds.length === 0) return [];
    const last = Math.max(holds[holds.length - 1].frame, meta.currentFrame - 1);
    const first = Math.max(holds[0].frame, last - OVERVIEW_FRAMES + 1);
    const out: ReturnType<typeof dmaBusFrame>[] = [];
    for (let f = first; f <= last; f++) out.push(dmaBusFrame(holds, f, meta.tactsInFrame));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, meta]);

  const lastWithHolds = [...frames].reverse().find((f) => f.holds > 0)?.frame;
  // --- The overview's scale: up to the largest share, at least 10%, so a paced transfer's few percent show
  const scaleMax = Math.min(1, Math.max(0.1, Math.ceil(Math.max(0, ...frames.map((f) => f.share)) * 10) / 10));
  const frameNo = follow || selected === undefined ? lastWithHolds : selected;
  const frame = frames.find((f) => f.frame === frameNo);
  const frameHolds = useMemo(() => (frameNo === undefined ? [] : holdsOfFrame(holds, frameNo)), [holds, frameNo]);

  if (unavailable) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState message={t("panels.doc.dmaBus.notAvailable")} />
      </FullPanel>
    );
  }

  // --- The detail's window, in 28 MHz clocks from the frame's start
  const frameLen = meta?.tactsInFrame ?? 1;
  const span = frameLen / zoom;
  const focus = center ?? (frameHolds[0]?.pos28 ?? 0) + span / 4;
  const winStart = zoom === 1 ? 0 : Math.max(0, Math.min(frameLen - span, focus - span / 2));
  const x = (pos28: number) => LABEL_W + ((pos28 - winStart) / span) * (SVG_W - LABEL_W);
  const ticks = Array.from({ length: 5 }, (_, i) => winStart + (span * i) / 4);
  const speed = frameHolds[0]?.speed ?? 0;

  const selectFrame = (f: number) => {
    setFollow(false);
    setSelected(f);
    setCenter(undefined);
  };

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
      <PanelHeader>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={recording}
            label={t("panels.doc.dmaBus.record")}
            title={t("panels.doc.dmaBus.recordTitle")}
            clicked={(v: boolean) => void toggleRecording(v)}
          />
          <SmallIconButton iconName="trash" title={t("panels.doc.dmaBus.clear")} clicked={() => void clear()} />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={follow}
            label={t("panels.doc.dmaBus.follow")}
            title={t("panels.doc.dmaBus.followTitle")}
            clicked={(v: boolean) => {
              setFollow(v);
              if (v) setCenter(undefined);
            }}
          />
          <span className={styles.segmented} role="group" title={t("panels.doc.dmaBus.zoomTitle")}>
            {ZOOMS.map((z) => (
              <button
                key={z}
                type="button"
                className={classnames(styles.segment, { [styles.segmentOn]: z === zoom })}
                aria-pressed={z === zoom}
                onClick={() => setZoom(z)}
              >
                {z === 1 ? t("panels.doc.dmaBus.zoomFrame") : `×${z}`}
              </button>
            ))}
          </span>
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span className={styles.held}>
            {meta ? t("panels.doc.dmaBus.held", { used: Math.min(meta.count, meta.capacity), capacity: meta.capacity }) : ""}
          </span>
        </PanelHeaderGroup>
      </PanelHeader>

      {frames.length === 0 || !frame ? (
        <EmptyState message={recording ? t("panels.doc.dmaBus.waiting") : t("panels.doc.dmaBus.paused")} />
      ) : (
        <ScrollViewer>
          <div className={styles.body}>
            {/* --- The overview: the DMA's share of each frame */}
            <div className={styles.title}>{t("panels.doc.dmaBus.overview")}</div>
            <svg
              viewBox={`0 0 ${SVG_W} 86`}
              className={styles.svg}
              role="img"
              aria-label={t("panels.doc.dmaBus.overviewLabel")}
            >
              <text x={LABEL_W - 6} y={16} className={styles.axisText} textAnchor="end">
                {`${Math.round(scaleMax * 100)}%`}
              </text>
              <text x={LABEL_W - 6} y={64} className={styles.axisText} textAnchor="end">
                0%
              </text>
              <line x1={LABEL_W} y1={62} x2={SVG_W} y2={62} className={styles.axis} />
              {frames.map((f, i) => {
                const w = (SVG_W - LABEL_W) / OVERVIEW_FRAMES;
                const bx = LABEL_W + i * w;
                const h = Math.max(f.holds > 0 ? 1 : 0, (Math.min(f.share, scaleMax) / scaleMax) * 50);
                return (
                  <g key={f.frame} className={styles.overviewBar} onClick={() => selectFrame(f.frame)}>
                    <title>
                      {t("panels.doc.dmaBus.frameTip", { frame: f.frame, share: (f.share * 100).toFixed(1) })}
                    </title>
                    <rect x={bx} y={10} width={w} height={52} className={classnames(styles.hit, { [styles.selectedFrame]: f.frame === frame.frame })} />
                    <rect x={bx + 1} y={62 - h} width={Math.max(1, w - 2)} height={h} className={styles.dmaBar} />
                    {f.intLost && <circle cx={bx + w / 2} cy={5} r={3} className={styles.lost} />}
                  </g>
                );
              })}
              <text x={LABEL_W} y={80} className={styles.axisText}>
                {t("panels.doc.dmaBus.frameNo", { frame: frames[0].frame })}
              </text>
              <text x={SVG_W} y={80} className={styles.axisText} textAnchor="end">
                {t("panels.doc.dmaBus.frameNo", { frame: frames[frames.length - 1].frame })}
              </text>
            </svg>

            {/* --- The selected frame to scale */}
            <div className={styles.title}>{t("panels.doc.dmaBus.detail", { frame: frame.frame })}</div>
            <svg
              viewBox={`0 0 ${SVG_W} 96`}
              className={classnames(styles.svg, styles.detail)}
              role="img"
              aria-label={t("panels.doc.dmaBus.detailLabel")}
              onClick={(e) => {
                const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const ux = ((e.clientX - box.left) / box.width) * SVG_W;
                if (ux < LABEL_W) return;
                setCenter(winStart + ((ux - LABEL_W) / (SVG_W - LABEL_W)) * span);
                if (zoom === 1) setZoom(16);
              }}
            >
              {ticks.map((tick, i) => (
                <g key={tick}>
                  <line x1={x(tick)} y1={18} x2={x(tick)} y2={22} className={styles.axis} />
                  <text
                    x={x(tick)}
                    y={14}
                    className={styles.axisText}
                    textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
                  >
                    {fmt(clocksToT(tick, 0))}
                  </text>
                </g>
              ))}
              <text x={0} y={42} className={styles.laneLabel}>
                DMA
              </text>
              <text x={0} y={72} className={styles.laneLabel}>
                CPU
              </text>
              <rect x={LABEL_W} y={58} width={SVG_W - LABEL_W} height={20} className={styles.cpuRuns} />
              {frameHolds.map((h) => {
                const x0 = Math.max(LABEL_W, x(h.pos28));
                const x1 = Math.min(SVG_W, x(h.pos28 + h.duration28));
                if (x1 < LABEL_W || x0 > SVG_W) return null;
                const w = Math.max(1, x1 - x0);
                return (
                  <g key={h.seq}>
                    <title>
                      {t("panels.doc.dmaBus.holdTip", {
                        at: fmt(clocksToT(h.pos28, 0)),
                        length: fmt(clocksToT(h.duration28, h.speed)),
                        bytes: h.bytes
                      })}
                    </title>
                    <rect x={x0} y={28} width={w} height={20} className={styles.dmaHold} />
                    <rect x={x0} y={58} width={w} height={20} className={styles.cpuHeld} />
                    {h.intLost && <path d={`M${x0},26 l-4,-7 h8 z`} className={styles.lost} />}
                  </g>
                );
              })}
              <text x={SVG_W} y={92} className={styles.axisText} textAnchor="end">
                {t("panels.doc.dmaBus.legend")}
              </text>
            </svg>

            {/* --- The frame's figures */}
            <div className={styles.stats}>
              <Stat label={t("panels.doc.dmaBus.stat.holds")} value={fmt(frame.holds)} />
              <Stat label={t("panels.doc.dmaBus.stat.bytes")} value={fmt(frame.bytes)} />
              <Stat
                label={t("panels.doc.dmaBus.stat.busTime")}
                value={t("panels.doc.dmaBus.stat.busTimeValue", {
                  t: fmt(clocksToT(frame.held28, speed)),
                  share: (frame.share * 100).toFixed(1)
                })}
              />
              <Stat
                label={t("panels.doc.dmaBus.stat.period")}
                value={
                  frame.period
                    ? t("panels.doc.dmaBus.stat.periodValue", {
                        min: Math.round(frame.period.min),
                        max: Math.round(frame.period.max),
                        average: frame.period.average.toFixed(1)
                      })
                    : "-"
                }
              />
              <Stat
                label={t("panels.doc.dmaBus.stat.lost")}
                value={frame.intLost ? t("panels.doc.dmaBus.stat.lostYes") : t("panels.doc.dmaBus.stat.lostNo")}
                warn={frame.intLost}
              />
            </div>
          </div>
        </ScrollViewer>
      )}
    </FullPanel>
  );
};

const Stat = ({ label, value, warn }: { label: string; value: string; warn?: boolean }) => (
  <div className={styles.stat}>
    <span className={styles.statLabel}>{label}</span>
    <span className={classnames(styles.statValue, { [styles.statWarn]: warn })}>{value}</span>
  </div>
);

export const createDmaBusTimelinePanel = ({ document, viewState }: DocumentProps) => (
  <DmaBusTimelinePanel document={document} viewState={viewState} />
);

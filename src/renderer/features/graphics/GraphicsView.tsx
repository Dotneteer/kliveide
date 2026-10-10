import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent
} from "react";

import { IndexedImageCanvas, pixelAt } from "@renderer/controls/Next/IndexedImageCanvas";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  autoColumns,
  decodeGraphics,
  dimMaskFor,
  frameGeometry,
  normalizeLook,
  type DecodedGraphics,
  type GraphicsLook
} from "@common/reverse/graphicsDecode";
import type { GraphicCandidate } from "@common/reverse/graphicsCandidates";
import styles from "./GraphicsView.module.scss";

/*
 * Memory as bitmaps: the graphics finder's view (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5, R5).
 *
 * One component, used by the static memory dump's `graphics` view mode and by the live *Graphics*
 * document. It is handed the bytes and a look; it owns only what is about this view instant —
 * scroll position, the hovered byte, the selection.
 *
 * - **Virtualised (G-T4).** Only the frame rows in view are decoded and drawn; the scroll area is a
 *   spacer as tall as the whole sheet, so the native scrollbar works and a 64K view at width 1 costs
 *   no more than a 16-byte one. The scroll position is an address.
 * - **Pixels are hardware colours, the chrome is tokens (G-T3).** Ink and paper come from the ZX
 *   palette; the selection, the named graphics and the code band are drawn on one overlay canvas in
 *   `--color-graphics-*`.
 * - **Frames align to the last Go to.** A frame starts wherever the reader said the graphic starts,
 *   so sweeping the width keeps that byte at the top-left of a frame.
 */

/** A span of bytes, inclusive, as offsets into `bytes`. */
export type ByteSpan = { start: number; end: number };

/** A named graphic, as the overlay frames it. */
export type GraphicMark = ByteSpan & { label?: string };

export type GraphicsViewMenu = {
  onShowIn?: (view: "memory" | "disassembly", offset: number) => void;
  onNameGraphic?: (span: ByteSpan) => void;
  /** `atZoom`: at the view's zoom; otherwise 1:1. */
  onSavePng?: (span: ByteSpan, atZoom: boolean) => void;
  onExportSource?: (span: ByteSpan) => void;
};

export type GraphicsViewProps = {
  bytes: Uint8Array;
  /** The address `bytes[0]` is listed at. */
  baseAddress: number;
  look: GraphicsLook;
  onLookChange: (patch: Partial<GraphicsLook>) => void;
  /** Scroll to (and align frames at) an offset; a new version repeats the same offset. */
  jump?: { offset: number; version: number };
  /** Where the view starts, before any jump. */
  initialTopOffset?: number;
  /** The first byte of the top frame row, when scrolling settles. */
  onTopOffsetChange?: (offset: number) => void;
  /** Bytes the CPU never read, when there is a profile; drives `dimUnread`. */
  unread?: (offset: number) => boolean;
  named?: GraphicMark[];
  /** Spans the listing decodes as code: hatched, so the picture shows where it disagrees. */
  codeSpans?: ByteSpan[];
  /** The label containing a byte, for the hover line. */
  labelAt?: (offset: number) => string | undefined;
  decimalView?: boolean;
  menu?: GraphicsViewMenu;
  /** Told while the user drags or edits, so a live document can hold its refresh (G-T2). */
  onInteractingChange?: (interacting: boolean) => void;
  /** Where graphics probably are (`graphicsCandidates.ts`): a side list with *Go to*. */
  candidates?: GraphicCandidate[];
};

type Selection = { anchor: number; active: number };

const spanOf = (selection: Selection): ByteSpan => ({
  start: Math.min(selection.anchor, selection.active),
  end: Math.max(selection.anchor, selection.active)
});

export const GraphicsView = ({
  bytes,
  baseAddress,
  look,
  onLookChange,
  jump,
  initialTopOffset = 0,
  onTopOffsetChange,
  unread,
  named,
  codeSpans,
  labelAt,
  decimalView = false,
  menu,
  onInteractingChange,
  candidates
}: GraphicsViewProps) => {
  const [showCandidates, setShowCandidates] = useState(false);
  const l = useMemo(() => normalizeLook(look), [look]);
  const geometry = frameGeometry(l);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  /** The offset frames are aligned to: the last Go to, raw, so any column count keeps it a row start. */
  const [phase, setPhase] = useState(initialTopOffset);
  // --- Also a ref: a re-layout in the same commit as a jump must see the jump's phase
  const phaseRef = useRef(initialTopOffset);
  const [selection, setSelection] = useState<Selection | undefined>();
  const [hover, setHover] = useState<number | undefined>();
  const dragging = useRef(false);
  const [menuState, menuApi] = useContextMenuState();
  const pendingTopOffset = useRef<number>(initialTopOffset);
  const scrollEndTimer = useRef<ReturnType<typeof setTimeout>>();
  /** The byte at the top of the view, kept across re-layouts. */
  const lastTop = useRef(initialTopOffset);
  /** A scroll position set by the view itself: its scroll event must not move `lastTop`. */
  const programmaticTop = useRef<number | undefined>(undefined);

  // --- The panel's size decides how many frames fit across and how many rows to draw
  useLayoutEffect(() => {
    const element = scrollerRef.current;
    if (!element) return undefined;
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columns = l.columns > 0 ? l.columns : autoColumns(l, Math.max(0, viewport.width - 4));
  const frameBytes = geometry.frameBytes;
  // --- Frame k starts at `alignedPhase + k * frameBytes`, and frame 0 starts a sheet row, so the
  // --- byte the reader went to is a row's top-left frame; k0 is the first (partial) row's first frame
  const alignedPhase = mod(phase, frameBytes * columns);
  const k0 = firstFrameOf(alignedPhase, frameBytes, columns);
  const frameTotal = Math.max(0, Math.ceil((bytes.length - alignedPhase) / frameBytes) - k0);
  const gap = l.frameGap ? 1 : 0;
  const rowPx = (geometry.heightPx + gap) * l.zoom;
  const rowTotal = Math.ceil(frameTotal / columns);
  const firstRow = Math.max(0, Math.min(rowTotal - 1, Math.floor(scrollTop / rowPx)));
  const rowsInView = Math.ceil((viewport.height || rowPx) / rowPx) + 1;
  const firstFrame = firstRow * columns;
  const framesDrawn = Math.max(0, Math.min(rowsInView * columns, frameTotal - firstFrame));
  const frameStart = (globalFrame: number) => alignedPhase + (k0 + globalFrame) * frameBytes;

  const decoded = useMemo<DecodedGraphics>(
    () => decodeGraphics(bytes, l, frameStart(firstFrame), framesDrawn, columns, k0 + firstFrame),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bytes, l, alignedPhase, firstFrame, framesDrawn, columns]
  );
  const dim = useMemo(
    () => (l.dimUnread && unread ? dimMaskFor(decoded.byteMap, unread) : undefined),
    [decoded, l.dimUnread, unread]
  );
  const abgr = useMemo(() => {
    const table = new Uint32Array(256);
    table[0] = SPECTRUM_48_COLORS[l.paper];
    table[1] = SPECTRUM_48_COLORS[l.ink];
    return table;
  }, [l.ink, l.paper]);

  /** Scroll so the frame row holding `offset` is at the top. */
  const scrollToOffset = useCallback(
    (offset: number, align: boolean) => {
      if (align) {
        phaseRef.current = offset;
        setPhase(offset);
      }
      const nextPhase = mod(phaseRef.current, frameBytes * columns);
      const nextK0 = firstFrameOf(nextPhase, frameBytes, columns);
      const frame = Math.floor((offset - nextPhase) / frameBytes) - nextK0;
      const top = Math.max(0, Math.floor(frame / columns)) * rowPx;
      if (scrollerRef.current) {
        scrollerRef.current.scrollTop = top;
        programmaticTop.current = scrollerRef.current.scrollTop;
      }
      setScrollTop(top);
      // --- What a later re-layout (the panel measured, the width swept) keeps at the top
      lastTop.current = offset;
    },
    [columns, frameBytes, rowPx]
  );

  useEffect(() => {
    if (jump) scrollToOffset(jump.offset, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.offset, jump?.version]);

  // --- Keep the top byte in place when the look changes the frame size or the columns
  useEffect(() => {
    scrollToOffset(lastTop.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameBytes, columns, rowPx]);

  const onScroll = () => {
    const top = scrollerRef.current?.scrollTop ?? 0;
    setScrollTop(top);
    // --- The view's own scroll (a jump, a re-layout) already set `lastTop` exactly; a scroll event
    // --- arriving after the columns changed would round it to a stale row
    if (programmaticTop.current !== undefined && Math.abs(top - programmaticTop.current) < 1) return;
    programmaticTop.current = undefined;
    const row = Math.floor(top / rowPx);
    const offset = Math.max(0, frameStart(row * columns));
    lastTop.current = offset;
    pendingTopOffset.current = offset;
    clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => onTopOffsetChange?.(pendingTopOffset.current), 150);
  };
  useEffect(() => () => clearTimeout(scrollEndTimer.current), []);

  const offsetAt = (event: MouseEvent<HTMLElement>): number | undefined => {
    const { x, y } = pixelAt(event, l.zoom, l.zoom);
    if (x < 0 || y < 0 || x >= decoded.width || y >= decoded.height) return undefined;
    const offset = decoded.byteMap[y * decoded.width + x];
    return offset >= 0 ? offset : undefined;
  };

  const setInteracting = (value: boolean) => {
    dragging.current = value;
    onInteractingChange?.(value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        if (l.layout !== "screen") onLookChange({ width: Math.max(1, l.width - 1) });
        break;
      case "ArrowRight":
        if (l.layout !== "screen") onLookChange({ width: Math.min(32, l.width + 1) });
        break;
      case "ArrowUp":
        if (scroller) scroller.scrollTop -= l.zoom;
        break;
      case "ArrowDown":
        if (scroller) scroller.scrollTop += l.zoom;
        break;
      case "PageUp":
        if (scroller) scroller.scrollTop -= rowPx;
        break;
      case "PageDown":
        if (scroller) scroller.scrollTop += rowPx;
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      // --- The emulated machine listens on `window` while it runs.
      event.stopPropagation();
    }
  };

  const selected = selection ? spanOf(selection) : undefined;
  const hoverText = useMemo(() => {
    const offset = hover;
    if (offset === undefined) return undefined;
    const address = (baseAddress + offset) & 0xffff;
    const value = bytes[offset];
    const frame = Math.floor((offset - alignedPhase) / frameBytes);
    const label = labelAt?.(offset);
    const addressText = decimalView ? String(address) : `$${toHexa4(address)}`;
    return [
      addressText,
      `$${toHexa2(value)} %${value.toString(2).padStart(8, "0")}`,
      `frame ${frame}`,
      ...(label ? [label] : [])
    ].join(" · ");
  }, [alignedPhase, baseAddress, bytes, decimalView, frameBytes, hover, labelAt]);

  const menuSpan: ByteSpan | undefined = selected ?? (hover !== undefined ? { start: hover, end: hover } : undefined);

  return (
    <div className={styles.graphicsView}>
      <div className={styles.main}>
      <div
        ref={scrollerRef}
        className={styles.scroller}
        tabIndex={0}
        role="region"
        aria-label="Memory as graphics"
        onScroll={onScroll}
        onKeyDown={onKeyDown}
      >
        <div className={styles.spacer} style={{ height: rowTotal * rowPx }}>
          <div className={styles.window} style={{ top: firstRow * rowPx }}>
            <IndexedImageCanvas
              pixels={decoded.pixels}
              width={decoded.width}
              height={decoded.height}
              abgr={abgr}
              transparentAbgr={0}
              checker={false}
              zoomX={l.zoom}
              dim={dim}
              ariaLabel="Graphics"
              onPixelMove={(x, y, event) => {
                const offset = decoded.byteMap[y * decoded.width + x];
                setHover(offset >= 0 ? offset : undefined);
                if (dragging.current && offset >= 0 && event.buttons & 1) {
                  setSelection((current) => (current ? { ...current, active: offset } : current));
                }
              }}
              onLeave={() => setHover(undefined)}
              onPixelContextMenu={(x, y, event) => {
                event.preventDefault();
                const offset = decoded.byteMap[y * decoded.width + x];
                if (offset >= 0 && (!selected || offset < selected.start || offset > selected.end)) {
                  setSelection({ anchor: offset, active: offset });
                }
                menuApi.show(event);
              }}
            >
              <div
                className={styles.hitArea}
                onMouseDown={(event) => {
                  if (event.button !== 0) return;
                  const offset = offsetAt(event);
                  if (offset === undefined) return;
                  setSelection((current) =>
                    event.shiftKey && current ? { ...current, active: offset } : { anchor: offset, active: offset }
                  );
                  setInteracting(true);
                }}
                onMouseUp={() => setInteracting(false)}
              />
              <GraphicsOverlay
                decoded={decoded}
                zoom={l.zoom}
                selected={selected}
                hover={hover}
                named={named}
                codeSpans={codeSpans}
              />
            </IndexedImageCanvas>
          </div>
        </div>
      </div>
      {showCandidates && candidates && (
        <ul className={styles.candidates} aria-label="Graphics candidates">
          <li className={styles.candidatesNote}>Heuristic guesses — check each one.</li>
          {candidates.length === 0 && <li className={styles.candidatesNote}>Nothing found.</li>}
          {candidates.map((candidate) => (
            <li key={`${candidate.kind}:${candidate.start}`}>
              <button
                type="button"
                className={styles.candidate}
                onClick={() => {
                  if (Object.keys(candidate.look).length) onLookChange(candidate.look);
                  scrollToOffset(candidate.start, true);
                  setSelection({ anchor: candidate.start, active: candidate.end });
                }}
              >
                {candidate.description}
              </button>
            </li>
          ))}
        </ul>
      )}
      </div>
      <div className={styles.statusLine} aria-live="polite">
        {candidates && (
          <button type="button" className={styles.candidateToggle} onClick={() => setShowCandidates((v) => !v)}>
            {`${showCandidates ? "Hide" : "Show"} candidates (${candidates.length})`}
          </button>
        )}
        {hoverText ??
          (selected
            ? `Selected ${selected.end - selected.start + 1} byte(s) from $${toHexa4((baseAddress + selected.start) & 0xffff)}`
            : "Hover a pixel to see its byte; drag to select. ← → change the width.")}
      </div>
      {menu && (
        <ContextMenu state={menuState} onClickOutside={menuApi.conceal}>
          {menu.onShowIn && menuSpan && (
            <>
              <ContextMenuItem
                text="Show in Memory"
                clicked={() => {
                  menuApi.conceal();
                  menu.onShowIn!("memory", menuSpan.start);
                }}
              />
              <ContextMenuItem
                text="Show in Disassembly"
                clicked={() => {
                  menuApi.conceal();
                  menu.onShowIn!("disassembly", menuSpan.start);
                }}
              />
            </>
          )}
          {menu.onNameGraphic && menuSpan && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                text="Name Graphic…"
                clicked={() => {
                  menuApi.conceal();
                  menu.onNameGraphic!(menuSpan);
                }}
              />
            </>
          )}
          {menu.onSavePng && menuSpan && (
            <>
              <ContextMenuItem
                text="Save as PNG (1:1)…"
                clicked={() => {
                  menuApi.conceal();
                  menu.onSavePng!(menuSpan, false);
                }}
              />
              <ContextMenuItem
                text={`Save as PNG (${l.zoom}×)…`}
                clicked={() => {
                  menuApi.conceal();
                  menu.onSavePng!(menuSpan, true);
                }}
              />
            </>
          )}
          {menu.onExportSource && menuSpan && (
            <ContextMenuItem
              text="Export as Source…"
              clicked={() => {
                menuApi.conceal();
                menu.onExportSource!(menuSpan);
              }}
            />
          )}
        </ContextMenu>
      )}
    </div>
  );
};

/** The first frame of the sheet: whole rows of frames before the phase, so frame 0 starts a row. */
function firstFrameOf(phase: number, frameBytes: number, columns: number): number {
  const before = Math.ceil(phase / frameBytes);
  return before === 0 ? 0 : -Math.ceil(before / columns) * columns;
}

function mod(value: number, by: number): number {
  return by > 0 ? ((value % by) + by) % by : 0;
}

// ─── The overlay ─────────────────────────────────────────────────────────────

const OverlayRole = {
  selected: "--color-graphics-selected",
  named: "--color-graphics-named",
  code: "--color-graphics-code",
  hover: "--color-graphics-hover",
  label: "--color-graphics-label",
  labelBg: "--bgcolor-graphics-label"
} as const;

/**
 * The marks over the pixels, on one canvas: the code band (hatched), named graphics (tinted, with
 * their name), the selection (tinted), and the hovered byte (outlined). Colours are read from the
 * tokens on the element, so the theme decides.
 */
const GraphicsOverlay = memo(
  ({
    decoded,
    zoom,
    selected,
    hover,
    named,
    codeSpans
  }: {
    decoded: DecodedGraphics;
    zoom: number;
    selected?: ByteSpan;
    hover?: number;
    named?: GraphicMark[];
    codeSpans?: ByteSpan[];
  }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    const cssW = decoded.width * zoom;
    const cssH = decoded.height * zoom;
    useLayoutEffect(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext?.("2d");
      if (!canvas || !ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const css = getComputedStyle(canvas);
      const colour = (role: keyof typeof OverlayRole) =>
        css.getPropertyValue(OverlayRole[role]).trim() || "magenta";
      const inSpans = (spans: ByteSpan[] | undefined, offset: number) =>
        !!spans?.some((s) => offset >= s.start && offset <= s.end);
      const labelled = new Map<string, { x: number; y: number }>();

      // --- One mark per byte segment: 8 pixels of one row
      const { width, height, byteMap } = decoded;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = byteMap[y * width + x];
          if (offset < 0 || (x > 0 && byteMap[y * width + x - 1] === offset)) continue;
          const px = x * zoom;
          const py = y * zoom;
          const w = 8 * zoom;
          if (inSpans(codeSpans, offset)) {
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = colour("code");
            ctx.lineWidth = 1;
            ctx.save();
            ctx.beginPath();
            ctx.rect(px, py, w, zoom);
            ctx.clip();
            ctx.beginPath();
            for (let hx = -zoom; hx < w; hx += 4) {
              ctx.moveTo(px + hx, py + zoom);
              ctx.lineTo(px + hx + zoom, py);
            }
            ctx.stroke();
            ctx.restore();
          }
          const mark = named?.find((m) => offset >= m.start && offset <= m.end);
          if (mark) {
            ctx.globalAlpha = 0.22;
            ctx.fillStyle = colour("named");
            ctx.fillRect(px, py, w, zoom);
            const key = `${mark.start}`;
            if (mark.label && offset === mark.start && !labelled.has(key)) labelled.set(key, { x: px, y: py });
          }
          if (selected && offset >= selected.start && offset <= selected.end) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = colour("selected");
            ctx.fillRect(px, py, w, zoom);
          }
          if (hover === offset) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = colour("hover");
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, w - 1, Math.max(1, zoom - 1));
          }
        }
      }
      // --- Names last, above everything
      ctx.globalAlpha = 1;
      ctx.font = `${Math.max(9, Math.min(12, zoom * 3))}px sans-serif`;
      for (const [start, at] of labelled) {
        const label = named!.find((m) => String(m.start) === start)!.label!;
        const metrics = ctx.measureText(label);
        ctx.fillStyle = colour("labelBg");
        ctx.fillRect(at.x, at.y, metrics.width + 4, 13);
        ctx.fillStyle = colour("label");
        ctx.fillText(label, at.x + 2, at.y + 10);
      }
    }, [codeSpans, cssH, cssW, decoded, hover, named, selected, zoom]);
    return <canvas ref={ref} className={styles.overlay} style={{ width: cssW, height: cssH }} />;
  }
);

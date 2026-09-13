import { useTheme } from "@renderer/theming/ThemeProvider";
import styles from "./SpriteEditor.module.scss";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { getCssStringForPaletteCode } from "@emu/machines/zxNext/palette";
import { SpriteTools } from "./sprite-common";
import { SPRITE_DIM, SpritePoint, clampToSprite } from "./sprite-raster";
import { applyTool, toolDraws } from "./sprite-tools";
import { SpriteRegion, regionContains, regionFromDrag } from "./sprite-selection";
import { HoverStore } from "./sprite-hover";
import { SpriteCursor } from "./SpriteCursor";

type Props = {
  /** Screen pixels per sprite pixel. */
  cellSize: number;
  /** Draw hairlines between pixels. Suppressed automatically when cells get too small. */
  showGrid?: boolean;
  spriteMap: Uint8Array;
  palette: number[];
  transparencyIndex: number;
  pencilColorIndex?: number;
  fillColorIndex?: number;
  tool: SpriteTools;
  /** The marked region, drawn as a dashed outline. */
  selection?: SpriteRegion;
  /** A region floating above the canvas, waiting to be committed or cancelled. */
  floating?: { region: SpriteRegion; pixels: Uint8Array };
  /**
   * Where a floating patch was lifted FROM, drawn as a hole in the sprite.
   *
   * A hole, not an edit: `spriteMap` stays the sprite as it really is, so a draw that somehow
   * interleaves with a lift commits real pixels rather than the gap. That invariant - the grid
   * never holds a map that is not the document's - is worth more than the alternative of handing
   * the grid a doctored copy, which would make losing the lifted pixels a one-line mistake.
   */
  lifted?: SpriteRegion;
  /** A drag with the select tool marked out a region. */
  onSelectRegion?: (region: SpriteRegion | undefined) => void;
  /**
   * A drag started inside the marked region, or inside a floating paste: pick those pixels up.
   *
   * The grid only reports the gesture. What it means - lift the region, keep carrying a paste that
   * was already in the air - is the editor's to decide, because only the editor knows whether the
   * pixels under the pointer have been committed yet.
   */
  onMoveStart?: (at: SpritePoint) => void;
  onMoveTo?: (at: SpritePoint) => void;
  onMoveEnd?: () => void;
  /**
   * The sprite to ghost underneath, or `undefined` for none.
   *
   * Drawn only where the *current* sprite is transparent - see the note at the render site.
   */
  onionSprite?: Uint8Array;
  /**
   * The cursor position, shared with the status bar and the keyboard.
   *
   * The grid writes it and does not read it: `SpriteCursor` subscribes on its own, so a pointer
   * move re-renders one `<rect>` rather than all 256 of them.
   */
  hover: HoverStore;
  /** A drawing operation finished. This is the only point at which the file is written. */
  onCommit?: (newSprite: Uint8Array) => void;
  /**
   * Escape was pressed. `cancelledDrag` says whether it actually aborted an operation, so the
   * editor can decide what a second Escape - the one with nothing in flight - should mean.
   */
  /** Escape cancelled a drag. The editor's own Escape chain handles every other case. */
  onCancelDrag?: () => void;
};

type DragState = {
  /**
   * What this gesture turned out to be.
   *
   * All three share the window listeners, the input clamping and the teardown, so they share one
   * state machine. Which one a mousedown starts depends on the tool and on where it landed - and
   * that is decided once, at `beginDrag`, rather than re-derived on every move.
   */
  mode: "draw" | "mark" | "move";
  /** Where the pointer went down. */
  start: SpritePoint;
  /** The map as it was before the whole operation - the "before" half of the committed edit. */
  origin: Uint8Array;
  /** The map each preview is drawn from. Advances for accumulating tools, fixed for shapes. */
  base: Uint8Array;
  /** Right-drag swaps pen and fill. */
  inverse: boolean;
  last?: SpritePoint;
};

const SpriteEditorGridComponent = ({
  cellSize,
  showGrid = true,
  spriteMap,
  palette,
  transparencyIndex,
  pencilColorIndex,
  fillColorIndex,
  tool,
  selection,
  floating,
  lifted,
  onSelectRegion,
  onMoveStart,
  onMoveTo,
  onMoveEnd,
  onionSprite,
  hover,
  onCommit,
  onCancelDrag
}: Props) => {
  // --- The canvas is exactly as big as its content; `useFittedCellSize` decides the cell.
  const gridSize = SPRITE_DIM * cellSize;
  /*
   * Hairlines need a pixel to live in. Below ~6px per cell they stop separating pixels and start
   * eating them, so the grid turns itself off rather than drawing mush.
   */
  const gridVisible = showGrid && cellSize >= 6;

  // --- Obtain the color for the current cell's border stroke
  const theme = useTheme();
  const currentCellStroke = theme.getThemeProperty("--color-pos-sprite-editor");

  /*
   * The transparency hatch is referenced as `url(#...)`, and an `id` is global to the document -
   * so two `.spr` tabs open at once were sharing one pattern definition, and closing the first
   * took the second one's hatch with it.
   */
  const patternId = `spriteHatch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const [, forceRender] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState | undefined>(undefined);
  /** What the grid currently paints. A ref, because a drag updates it faster than state settles. */
  const activeSpriteMap = useRef<Uint8Array>(spriteMap);

  /*
   * `v => v + 1`, not `version + 1`. The original closed over a stale `version`, so two moves
   * inside one commit produced the same value, React bailed out of the second, and the drag
   * dropped frames.
   */
  const repaint = useCallback(() => forceRender((v) => v + 1), []);

  useEffect(() => {
    // Adopt a sprite handed down from the parent (selection change, undo, transform).
    //
    // This used to call `onSpriteChange(spriteMap)` as well, which meant merely *opening* a `.spr`
    // wrote it back to disk, and so did clicking a thumbnail in the strip.
    activeSpriteMap.current = spriteMap;
    repaint();
  }, [spriteMap, repaint]);

  /** Publish a cursor position, with the palette index under it. */
  const publishHover = useCallback(
    (at: SpritePoint | undefined) => {
      if (!at) {
        hover.set(undefined);
        return;
      }
      hover.set({
        row: at.row,
        col: at.col,
        colorIndex: activeSpriteMap.current[at.row * SPRITE_DIM + at.col] ?? -1
      });
    },
    [hover]
  );

  /** Pointer position in sprite coordinates, from the grid's own geometry. */
  /**
   * The pixels a drag can pick up: a paste still in the air, or the marked region behind it.
   *
   * Only with a tool that does not draw - a pencil press inside a selection is still a pencil.
   */
  const grabbable = !toolDraws(tool) && onMoveStart ? (floating?.region ?? selection) : undefined;

  const pointAt = useCallback(
    (e: { clientX: number; clientY: number }): SpritePoint | undefined => {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 1) return undefined;
      // Derived from the element rather than from a mousedown delta, so it stays correct when the
      // grid is scrolled, scaled or re-laid-out mid-drag.
      const size = rect.width / SPRITE_DIM;
      return {
        row: Math.floor((e.clientY - rect.top) / size),
        col: Math.floor((e.clientX - rect.left) / size)
      };
    },
    []
  );

  const dispatchTool = useCallback(
    (state: DragState, to: SpritePoint) =>
      applyTool(
        state.base,
        tool,
        // Accumulating tools continue from where they were; shapes are re-drawn from the anchor.
        tool === "pencil" ? state.last ?? to : state.start,
        to,
        // A right-drag swaps the two colours - a real feature, and one nothing said out loud until
        // the tooltips were rewritten.
        state.inverse ? fillColorIndex : pencilColorIndex,
        state.inverse ? pencilColorIndex : fillColorIndex
      ),
    [tool, pencilColorIndex, fillColorIndex]
  );

  const moveTo = useCallback(
    (raw: SpritePoint) => {
      const state = drag.current;
      if (!state) return;
      // Clamp the *input*: a drag that leaves the grid follows its edge. Shapes still clip rather
      // than shrink, because the raster module clips every write it makes.
      const to = clampToSprite(raw);
      if (state.last && state.last.row === to.row && state.last.col === to.col) return;

      state.last = to;
      publishHover(to);
      if (state.mode === "move") {
        onMoveTo?.(to);
        return;
      }
      if (state.mode === "mark") {
        onSelectRegion?.(regionFromDrag(state.start, to));
        return;
      }
      const result = dispatchTool(state, to);
      if (!result) return;

      activeSpriteMap.current = result.map;
      if (result.accumulate) state.base = result.map;
      repaint();
    },
    [dispatchTool, onMoveTo, onSelectRegion, publishHover, repaint]
  );

  /*
   * The window listeners are stable identities that dispatch through refs.
   *
   * The originals were closures rebuilt every render, so `removeEventListener` was generally handed
   * a *different* function than `addEventListener` had been given - and because a drag re-renders
   * constantly, the removal almost never matched. The listeners were only ever collected because
   * the page went away.
   */
  const liveMove = useRef<(e: MouseEvent) => void>(() => {});
  const liveUp = useRef<() => void>(() => {});
  const windowMove = useRef((e: MouseEvent) => liveMove.current(e)).current;
  const windowUp = useRef(() => liveUp.current()).current;

  const detach = useCallback(() => {
    window.removeEventListener("mouseup", windowUp);
    window.removeEventListener("mousemove", windowMove);
    document.body.style.cursor = "default";
  }, [windowMove, windowUp]);

  const endDrag = useCallback(
    (at?: SpritePoint) => {
      const state = drag.current;
      if (!state) {
        detach();
        return;
      }
      /*
       * The final position is applied while the drag is still live.
       *
       * `drag.current` used to be cleared first, and `moveTo` bails when there is no drag - so the
       * cell the button came up over was silently dropped. For a pencil that was invisible, because
       * the window `mousemove` had usually already covered that cell; for the select tool it meant
       * a region never extended past where the drag began.
       */
      if (at) moveTo(at);
      detach();
      drag.current = undefined;
      // A marking drag has already published its region, and a move puts its pixels down through
      // the editor's floating state - neither has anything to commit from the drawing buffer.
      if (state.mode === "draw") onCommit?.(activeSpriteMap.current);
      if (state.mode === "move") onMoveEnd?.();
    },
    [detach, moveTo, onCommit, onMoveEnd]
  );

  liveMove.current = (e) => {
    const p = pointAt(e);
    if (p) moveTo(p);
  };
  liveUp.current = () => endDrag();

  // Unmounting mid-drag (closing the tab with the button down) used to leave both listeners
  // attached and the body cursor stuck on `crosshair`.
  useEffect(() => detach, [detach]);

  const beginDrag = useCallback(
    (at: SpritePoint, button: number) => {
      /*
       * Where the press lands decides what the drag does.
       *
       * Inside the marked region - or inside a paste still floating above the canvas - it picks the
       * pixels up and carries them. Anywhere else with the select tool it marks out a new region.
       * With a drawing tool it draws, wherever it started.
       */
      const mode: DragState["mode"] = toolDraws(tool)
        ? "draw"
        : grabbable && onMoveStart && regionContains(grabbable, at)
          ? "move"
          : "mark";
      if (mode === "mark" && !onSelectRegion) return;
      const snapshot = new Uint8Array(activeSpriteMap.current);
      drag.current = {
        mode,
        start: at,
        origin: snapshot,
        base: snapshot,
        inverse: button === 2,
        last: undefined
      };
      window.addEventListener("mouseup", windowUp);
      window.addEventListener("mousemove", windowMove);
      document.body.style.cursor = mode === "move" ? "grabbing" : "crosshair";
      if (mode === "move") {
        // No preview yet: the float has not moved, and `moveTo` would report a zero delta.
        onMoveStart(at);
        publishHover(at);
        return;
      }
      // Paint immediately, so a click without a move still marks its pixel.
      moveTo(at);
    },
    // `onSelectRegion` is read by the guard above, so a stale one would let a marking drag start
    // on a grid that has since stopped accepting them. `selection` and `floating` decide the mode,
    // so a stale pair would grab a region that has since moved - or miss one that has appeared.
    [tool, moveTo, onSelectRegion, onMoveStart, publishHover, grabbable, windowMove, windowUp]
  );

  const cells = useMemo(
    () => Array.from({ length: SPRITE_DIM * SPRITE_DIM }, (_, i) => i),
    []
  );

  return (
    <div
      tabIndex={0}
      className={styles.spriteGridWrapper}
      onMouseLeave={() => publishHover(undefined)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        const cancelling = drag.current;
        // No drag in flight: let it bubble, so the editor can back out of a floating paste, then a
        // selection, then the tool. Handling it here too would collapse two of those into one press.
        if (!cancelling) return;
        // Put the sprite back the way it was before the drag started, and drop the operation so no
        // edit is committed for it.
        activeSpriteMap.current = cancelling.origin;
        detach();
        drag.current = undefined;
        repaint();
        onCancelDrag?.();
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div ref={gridRef} style={{ width: gridSize, height: gridSize }}>
        <svg viewBox={`0 0 ${gridSize} ${gridSize}`} width={gridSize} height={gridSize}>
          <defs>
            <pattern
              id={patternId}
              x={0}
              y={0}
              width={cellSize}
              height={cellSize}
              patternUnits="userSpaceOnUse"
            >
              {HATCH.map(([x1, x2], i) => (
                <line
                  key={i}
                  x1={x1}
                  y1={0}
                  x2={x2}
                  y2={60}
                  stroke="var(--color-dash-sprite-editor)"
                />
              ))}
            </pattern>
          </defs>

          {/*
            * Pixels are drawn edge to edge and the grid is a separate overlay.
            *
            * They used to be inset by 1px and 2px short in each direction, so the "grid" was
            * whatever panel background showed through the gaps - which meant the gaps grew with the
            * zoom, the pixels were never the size they claimed to be, and pointer maths had to
            * carry the inset around with it.
            */}
          {/* One group, so the 256 pixels stay addressable without an attribute on each. */}
          <g data-role="pixels">
          {cells.map((i) => {
            const thisRow = i >> 4;
            const thisCol = i & 0x0f;
            const colorIndex = activeSpriteMap.current[i];
            return (
              <rect
                key={i}
                onMouseEnter={() => publishHover({ row: thisRow, col: thisCol })}
                onMouseDown={(e) => beginDrag({ row: thisRow, col: thisCol }, e.button)}
                onMouseUp={() => endDrag({ row: thisRow, col: thisCol })}
                x={thisCol * cellSize}
                y={thisRow * cellSize}
                width={cellSize}
                height={cellSize}
                shapeRendering="crispEdges"
                fill={
                  colorIndex === transparencyIndex
                    ? `url(#${patternId})`
                    : getCssStringForPaletteCode(palette[colorIndex])
                }
              />
            );
          })}
          </g>

          {/*
            * The onion skin sits **above** the pixels, not below them, and only shows where the
            * current sprite is transparent.
            *
            * Below would be invisible: a transparent pixel is painted with the crosshatch, which is
            * opaque, so a ghost underneath it would never be seen. Above-but-masked gives the
            * behaviour that is actually wanted - the neighbouring frame shows through the holes in
            * this one, and never over the pixels you are working on.
            *
            * Opacity only, no tint. The artwork is device colour, and a hue laid over pixel art is
            * read as part of the pixel art.
            */}
          {/*
            * The hole a lift leaves behind.
            *
            * Two rects, because the hatch is a pattern of LINES: laid straight over the pixels it
            * would let the lifted artwork show between its strokes. A transparent pixel looks the
            * way it does because the canvas ground is behind it, so the hole paints that ground
            * first and hatches on top. The pattern is `userSpaceOnUse`, so one rect over the region
            * tiles exactly as the individual cells do. The onion skin does not show through a hole,
            * since underneath it the sprite is still opaque.
            */}
          {lifted && (
            <g data-role="hole" pointerEvents="none" shapeRendering="crispEdges">
              {[`var(--bgcolor-sprite-editor)`, `url(#${patternId})`].map((fill, i) => (
                <rect
                  key={i}
                  x={lifted.col * cellSize}
                  y={lifted.row * cellSize}
                  width={lifted.width * cellSize}
                  height={lifted.height * cellSize}
                  fill={fill}
                />
              ))}
            </g>
          )}

          {onionSprite && (
            <g opacity={0.38} pointerEvents="none" shapeRendering="crispEdges">
              {cells.map((i) =>
                activeSpriteMap.current[i] === transparencyIndex &&
                onionSprite[i] !== transparencyIndex ? (
                  <rect
                    key={i}
                    x={(i & 0x0f) * cellSize}
                    y={(i >> 4) * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={getCssStringForPaletteCode(palette[onionSprite[i]])}
                  />
                ) : null
              )}
            </g>
          )}

          {gridVisible && (
            <g pointerEvents="none" shapeRendering="crispEdges">
              {GUIDES.map((i) => (
                <g key={i}>
                  <line
                    x1={i * cellSize}
                    y1={0}
                    x2={i * cellSize}
                    y2={gridSize}
                    stroke="var(--color-grid-sprite-editor)"
                    strokeWidth={1}
                  />
                  <line
                    x1={0}
                    y1={i * cellSize}
                    x2={gridSize}
                    y2={i * cellSize}
                    stroke="var(--color-grid-sprite-editor)"
                    strokeWidth={1}
                  />
                </g>
              ))}
              {/* The 8px midlines: the axis a 16x16 sprite is actually composed around. */}
              <line
                x1={8 * cellSize}
                y1={0}
                x2={8 * cellSize}
                y2={gridSize}
                stroke="var(--color-guide-sprite-editor)"
                strokeWidth={1}
              />
              <line
                x1={0}
                y1={8 * cellSize}
                x2={gridSize}
                y2={8 * cellSize}
                stroke="var(--color-guide-sprite-editor)"
                strokeWidth={1}
              />
            </g>
          )}

          {/* The outer edge, so the sprite reads as a bounded object rather than bleeding out. */}
          <rect
            x={0.5}
            y={0.5}
            width={gridSize - 1}
            height={gridSize - 1}
            fill="none"
            stroke="var(--color-guide-sprite-editor)"
            pointerEvents="none"
            shapeRendering="crispEdges"
          />

          {/*
            * A floating paste: the pixels, then the outline that says they are not committed yet.
            *
            * It is drawn over everything, because that is what it is - a thing hovering above the
            * sprite until Enter or a click puts it down, or Escape takes it away.
            */}
          {floating && (
            <g data-role="float" pointerEvents="none" shapeRendering="crispEdges">
              {Array.from({ length: floating.region.width * floating.region.height }, (_, i) => {
                const r = floating.region.row + Math.floor(i / floating.region.width);
                const c = floating.region.col + (i % floating.region.width);
                if (r < 0 || r >= SPRITE_DIM || c < 0 || c >= SPRITE_DIM) return null;
                const code = floating.pixels[i];
                return (
                  <rect
                    key={i}
                    x={c * cellSize}
                    y={r * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={
                      code === transparencyIndex
                        ? `url(#${patternId})`
                        : getCssStringForPaletteCode(palette[code])
                    }
                  />
                );
              })}
            </g>
          )}

          {/*
            * The selection outline.
            *
            * Accent dashes, not marching ants: animation inside a drawing surface competes with the
            * artwork it is drawn over, and this one sits on top of the thing the user is looking at.
            * Two strokes - a dark one under a dashed accent - so the edge survives being drawn over
            * both black and white pixels.
            */}
          {(selection || floating) && (
            <g pointerEvents="none" shapeRendering="crispEdges">
              {[
                { stroke: "var(--color-guide-sprite-editor)", dash: undefined },
                { stroke: currentCellStroke, dash: "4 3" }
              ].map(({ stroke, dash }, i) => {
                const region = floating ? floating.region : selection;
                return (
                  <rect
                    key={i}
                    x={region.col * cellSize + 0.5}
                    y={region.row * cellSize + 0.5}
                    width={region.width * cellSize - 1}
                    height={region.height * cellSize - 1}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={1}
                    strokeDasharray={dash}
                  />
                );
              })}
            </g>
          )}

          {/*
            * The hit area that says "these pixels can be picked up".
            *
            * The outline itself cannot do this job: it is `pointer-events: none`, and a shape that
            * cannot be hovered cannot carry a cursor. This rect can, so it also takes the press -
            * which keeps the 256 pixel `<rect>`s underneath ignorant of the selection entirely, and
            * gets the coordinate from the same `pointAt` the window listeners use.
            */}
          {grabbable && (
            <rect
              className={styles.grabRegion}
              x={grabbable.col * cellSize}
              y={grabbable.row * cellSize}
              width={grabbable.width * cellSize}
              height={grabbable.height * cellSize}
              fill="none"
              pointerEvents="all"
              onMouseDown={(e) => {
                const p = pointAt(e);
                if (p) beginDrag(p, e.button);
              }}
              onMouseUp={(e) => endDrag(pointAt(e))}
              onMouseMove={(e) => {
                const p = pointAt(e);
                if (p) publishHover(p);
              }}
            />
          )}

          {/*
            * Always drawn, including for the pointer tool - which was the one tool that gave no
            * feedback at all, being also the one that does nothing.
            */}
          <SpriteCursor hover={hover} cellSize={cellSize} stroke={currentCellStroke} />
        </svg>
      </div>
    </div>
  );
};

/** Interior grid lines: 1..15, since 0 and 16 are the outer edge. */
const GUIDES = Array.from({ length: SPRITE_DIM - 1 }, (_, i) => i + 1);

/** The crosshatch that marks a transparent pixel: twelve lines, as `[x1, x2]` pairs at y 0 -> 60. */
const HATCH: Array<[number, number]> = [
  [-25, 30],
  [-15, 40],
  [-5, 50],
  [5, 60],
  [15, 70],
  [25, 80],
  [5, -50],
  [15, -40],
  [25, -30],
  [35, -20],
  [45, -10],
  [55, 0]
];

/**
 * Memoized.
 *
 * With the hover readout moved to its own store and the drag preview no longer round-tripping
 * through the editor, the grid's props change only when the *document* does - so a pointer moving
 * over a pixel now re-renders this component and nothing else in the editor.
 */
export const SpriteEditorGrid = memo(SpriteEditorGridComponent);

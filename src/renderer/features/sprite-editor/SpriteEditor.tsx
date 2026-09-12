import styles from "./SpriteEditor.module.scss";
import { GenericFileContext } from "@renderer/appIde/DocumentPanels/helpers/GenericFilePanel";
import { SprFileContents, SprFileViewState, SpriteTools, migrateTool } from "./sprite-common";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DEFAULT_SPRITE_TRANSPARENCY, serializeSprFile } from "./sprite-file";
import {
  flipHorizontal,
  flipVertical,
  rotateClockwise,
  rotateCounterClockwise
} from "./sprite-raster";
import {
  SpriteDocument,
  addSprite,
  applyPixels,
  canRedo,
  canUndo,
  createDocument,
  currentSprite,
  duplicateSprite,
  moveSpriteLeft,
  moveSpriteRight,
  redo,
  removeSprite,
  selectSprite,
  undo
} from "./sprite-document";
import { createHoverStore } from "./sprite-hover";
import { useSpriteShortcuts } from "./useSpriteShortcuts";
import { applyTool } from "./sprite-tools";
import {
  SpritePatch,
  SpriteRegion,
  WHOLE_SPRITE,
  clampPasteOrigin,
  clearRegion,
  extractRegion,
  pasteRegion,
  patchRegionAt
} from "./sprite-selection";
import { spriteClipboard } from "./sprite-clipboard";
import { DEFAULT_SHEET_HEIGHT, clampSheetHeight } from "./sheet-metrics";
import { SpritePoint } from "./sprite-raster";
import { SpritePaletteHeader } from "./SpritePaletteHeader";
import { useSpritePalette } from "./useSpritePalette";
import { SpriteEditorGrid } from "./SpriteEditorGrid";
import { SpriteSheetToolbar } from "./SpriteSheetToolbar";
import { SpriteToolRail } from "./SpriteToolRail";
import { SpriteStageHeader } from "./SpriteStageHeader";
import { SpriteStatusBar } from "./SpriteStatusBar";
import { SpriteSheetBrowser } from "./SpriteSheetBrowser";
import { SpritePreview } from "./SpritePreview";
import { SpriteRulers } from "./SpriteRulers";
import { ColorSample } from "./ColorSample";
import { cellSizeFromLegacyZoom, useFittedCellSize } from "./useFittedCellSize";

/**
 * How long after the last committed operation the sheet is written.
 *
 * The editor used to rebuild the entire file and await a non-debounced `saveFileContent` - a full
 * IPC round trip - on *every pixel* of a pencil drag. Saves now happen once per completed
 * operation, and a burst of small operations coalesces into one write.
 */
const SAVE_DEBOUNCE_MS = 400;

/** The grid cancels its own drag; the editor needs no callback for it. */
const NOOP = () => {};

type Props = {
  context: GenericFileContext<SprFileContents, SprFileViewState>;
};

export const SpriteEditor = ({ context }: Props) => {
  // --- Sign the view state is initialized (to avoid flickering)
  const viewStateInitialized = useRef(false);

  // --- Sprite editor state
  const [showGrid, setShowGrid] = useState(true);
  const [showOnionSkin, setShowOnionSkin] = useState(false);
  const [sheetHeight, setSheetHeight] = useState(DEFAULT_SHEET_HEIGHT);
  /*
   * Whether Paste has anything to offer - read from the module-level clipboard store, so the button
   * lights up even when the copy happened in another open `.spr` document.
   */
  const clipboard = useSyncExternalStore(spriteClipboard.subscribe, spriteClipboard.get, spriteClipboard.get);
  const canPaste = !!(clipboard.sprite || clipboard.region);
  /** The marked pixel region, if any. */
  const [selection, setSelection] = useState<SpriteRegion | undefined>(undefined);
  /**
   * A paste in flight.
   *
   * It floats until committed, so it can be nudged into place before it touches the sprite - and so
   * Escape leaves no trace. Committing is what pushes the single undo entry.
   */
  const [floating, setFloating] = useState<{ patch: SpritePatch; at: SpritePoint } | undefined>(
    undefined
  );
  const [spriteImagesSeparated, setSpriteImagesSeparated] = useState<boolean>();
  const [showTrancparencyColor, setShowTrancparencyColor] = useState<boolean>();
  const [pencilColorIndex, setPencilColorIndex] = useState<number>();
  const [fillColorIndex, setFillColorIndex] = useState<number>();
  /*
   * The sheet, the selection and the undo history are ONE value.
   *
   * They used to be four pieces of state kept in step by hand - `selectedSpriteIndex`, `spriteMap`,
   * `editStack`/`editStackIndex` and the live `context.fileInfo.sprites` array - and every bug in
   * the undo model was a place where they came apart. `sprite-document.ts` owns the transitions.
   */
  const [doc, setDoc] = useState<SpriteDocument | undefined>(undefined);
  const [currentTool, setCurrentTool] = useState<SpriteTools>();

  /*
   * The pointer position is NOT editor state.
   *
   * It used to be three `useState` values here, written from the grid's `onMouseEnter`, so moving
   * one pixel re-rendered the palette, both toolbars and every thumbnail - and, because
   * `currentColorIndex` was mirrored into the persisted view state, dispatched into Redux as well.
   * `SpriteStatusBar` subscribes to this store on its own; nothing else re-renders.
   */
  const hover = useRef(createHoverStore()).current;

  // --- Everything the render needs, derived from the one document
  const sprites = doc?.sprites ?? [];
  const selectedSpriteIndex = doc?.selected ?? 0;
  /*
   * No "preview" state.
   *
   * A drag used to publish every intermediate map up to the editor, which handed it straight back
   * down as a prop - a full editor re-render per mouse-move for data the grid already held in a
   * ref. The grid owns the in-progress bitmap and reports only when the operation completes.
   */
  const spriteMap = doc ? currentSprite(doc) : undefined;

  /*
   * The palette and the transparency index come from the machine.
   *
   * Both used to be invented here: an identity ramp `palette[i] = i`, and `0xe3` hardcoded in eight
   * separate places. The hook keeps one array identity per distinct palette, which is what stops an
   * emulator state change from re-rendering the grid, all ten thumbnails and 256 swatches.
   */
  const { palette, transparencyIndex, source, shownBank, liveBank, pinBank } = useSpritePalette();

  // --- Set the current state according to the initial view state of the context
  useEffect(() => {
    if (viewStateInitialized.current) return;
    viewStateInitialized.current = true;
    /*
     * `zoomFactor` used to be 1..3 and is now a cell size in screen pixels, so a persisted value
     * has to be migrated by range rather than trusted. See `cellSizeFromLegacyZoom`.
     */
    setShowGrid(context.viewState?.showGrid ?? true);
    setShowOnionSkin(context.viewState?.showOnionSkin ?? false);
    setSheetHeight(context.viewState?.sheetHeight ?? DEFAULT_SHEET_HEIGHT);
    setSpriteImagesSeparated(context.viewState?.spriteImagesSeparated ?? true);
    setShowTrancparencyColor(context.viewState?.showTrancparencyColor ?? false);
    setPencilColorIndex(context.viewState?.pencilColorIndex ?? 0x0f);
    setFillColorIndex(context.viewState?.fillColorIndex ?? DEFAULT_SPRITE_TRANSPARENCY);
    setDoc(
      createDocument(context.fileInfo?.sprites, context.viewState?.selectedSpriteIndex ?? 0)
    );
    setCurrentTool(migrateTool(context.viewState?.currentTool));
  }, [context.viewState]);

  // --- Update the context view state whenever the internal state changes
  useEffect(() => {
    context.changeViewState((vs) => {
      vs.spriteImagesSeparated = spriteImagesSeparated;
      vs.showGrid = showGrid;
      vs.showOnionSkin = showOnionSkin;
      vs.showTrancparencyColor = showTrancparencyColor;
      vs.pencilColorIndex = pencilColorIndex;
      vs.fillColorIndex = fillColorIndex;
      vs.selectedSpriteIndex = selectedSpriteIndex;
      vs.currentTool = currentTool;
    });
  }, [
    showGrid,
    showOnionSkin,
    spriteImagesSeparated,
    showTrancparencyColor,
    pencilColorIndex,
    fillColorIndex,
    selectedSpriteIndex,
    currentTool
  ]);

  /*
   * Persistence.
   *
   * `latestDoc` is written synchronously by `commit` rather than waiting for the next render, so a
   * debounced write that lands after an unmount still serializes what the user last did.
   */
  const latestDoc = useRef<SpriteDocument | undefined>(undefined);
  latestDoc.current = doc;
  // Read by the swap handler, so it can stay identity-stable instead of closing over both colours.
  const pencilRef = useRef<number>();
  const fillRef = useRef<number>();
  const transparencyRef = useRef<number>();
  const toolRef = useRef<SpriteTools>();
  pencilRef.current = pencilColorIndex;
  fillRef.current = fillColorIndex;
  transparencyRef.current = transparencyIndex;
  toolRef.current = currentTool;

  const saveNow = useRef<() => Promise<void>>();
  saveNow.current = async () => {
    const current = latestDoc.current;
    if (!current?.sprites?.length) return;
    await context.saveToFile(serializeSprFile(current.sprites, context.fileInfo?.trailing));
  };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = undefined;
      void saveNow.current?.();
    }, SAVE_DEBOUNCE_MS);
  };

  // --- Never lose a debounced write to a closing tab.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
        void saveNow.current?.();
      }
    },
    []
  );

  /*
   * The single place a change becomes real.
   *
   * Every mutation - drawing, transforms, sheet operations, undo AND redo - goes through here, so
   * "this operation forgot to save" cannot come back. Undo, redo and Cut each used to mutate the
   * sprite array and return without scheduling a write, which is why deleting a sprite did not
   * reach the disk until some unrelated later edit rewrote the file.
   */
  /*
   * The single place a change becomes real.
   *
   * Every mutation - drawing, transforms, sheet operations, undo AND redo - goes through here, so
   * "this operation forgot to save" cannot come back. Undo, redo and Cut each used to mutate the
   * sprite array and return without scheduling a write.
   *
   * It reads `latestDoc.current` rather than closing over `doc`, which is what lets it - and every
   * handler built on it - keep one identity for the life of the editor. Side effects stay out of
   * the `setState` updater, where StrictMode would run them twice.
   */
  const commit = useCallback(
    (next: SpriteDocument | undefined) => {
      const current = latestDoc.current;
      if (!next || next === current) return;
      latestDoc.current = next;
      // The panel above still owns `fileInfo`; keep its array pointing at the current sheet.
      if (context.fileInfo) context.fileInfo.sprites = next.sprites;
      setDoc(next);
      scheduleSave();
    },
    [context.fileInfo]
  );

  /** Change which sprite is being edited. Navigation is not an edit, and never writes the file. */
  const navigate = useCallback((index: number) => {
    const current = latestDoc.current;
    if (!current) return;
    // A region marked on one sprite means nothing on another, and a floating paste that survived
    // the move would commit onto a sprite the user never aimed at.
    setSelection(undefined);
    setFloating(undefined);
    const next = selectSprite(current, index);
    if (next === current) return;
    latestDoc.current = next;
    setDoc(next);
  }, []);

  /** Run a whole-sprite transform as one undoable, saved operation. */
  const applyTransform = useCallback(
    (transform: (map: Uint8Array) => Uint8Array) => {
      const current = latestDoc.current;
      if (!current) return;
      commit(applyPixels(current, transform(currentSprite(current))));
    },
    [commit]
  );

  /*
   * Stable callbacks, all of them.
   *
   * Every one used to be an inline arrow rebuilt on each render. That is what defeated
   * `NextPaletteViewer`'s own `PaletteItem` memo - all 256 swatches re-rendered per mouse-move -
   * and it is what makes the memoized grid, toolbars and thumbnails below actually hold.
   */
  const handleUndo = useCallback(() => commit(undo(latestDoc.current)), [commit]);
  const handleRedo = useCallback(() => commit(redo(latestDoc.current)), [commit]);
  const handleDuplicate = useCallback(() => commit(duplicateSprite(latestDoc.current)), [commit]);
  const handleMoveLeft = useCallback(() => commit(moveSpriteLeft(latestDoc.current)), [commit]);
  const handleMoveRight = useCallback(() => commit(moveSpriteRight(latestDoc.current)), [commit]);
  const handleAdd = useCallback(
    () => commit(addSprite(latestDoc.current, transparencyRef.current)),
    [commit]
  );
  const handleCommitPixels = useCallback(
    // `applyPixels` ignores a change that paints nothing, so a click with a tool that draws nothing
    // - or a drag cancelled with Escape - pushes no undo entry and triggers no write.
    (map: Uint8Array) => commit(applyPixels(latestDoc.current, map)),
    [commit]
  );

  const handleToggleSeparated = useCallback(() => setSpriteImagesSeparated((v) => !v), []);
  const handleToggleGrid = useCallback(() => setShowGrid((v) => !v), []);
  const handleToggleOnionSkin = useCallback(() => setShowOnionSkin((v) => !v), []);

  /*
   * Resizing the sheet.
   *
   * Clamped against the editor's own height so a drag can never take the canvas below its floor or
   * shrink the sheet past one whole row. The view state is written on *release*, not per pixel -
   * a drag is one decision, not two hundred.
   */
  const editorRef = useRef<HTMLDivElement>(null);
  const handleResizeSheet = useCallback(
    (height: number) =>
      setSheetHeight(clampSheetHeight(height, editorRef.current?.clientHeight ?? 0)),
    []
  );
  const handleResizeSheetEnd = useCallback(
    (height: number) => {
      const clamped = clampSheetHeight(height, editorRef.current?.clientHeight ?? 0);
      setSheetHeight(clamped);
      context.changeViewState((vs) => (vs.sheetHeight = clamped));
    },
    [context]
  );
  const handleResetSheetHeight = useCallback(() => {
    setSheetHeight(DEFAULT_SHEET_HEIGHT);
    context.changeViewState((vs) => (vs.sheetHeight = DEFAULT_SHEET_HEIGHT));
  }, [context]);
  const handleFpsChange = useCallback(
    (fps: number) => context.changeViewState((vs) => (vs.animationFps = fps)),
    [context]
  );
  const handleToggleTransparency = useCallback(() => setShowTrancparencyColor((v) => !v), []);
  const handleRotateCcw = useCallback(
    () => applyTransform(rotateCounterClockwise),
    [applyTransform]
  );
  const handleRotateCw = useCallback(() => applyTransform(rotateClockwise), [applyTransform]);
  const handleFlipHorizontal = useCallback(() => applyTransform(flipHorizontal), [applyTransform]);
  const handleFlipVertical = useCallback(() => applyTransform(flipVertical), [applyTransform]);
  const handleSelectTool = useCallback((tool: SpriteTools) => setCurrentTool(tool), []);
  const handleSelectPencilColor = useCallback((index: number) => setPencilColorIndex(index), []);
  const handleSelectFillColor = useCallback((index: number) => setFillColorIndex(index), []);
  const handleSwapColors = useCallback(() => {
    const pen = pencilRef.current;
    setPencilColorIndex(fillRef.current);
    setFillColorIndex(pen);
  }, []);

  /*
   * The canvas is sized from the pane, not from a constant.
   *
   * This is the change the whole layout exists for. The canvas was 257/385/513 px whatever the
   * window was, so the editor got *emptier* as the pane grew; the rulers' 14px and 12px gutters are
   * handed to the hook so "fit" means fit including them.
   */
  const persistZoom = useCallback(
    (cell: number, fit: boolean) =>
      context.changeViewState((vs) => {
        vs.zoomFactor = cell;
        vs.fitToPane = fit;
      }),
    [context]
  );
  const zoom = useFittedCellSize(
    cellSizeFromLegacyZoom(context.viewState?.zoomFactor) ?? 24,
    context.viewState?.fitToPane ?? true,
    persistZoom,
    { gutterX: 14, gutterY: 12 }
  );

  /*
   * Escape backs out one level at a time: a floating paste, then the selection, then the tool.
   *
   * The grid cancels an in-flight *drag* and stops the event there; everything else reaches here.
   * The original wrote `vs.currentTool` straight into the view state and never called
   * `setCurrentTool`, so the toolbar kept the old tool and the sync effect overwrote the value
   * again - Escape did nothing at all.
   */
  const handleEscape = useCallback(() => {
    if (floatingRef.current) {
      setFloating(undefined);
      return;
    }
    if (selectionRef.current) {
      setSelection(undefined);
      return;
    }
    setCurrentTool("select");
  }, []);

  /* --- selection and the clipboard ------------------------------------------------------- */

  const selectionRef = useRef<SpriteRegion | undefined>(undefined);
  const floatingRef = useRef<{ patch: SpritePatch; at: SpritePoint } | undefined>(undefined);
  selectionRef.current = selection;
  floatingRef.current = floating;

  /** Put a floating paste down. One undo entry, for the whole paste. */
  const commitFloating = useCallback(() => {
    const pending = floatingRef.current;
    const current = latestDoc.current;
    if (!pending || !current) return false;
    setFloating(undefined);
    commit(applyPixels(current, pasteRegion(currentSprite(current), pending.patch, pending.at)));
    setSelection(patchRegionAt(pending.patch, pending.at));
    return true;
  }, [commit]);

  const handleSelectAll = useCallback(() => {
    commitFloating();
    setSelection(WHOLE_SPRITE);
  }, [commitFloating]);

  /**
   * Copy, cut, paste and delete, each acting on whichever thing is active.
   *
   * A marked pixel region wins over the sprite, so one key set covers both without a modifier for
   * each - see `sprite-clipboard.ts`.
   */
  const handleCopy = useCallback(() => {
    const current = latestDoc.current;
    if (!current) return;
    const region = selectionRef.current;
    if (region) spriteClipboard.putRegion(extractRegion(currentSprite(current), region));
    else spriteClipboard.putSprite(currentSprite(current));
  }, []);

  const handleDeleteSelection = useCallback(() => {
    const current = latestDoc.current;
    const region = selectionRef.current;
    if (!current || !region) return false;
    commit(
      applyPixels(current, clearRegion(currentSprite(current), region, transparencyRef.current))
    );
    return true;
  }, [commit]);

  /** Delete acts on the marked region when there is one, and on the whole sprite otherwise. */
  const handleDeleteOrRemove = useCallback(() => {
    if (!handleDeleteSelection()) commit(removeSprite(latestDoc.current));
  }, [commit, handleDeleteSelection]);

  const handleCut = useCallback(() => {
    handleCopy();
    // With a region marked this is a region cut; otherwise it is the sheet operation, which is
    // where "Cut sprite" finally becomes true rather than being a delete with a scissors icon.
    if (!handleDeleteSelection()) commit(removeSprite(latestDoc.current));
  }, [commit, handleCopy, handleDeleteSelection]);

  const handlePaste = useCallback(() => {
    const current = latestDoc.current;
    if (!current) return;
    const clip = spriteClipboard.get();
    if (clip.region) {
      commitFloating();
      const anchor = selectionRef.current ?? { row: 0, col: 0 };
      setFloating({
        patch: clip.region,
        at: clampPasteOrigin({ row: anchor.row, col: anchor.col }, clip.region)
      });
      return;
    }
    if (clip.sprite) {
      // A whole sprite pastes as a new sprite after the selection, not over the current one -
      // silently replacing what someone is working on is not what Paste means.
      const next = addSprite(current, transparencyRef.current);
      commit(applyPixels(next, clip.sprite));
    }
  }, [commit, commitFloating]);

  /** Nudge a floating paste, or move the marked region. Returns false if there is nothing to move. */
  const handleNudge = useCallback((dRow: number, dCol: number) => {
    const pending = floatingRef.current;
    if (!pending) return false;
    setFloating({
      patch: pending.patch,
      at: clampPasteOrigin({ row: pending.at.row + dRow, col: pending.at.col + dCol }, pending.patch)
    });
    return true;
  }, []);

  /** Step through the sheet with `[` and `]`. */
  const handlePrevSprite = useCallback(
    () => navigate((latestDoc.current?.selected ?? 0) - 1),
    [navigate]
  );
  const handleNextSprite = useCallback(
    () => navigate((latestDoc.current?.selected ?? 0) + 1),
    [navigate]
  );

  /*
   * Draw at the keyboard cursor.
   *
   * It goes through the same `applyTool` the pointer drag does, with `from === to`, so a keypress
   * is exactly a click at that pixel - including for the shape tools, where a click draws a
   * one-pixel shape. A second tool table for the keyboard is the thing this avoids.
   */
  const handleDrawAtCursor = useCallback(
    (at: SpritePoint) => {
      const current = latestDoc.current;
      if (!current) return;
      const result = applyTool(
        currentSprite(current),
        toolRef.current,
        at,
        at,
        pencilRef.current,
        fillRef.current
      );
      if (result) commit(applyPixels(current, result.map));
    },
    [commit]
  );

  const handleKeyDown = useSpriteShortcuts(hover, {
    selectTool: handleSelectTool,
    swapColors: handleSwapColors,
    undo: handleUndo,
    redo: handleRedo,
    previousSprite: handlePrevSprite,
    nextSprite: handleNextSprite,
    zoomIn: zoom.zoomIn,
    zoomOut: zoom.zoomOut,
    fit: zoom.fit,
    drawAtCursor: handleDrawAtCursor,
    cut: handleCut,
    copy: handleCopy,
    paste: handlePaste,
    selectAll: handleSelectAll,
    deleteSelection: handleDeleteSelection,
    nudge: handleNudge,
    commitFloating,
    escape: handleEscape
  });

  // --- Render the editor
  if (!viewStateInitialized.current || !doc) return null;

  /*
   * The previous sprite is the onion reference, not the next one.
   *
   * A sheet is read forward when it is an animation, so "the frame before this one" is the thing
   * worth seeing through the holes. Showing both would need the two to be told apart, and the only
   * honest way to do that over pixel art is a tint - which reads as part of the artwork.
   */
  const onionSprite =
    showOnionSkin && selectedSpriteIndex > 0 ? sprites[selectedSpriteIndex - 1] : undefined;

  const spriteLabel = `Sprite ${selectedSpriteIndex + 1} of ${sprites.length} \u00b7 16\u00d716 \u00b7 8bpp`;

  return (
    /*
     * The shortcuts live on the root, not on the canvas.
     *
     * Keys bubble, so they work wherever focus is inside the editor - the rail, the sheet, the
     * palette - rather than only while the 16x16 grid happens to hold it. `tabIndex={-1}` makes the
     * root focusable by click without adding a stop to the tab order.
     */
    <div
      ref={editorRef}
      className={styles.editor}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ "--sheet-height": `${sheetHeight}px` } as React.CSSProperties}
    >
      <SpriteSheetToolbar
        spriteCount={sprites.length}
        selectedIndex={selectedSpriteIndex}
        canUndo={canUndo(doc)}
        canRedo={canRedo(doc)}
        canPaste={canPaste}
        hasSelection={!!selection}
        separated={!!spriteImagesSeparated}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDuplicate={handleDuplicate}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDeleteOrRemove}
        onMoveLeft={handleMoveLeft}
        onMoveRight={handleMoveRight}
        onAdd={handleAdd}
        onToggleSeparated={handleToggleSeparated}
      />

      <SpriteToolRail
        tool={currentTool}
        onSelectTool={handleSelectTool}
        onRotateCcw={handleRotateCcw}
        onRotateCw={handleRotateCw}
        onFlipHorizontal={handleFlipHorizontal}
        onFlipVertical={handleFlipVertical}
      />

      <div className={styles.stage}>
        <SpriteStageHeader
          cellSize={zoom.cellSize}
          fitToPane={zoom.fitToPane}
          canZoomIn={zoom.canZoomIn}
          canZoomOut={zoom.canZoomOut}
          showGrid={showGrid}
          showOnionSkin={showOnionSkin}
          hasOnionSource={selectedSpriteIndex > 0}
          showTransparency={!!showTrancparencyColor}
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onFit={zoom.fit}
          onToggleGrid={handleToggleGrid}
          onToggleOnionSkin={handleToggleOnionSkin}
          onToggleTransparency={handleToggleTransparency}
        />
        <div ref={zoom.containerRef} className={styles.canvasArea}>
          <div className={styles.canvasFrame}>
            <SpriteRulers cellSize={zoom.cellSize} orientation="top" />
            <SpriteRulers cellSize={zoom.cellSize} orientation="left" />
            <SpriteEditorGrid
              cellSize={zoom.cellSize}
              showGrid={showGrid}
              selection={selection}
              floating={
                floating
                  ? {
                      region: patchRegionAt(floating.patch, floating.at),
                      pixels: floating.patch.pixels
                    }
                  : undefined
              }
              onSelectRegion={setSelection}
              onionSprite={onionSprite}
              spriteMap={spriteMap}
              palette={palette}
              transparencyIndex={transparencyIndex}
              pencilColorIndex={pencilColorIndex}
              fillColorIndex={fillColorIndex}
              tool={currentTool}
              hover={hover}
              onCommit={handleCommitPixels}
              onCancelDrag={NOOP}
            />
          </div>
        </div>
        <SpriteStatusBar
          hover={hover}
          palette={palette}
          transparencyIndex={transparencyIndex}
          spriteLabel={spriteLabel}
        />
      </div>

      <div className={styles.inspector}>
      <div className={styles.colorsPane}>
          <div className={styles.colorPair}>
            <span className={styles.colorSlot}>
              <span className={styles.colorSlotLabel}>Pen</span>
              <ColorSample
                color={palette[pencilColorIndex]}
                isTransparency={pencilColorIndex === transparencyIndex}
                xclass={styles.colorSampleLarge}
              />
            </span>
            <SmallIconButton
              iconName="spr-swap"
              title="Swap pen and fill colors (X)"
              enable={true}
              clicked={handleSwapColors}
            />
            <span className={styles.colorSlot}>
              <span className={styles.colorSlotLabel}>Fill</span>
              <ColorSample
                color={palette[fillColorIndex]}
                isTransparency={fillColorIndex === transparencyIndex}
                xclass={styles.colorSampleLarge}
              />
            </span>
            <span className={styles.statusSpacer} />
            <span className={styles.colorIndex}>${pencilColorIndex.toString(16).toUpperCase().padStart(2, "0")}</span>
          </div>
        </div>
        <div className={styles.inspectorSection}>
          <div className={styles.sectionHeader}>
            <SpritePaletteHeader
              source={source}
              shownBank={shownBank}
              liveBank={liveBank}
              onPinBank={pinBank}
            />
          </div>
          <div className={styles.paletteBody}>
            <NextPaletteViewer
              palette={palette}
              cellSize={17}
              transparencyIndex={transparencyIndex}
              allowSelection={true}
              // The viewer has always accepted this and the editor never passed it, so the palette
              // showed no selection at all - not the pen colour restored from the view state, and
              // not the result of the Swap button.
              selectedIndex={pencilColorIndex}
              onSelection={handleSelectPencilColor}
              onRightClick={handleSelectFillColor}
            />
          </div>
        </div>
        <div className={styles.inspectorSection}>
          <div className={styles.sectionHeader}>Preview</div>
          <SpritePreview
            sprites={sprites}
            selectedIndex={selectedSpriteIndex}
            palette={palette}
            transparencyIndex={transparencyIndex}
            initialFps={context.viewState?.animationFps ?? 12}
            onFpsChange={handleFpsChange}
          />
        </div>
      </div>

      <SpriteSheetBrowser
        sprites={sprites}
        selectedIndex={selectedSpriteIndex}
        palette={palette}
        transparencyIndex={transparencyIndex}
        separated={!!spriteImagesSeparated}
        showTransparencyColor={!!showTrancparencyColor}
        onSelect={navigate}
        height={sheetHeight}
        onResize={handleResizeSheet}
        onResizeEnd={handleResizeSheetEnd}
        onResetHeight={handleResetSheetHeight}
      />
    </div>
  );
};


import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";

import { MI_ZXNEXT } from "@common/machines/constants";
import { MEMORY_PANEL_ID } from "@common/state/common-ids";
import { EmptyState } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenuState } from "@renderer/controls/ContextMenu";
import { SplitPanel } from "@renderer/controls/SplitPanel";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import {
  spriteSegmentClass,
  spriteSegmentedClass,
  spriteSegmentLiveClass,
  SpriteZoomButtons,
  type SpriteSheetZoom
} from "@renderer/controls/Next/sprites/SpritePatternSheet";
import { toAbgrTable } from "@renderer/controls/Next/sprites/spriteAbgr";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { setIdeStatusMessageAction } from "@state/actions";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { revealWhenMounted } from "@renderer/appIde/navigation/addressNavigationAdapters";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useNextDevicePalette } from "@renderer/features/next-palette/useNextDevicePalette";
import { onLayer2Reveal, type Layer2Source } from "@renderer/features/layer2/layer2Reveal";
import { useNextLayer2State } from "@renderer/features/layer2/useNextLayer2State";
import {
  bankChipLabel,
  bankChips,
  breakOnWriteCommands,
  buildLayer2Model,
  coordinatesText,
  globalsStrip,
  layer2Overlay,
  memoryLocation,
  modelDiagnostics,
  needsShadow,
  orderGlobals,
  paletteFlags,
  pixelInfo,
  priorityDim,
  resolutionText,
  viewImage,
  withTransparency
} from "@renderer/features/layer2/layer2ViewModel";
import { Layer2OverlayCanvas } from "./Layer2OverlayCanvas";
import { Layer2InspectorPane } from "./Layer2InspectorPane";
import styles from "./Layer2Inspector.module.scss";

/**
 * The Layer 2 Inspector (`$layer2`, `.plans/LAYER2_INSPECTOR_PLAN.md`, G3.5): the live Layer 2 image
 * from one of three sources - the displayed banks (`$12`), the shadow banks (`$13`) or the set the
 * `$123B` window maps (D4) - whole or as displayed (D5), with a Banks strip and an inspector that
 * resolves every pixel to its addresses (D6).
 *
 * Read-only (D8). One snapshot per refresh, re-decoded only when its hash changes (D9); the shadow
 * banks are read only while a source shows them (T9).
 */

export type Layer2InspectorViewState = {
  source: Layer2Source;
  /** *As displayed* (scrolled and clipped) rather than *Whole layer* (D5, Q2) */
  asDisplayed: boolean;
  /** Bank boundaries and numbers on the image (Q3) */
  banks: boolean;
  /** Dim every pixel without the priority bit (D10) */
  priority: boolean;
  /** Clear the pixels whose colour equals `$14` (T6) */
  transparent: boolean;
  checker: boolean;
  zoom: SpriteSheetZoom;
  /** Pinned Layer 2 palette; undefined follows `$43` bit 2 */
  palettePin?: 0 | 1;
  bandSize?: string;
  railSize?: string;
};

export const DEFAULT_LAYER2_INSPECTOR_VIEW_STATE: Layer2InspectorViewState = {
  source: "displayed",
  asDisplayed: false,
  banks: true,
  priority: false,
  transparent: true,
  checker: true,
  zoom: 2
};

/* --- From this width (in `ch` of the panel font) the inspector is a rail beside the image */
export const RAIL_FROM_CH = 120;
const RAIL_CH = 40;
const BAND_CH = 26;

const SOURCES: { id: Layer2Source; label: string; title: string }[] = [
  { id: "displayed", label: "Displayed", title: "The banks the display reads: $12" },
  { id: "shadow", label: "Shadow", title: "The shadow banks: $13" },
  { id: "window", label: "Write window", title: "The banks the $123B window maps ($12, or $13 with bit 3)" }
];

type Selection = { kind: "pixel"; x: number; y: number; asDisplayed: boolean } | { kind: "bank"; index: number };

const Layer2InspectorPanel = ({ document, viewState }: DocumentProps<Partial<Layer2InspectorViewState>>) => {
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const isNext = machineId === MI_ZXNEXT;
  const documentHubService = useDocumentHubService();
  const { ideCommandsService } = useAppServices();
  const dispatch = useDispatch();

  const [look, setLook] = useState<Layer2InspectorViewState>({
    ...DEFAULT_LAYER2_INSPECTOR_VIEW_STATE,
    ...(viewState ?? {})
  });
  const updateLook = useCallback(
    (patch: Partial<Layer2InspectorViewState>) => {
      setLook((current) => {
        const next = { ...current, ...patch };
        if (document) documentHubService?.setDocumentViewState(document.id, next);
        return next;
      });
    },
    [document, documentHubService]
  );

  // --- The shadow banks are read only while the source needs them (T9); the window source needs
  // --- them when $123B bit 3 is set, which the previous snapshot tells
  const [wantShadow, setWantShadow] = useState(look.source === "shadow");
  const { state } = useNextLayer2State({ enabled: isNext, shadow: wantShadow });
  useEffect(() => setWantShadow(needsShadow(state, look.source)), [state, look.source]);

  const palette = useNextDevicePalette("layer2", {
    bank: look.palettePin,
    enabled: isNext && !!state,
    liveBank: state ? (state.regs.secondPalette ? 1 : 0) : undefined
  });

  const [selection, setSelection] = useState<Selection>();
  const [globalsOpen, setGlobalsOpen] = useState(false);
  const [menuState, menuApi] = useContextMenuState();
  const [pixelMenuState, pixelMenuApi] = useContextMenuState();

  // --- The layout follows the document's own width, in `ch` of the panel font
  const rootRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<HTMLSpanElement>(null);
  const [rail, setRail] = useState(false);
  const [chPx, setChPx] = useState(8);
  const measure = useCallback(() => {
    const width = rootRef.current?.clientWidth ?? 0;
    const ch = chRef.current?.getBoundingClientRect().width || 8;
    setChPx(ch);
    setRail(width / ch >= RAIL_FROM_CH);
  }, []);
  useResizeObserver(rootRef, measure);
  useEffect(measure, [measure, state !== undefined]);

  // --- `show-layer2 <source>`
  useEffect(
    () =>
      onLayer2Reveal((request) => {
        if (request.source) {
          updateLook({ source: request.source });
          setSelection(undefined);
        }
      }),
    [updateLook]
  );

  // --- Derived
  const model = useMemo(() => (state ? buildLayer2Model(state, look.source) : undefined), [state, look.source]);
  const flags = useMemo(
    () => (state && palette.deviceValues ? paletteFlags(palette.deviceValues, state.regs.globalTransparency) : undefined),
    [state, palette.deviceValues]
  );
  const raw = useMemo(() => (model ? viewImage(model, look.asDisplayed) : undefined), [model, look.asDisplayed]);
  const pixels = useMemo(
    () => (raw && flags && look.transparent ? withTransparency(raw, flags) : raw),
    [raw, flags, look.transparent]
  );
  const dim = useMemo(() => (raw && flags && look.priority ? priorityDim(raw, flags) : undefined), [raw, flags, look.priority]);
  const diagnostics = useMemo(() => (model ? modelDiagnostics(model, flags) : []), [model, flags]);
  const chips = useMemo(() => (model ? bankChips(model) : []), [model]);
  const abgr = useMemo(() => toAbgrTable(palette.palette ?? []), [palette.palette]);

  const pixelSel = selection?.kind === "pixel" && selection.asDisplayed === look.asDisplayed ? selection : undefined;
  const pixelX = pixelSel?.x;
  const pixelY = pixelSel?.y;
  const bankSel = selection?.kind === "bank" && selection.index < chips.length ? chips[selection.index] : undefined;
  const pixel = useMemo(
    () =>
      model && pixelX !== undefined && pixelY !== undefined
        ? pixelInfo(model, pixelX, pixelY, look.asDisplayed, palette.deviceValues)
        : undefined,
    [model, pixelX, pixelY, look.asDisplayed, palette.deviceValues]
  );
  const whole = useMemo(
    () => (model && bankSel ? (look.asDisplayed ? viewImage(model, false) : pixels) : undefined),
    [model, bankSel, look.asDisplayed, pixels]
  );
  const shapes = useMemo(
    () =>
      model
        ? layer2Overlay(model, {
            asDisplayed: look.asDisplayed,
            banks: look.banks,
            pixel: pixelX !== undefined && pixelY !== undefined ? { x: pixelX, y: pixelY } : undefined,
            bank: bankSel?.index
          })
        : [],
    [model, look.asDisplayed, look.banks, pixelX, pixelY, bankSel?.index]
  );

  // --- A bank chosen in the strip scrolls into view
  const bankMarker = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bankSel) bankMarker.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [bankSel]);

  const [hover, setHover] = useState<{ x: number; y: number }>();
  const hovered = model && hover ? pixelInfo(model, hover.x, hover.y, look.asDisplayed, palette.deviceValues) : undefined;

  const probe = (
    <span ref={chRef} className={styles.chProbe} aria-hidden="true">
      0
    </span>
  );

  if (!isNext || !model || !palette.palette) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState
          message={isNext ? "Waiting for the ZX Spectrum Next's Layer 2 state" : "The Layer 2 Inspector shows a running ZX Spectrum Next"}
        />
      </FullPanel>
    );
  }

  const { size } = model;
  // --- 640 x 256 pixels are half as wide as tall: double the height instead of halving the width
  const zoomX = look.zoom;
  const zoomY = size.nibbles ? look.zoom * 2 : look.zoom;
  const fromMenu = (api: { conceal: () => void }, action: () => void) => () => {
    api.conceal();
    action();
  };

  const memAt = pixel ? memoryLocation(pixel) : undefined;
  const showInMemory = async () => {
    if (!memAt) return;
    const result = await ideCommandsService.executeCommand("show-memory");
    if (!result?.success) return;
    // --- Mapped: the 64K view at the Z80 address; not mapped: the 8K page (a partition) at its offset
    await revealWhenMounted(
      documentHubService,
      MEMORY_PANEL_ID,
      memAt.kind === "z80"
        ? { kind: "address", address: memAt.address, segment: null, fullView: true, viewMode: "memory" }
        : { kind: "address", address: memAt.offset, segment: memAt.page8k, fullView: false, viewMode: "memory" }
    );
  };
  const breakCommands = pixel ? breakOnWriteCommands(model, pixel) : [];
  const breakOnWrite = async () => {
    const set: string[] = [];
    for (const command of breakCommands) {
      const result = await ideCommandsService.executeCommand(command);
      if (result?.success) set.push(command.split(" ")[1]);
      else if (result?.finalMessage) dispatch(setIdeStatusMessageAction(result.finalMessage, false));
    }
    if (set.length) dispatch(setIdeStatusMessageAction(`Breakpoint set on writes to ${set.join(" and ")}`, true));
  };

  const globals = orderGlobals(globalsStrip(model, diagnostics));
  const secondary = globals.filter((g) => !g.flag && !g.primary).length;
  const hidden = rail || globalsOpen ? 0 : secondary;

  const paletteButtons = (
    <span className={spriteSegmentedClass} role="group" aria-label="Layer 2 palette">
      {([undefined, 0, 1] as const).map((bank) => {
        const live = bank !== undefined && palette.liveBank === bank;
        const label = bank === undefined ? `Live (${(palette.liveBank ?? 0) + 1})` : bank === 0 ? "1" : "2";
        return (
          <button
            key={String(bank)}
            type="button"
            className={classnames(spriteSegmentClass, { [spriteSegmentLiveClass]: live })}
            aria-pressed={look.palettePin === bank}
            title={
              bank === undefined
                ? "Follow the palette Layer 2 draws with (NextReg $43 bit 2)"
                : `Pin the ${bank === 0 ? "first" : "second"} Layer 2 palette`
            }
            onClick={() => updateLook({ palettePin: bank })}
          >
            {label}
          </button>
        );
      })}
    </span>
  );

  const imageView = (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <span>
          {SOURCES.find((s) => s.id === look.source)!.label} · {resolutionText(size)}
        </span>
        <span className={styles.paneMeta}>
          {look.asDisplayed ? "as displayed: scrolled and clipped" : "whole layer: the screen's view outlined"}
          {state!.copperRunning && look.asDisplayed && " · the Copper is running: per-line changes are not shown"}
        </span>
      </div>
      <div className={styles.scroller}>
        <ScrollViewer>
          <div className={styles.scrollContent}>
            {pixels ? (
              <IndexedImageCanvas
                pixels={pixels}
                width={size.width}
                height={size.height}
                abgr={abgr}
                transparentAbgr={0}
                checker={look.checker}
                zoomX={zoomX}
                zoomY={zoomY}
                dim={dim}
                ariaLabel="Layer 2 image"
                className={styles.image}
                onPixelMove={(x, y) => setHover({ x, y })}
                onLeave={() => setHover(undefined)}
                onPixelClick={(x, y) => setSelection({ kind: "pixel", x, y, asDisplayed: look.asDisplayed })}
                onPixelContextMenu={(x, y, event) => {
                  event.preventDefault();
                  setSelection({ kind: "pixel", x, y, asDisplayed: look.asDisplayed });
                  pixelMenuApi.show(event);
                }}
              >
                <Layer2OverlayCanvas shapes={shapes} width={size.width} height={size.height} zoomX={zoomX} zoomY={zoomY} />
                {bankSel && !look.asDisplayed && (
                  <div
                    ref={bankMarker}
                    className={styles.bankMarker}
                    style={{
                      left: bankSel.rect.x1 * zoomX,
                      top: bankSel.rect.y1 * zoomY,
                      width: (bankSel.rect.x2 - bankSel.rect.x1 + 1) * zoomX,
                      height: (bankSel.rect.y2 - bankSel.rect.y1 + 1) * zoomY
                    }}
                  />
                )}
              </IndexedImageCanvas>
            ) : (
              <span className={styles.muted}>Reading the shadow banks…</span>
            )}
          </div>
        </ScrollViewer>
      </div>
      <div className={styles.hoverLine} aria-live="off">
        {hovered ? (
          <>
            <span>
              ({hovered.layer.x}, {hovered.layer.y})
            </span>
            <span>
              {size.nibbles ? "nibble" : "byte"} ${hovered.stored.toString(16).toUpperCase().padStart(size.nibbles ? 1 : 2, "0")}
            </span>
            <span>index {hovered.index}</span>
            <span>
              bank {hovered.address.bank16}:${hovered.address.offset.toString(16).toUpperCase().padStart(4, "0")}
            </span>
            {hovered.transparent && <span>transparent</span>}
            {hovered.priority && <span>priority</span>}
          </>
        ) : (
          <span className={styles.muted}>Point at a pixel; click to inspect it</span>
        )}
      </div>
    </div>
  );

  const inspector = (
    <Layer2InspectorPane
      layout={rail ? "rail" : "band"}
      model={model}
      pixel={pixel}
      bank={bankSel}
      whole={whole}
      abgr={abgr}
      transparentAbgr={0}
      checker={look.checker}
      memoryText={memAt?.text}
      breakText={breakCommands.map((c) => c.split(" ")[1]).join(" + ") || undefined}
      onShowInMemory={() => void showInMemory()}
      onBreakOnWrite={() => void breakOnWrite()}
    />
  );

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--main-font-family">
      <div ref={rootRef} className={styles.root} data-layout={rail ? "rail" : "band"}>
        {probe}
        <div className={styles.toolbar} role="toolbar" aria-label="Layer 2 Inspector">
          <span className={spriteSegmentedClass} role="group" aria-label="Source">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={spriteSegmentClass}
                aria-pressed={look.source === s.id}
                title={s.title}
                onClick={() => {
                  updateLook({ source: s.id });
                  setSelection(undefined);
                }}
              >
                {s.label}
              </button>
            ))}
          </span>
          <span className={styles.toolbarContext}>
            <span className={spriteSegmentedClass} role="group" aria-label="Geometry">
              <button
                type="button"
                className={spriteSegmentClass}
                aria-pressed={!look.asDisplayed}
                title="The whole layer, unscrolled, with the screen's view and the banks outlined"
                onClick={() => updateLook({ asDisplayed: false })}
              >
                Whole layer
              </button>
              <button
                type="button"
                className={spriteSegmentClass}
                aria-pressed={look.asDisplayed}
                title="Scrolled and clipped, as the layer reaches the mixer"
                onClick={() => updateLook({ asDisplayed: true })}
              >
                As displayed
              </button>
            </span>
          </span>
          <span className={styles.toolbarSpacer} />
          {rail && paletteButtons}
          {rail && <SpriteZoomButtons zoom={look.zoom} onChange={(zoom) => updateLook({ zoom })} />}
          <button
            type="button"
            className={styles.moreButton}
            aria-label="More options"
            title="More options"
            onClick={(e) => menuApi.show(e)}
          >
            ⋯
          </button>
        </div>

        <div className={classnames(styles.globals, { [styles.globalsOpen]: globalsOpen })} role="list" aria-label="Layer 2 globals">
          {globals.map((item) => (
            <span
              key={item.key}
              className={classnames(styles.globalItem, {
                [styles.globalSecondary]: !item.flag && !item.primary && hidden > 0
              })}
              role="listitem"
              title={item.title}
            >
              {item.flag ? (
                <span className={classnames(styles.chip, item.flag === "warning" ? styles.chipWarning : styles.chipInfo)}>
                  {item.flag === "warning" ? "⚠ " : ""}
                  {item.value}
                </span>
              ) : (
                <>
                  <span className={styles.globalKey}>{item.key}</span>
                  <span className={styles.globalValue}>{item.value}</span>
                </>
              )}
            </span>
          ))}
          {!rail && secondary > 0 && (
            <button type="button" className={styles.globalsMore} onClick={() => setGlobalsOpen((o) => !o)}>
              {globalsOpen ? "less" : `+${secondary} more`}
            </button>
          )}
        </div>

        <div className={styles.banks} role="list" aria-label="Layer 2 banks">
          {chips.map((c) => (
            <button
              key={c.index}
              type="button"
              role="listitem"
              className={classnames(styles.bankChip, {
                [styles.bankChipSelected]: bankSel?.index === c.index,
                [styles.bankChipOutside]: c.outsideRam
              })}
              title={c.outsideRam ? "Past the 2 MB SRAM: no pixels" : `Physical $${(0x040000 + c.bank16 * 0x4000).toString(16).toUpperCase()}`}
              onClick={() => {
                setSelection({ kind: "bank", index: c.index });
                if (look.asDisplayed) updateLook({ asDisplayed: false });
              }}
            >
              <span>{bankChipLabel(c)}</span>
              {c.roles.map((r) => (
                <span key={r} className={classnames(styles.role, styles[`role_${r}`])}>
                  {r === "window" ? "write window" : r}
                </span>
              ))}
              {c.outsideRam && <span className={classnames(styles.role, styles.role_outside)}>past 2 MB</span>}
            </button>
          ))}
        </div>

        <div className={styles.body}>
          {rail ? (
            <SplitPanel
              key="rail"
              primaryLocation="right"
              initialPrimarySize={look.railSize ?? `${Math.round(RAIL_CH * chPx)}px`}
              minSize={160}
              onPrimarySizeUpdateCompleted={(size) => updateLook({ railSize: size })}
            >
              {inspector}
              <div className={styles.views}>{imageView}</div>
            </SplitPanel>
          ) : (
            <SplitPanel
              key="band"
              primaryLocation="bottom"
              initialPrimarySize={look.bandSize ?? `${Math.round(BAND_CH * chPx)}px`}
              minSize={80}
              onPrimarySizeUpdateCompleted={(size) => updateLook({ bandSize: size })}
            >
              {inspector}
              <div className={styles.views}>{imageView}</div>
            </SplitPanel>
          )}
        </div>

        <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
          {!rail && (
            <>
              <ContextMenuItem
                text={`Palette: live (${(palette.liveBank ?? 0) + 1})`}
                selected={look.palettePin === undefined}
                clicked={fromMenu(menuApi, () => updateLook({ palettePin: undefined }))}
              />
              <ContextMenuItem
                text="Palette: 1"
                selected={look.palettePin === 0}
                clicked={fromMenu(menuApi, () => updateLook({ palettePin: 0 }))}
              />
              <ContextMenuItem
                text="Palette: 2"
                selected={look.palettePin === 1}
                clicked={fromMenu(menuApi, () => updateLook({ palettePin: 1 }))}
              />
              <ContextMenuSeparator />
              {([1, 2, 3, 4] as const).map((z) => (
                <ContextMenuItem
                  key={z}
                  text={`Zoom ${z}×`}
                  selected={look.zoom === z}
                  clicked={fromMenu(menuApi, () => updateLook({ zoom: z }))}
                />
              ))}
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            text="Bank boundaries"
            selected={look.banks}
            clicked={fromMenu(menuApi, () => updateLook({ banks: !look.banks }))}
          />
          <ContextMenuItem
            text="Highlight priority pixels"
            selected={look.priority}
            clicked={fromMenu(menuApi, () => updateLook({ priority: !look.priority }))}
          />
          <ContextMenuItem
            text="Show transparent pixels as transparent"
            selected={look.transparent}
            clicked={fromMenu(menuApi, () => updateLook({ transparent: !look.transparent }))}
          />
          <ContextMenuItem
            text="Checkerboard behind transparent pixels"
            selected={look.checker}
            clicked={fromMenu(menuApi, () => updateLook({ checker: !look.checker }))}
          />
        </ContextMenu>

        <ContextMenu state={pixelMenuState} onClickOutside={() => pixelMenuApi.conceal()}>
          <ContextMenuItem
            text={memAt ? `Show in memory (${memAt.text})` : "Show in memory (past 2 MB)"}
            disabled={!memAt}
            clicked={fromMenu(pixelMenuApi, () => void showInMemory())}
          />
          <ContextMenuItem
            text={breakCommands.length ? `Break on write (${breakCommands.map((c) => c.split(" ")[1]).join(" + ")})` : "Break on write (past 2 MB)"}
            disabled={!breakCommands.length}
            clicked={fromMenu(pixelMenuApi, () => void breakOnWrite())}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text="Copy coordinates"
            disabled={!pixel}
            clicked={fromMenu(pixelMenuApi, () => {
              if (!pixel) return;
              void navigator.clipboard?.writeText(coordinatesText(pixel));
              dispatch(setIdeStatusMessageAction("Coordinates copied to the clipboard", true));
            })}
          />
        </ContextMenu>
      </div>
    </FullPanel>
  );
};

export const createLayer2InspectorPanel = ({ document, viewState }: DocumentProps) => (
  <Layer2InspectorPanel document={document} viewState={viewState} />
);

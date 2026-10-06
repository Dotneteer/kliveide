import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";

import { MI_ZXNEXT } from "@common/machines/constants";
import { MEMORY_PANEL_ID } from "@common/state/common-ids";
import { changedCells, cellKeys } from "@common/zxnext/tilemap/tilemapUsage";
import { EmptyState } from "@renderer/controls/data";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { SplitPanel } from "@renderer/controls/SplitPanel";
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
import { onTilemapReveal } from "@renderer/features/tilemap/tilemapReveal";
import { useNextTilemapState } from "@renderer/features/tilemap/useNextTilemapState";
import { openTileSnapshot, tileSnapshotOf } from "@renderer/features/tilemap/tileSnapshot";
import type { DecodedCell } from "@common/zxnext/tilemap/tilemapDecode";
import {
  addressOf,
  buildTilemapModel,
  cellAsDb,
  cellIndex,
  globalsStrip,
  highlightedCells,
  orderGlobals,
  selectedTile,
  textTransparency,
  tileSheetOffset,
  validSelection,
  type TilemapSelection
} from "@renderer/features/tilemap/tilemapViewModel";
import { TilemapMapView } from "./TilemapMapView";
import { TilemapTilesView } from "./TilemapTilesView";
import { TilemapInspectorPane } from "./TilemapInspectorPane";
import styles from "./TilemapInspector.module.scss";

/**
 * The Tilemap Inspector (`$tilemap`, `.plans/TILEMAP_INSPECTOR_PLAN.md`, G3.4): the live tilemap and
 * its tile definitions in one document, with an inspector for the selection. The views are linked:
 * selecting a cell highlights its tile, selecting a tile outlines the cells that use it.
 *
 * The layout follows the document's own width, as the Sprite Inspector's does: narrow puts Map and
 * Tiles in tabs with the inspector in a band under them; medium keeps the tabs and moves the
 * inspector to a rail; wide offers *Both* side by side. Toolbar and globals are one line each.
 *
 * Read-only (D7). One snapshot per refresh (D2), re-decoded only when its hash changes (D9).
 */

export type TilemapInspectorView = "map" | "tiles" | "both";
export type TilemapInspectorLayout = "narrow" | "medium" | "wide";

export type TilemapInspectorViewState = {
  view: TilemapInspectorView;
  /** The tab shown where *Both* is chosen but does not fit */
  tab?: "map" | "tiles";
  /** *As displayed* (scrolled and clipped) rather than *Whole map* (D4, Q1) */
  asDisplayed: boolean;
  grid: boolean;
  indices: boolean;
  checker: boolean;
  zoom: SpriteSheetZoom;
  tileZoom: SpriteSheetZoom;
  /** Pinned tilemap palette; undefined follows `$6B` bit 4 */
  palettePin?: 0 | 1;
  /** The Tiles view's palette offset */
  paletteOffset: "fromMap" | number;
  splitSize?: string;
  bandSize?: string;
  railSize?: string;
};

export const DEFAULT_TILEMAP_INSPECTOR_VIEW_STATE: TilemapInspectorViewState = {
  view: "both",
  asDisplayed: false,
  grid: true,
  indices: false,
  checker: true,
  zoom: 2,
  tileZoom: 3,
  paletteOffset: "fromMap"
};

/*
 * The breakpoints, in `ch` of the panel font: from MEDIUM a 40-column map at zoom 2 and the rail fit
 * side by side; from WIDE the map, the tile sheet and the rail do.
 */
export const MEDIUM_FROM_CH = 120;
export const WIDE_FROM_CH = 190;
const RAIL_CH = 42;
const BAND_CH = 30;

export function layoutForWidth(widthCh: number): TilemapInspectorLayout {
  return widthCh >= WIDE_FROM_CH ? "wide" : widthCh >= MEDIUM_FROM_CH ? "medium" : "narrow";
}

/** *Both* exists only where it fits; elsewhere the document shows its tab (the map by default). */
export function effectiveView(
  view: TilemapInspectorView,
  layout: TilemapInspectorLayout,
  tab: "map" | "tiles" = "map"
): TilemapInspectorView {
  return view === "both" && layout !== "wide" ? tab : view;
}

/** Choosing a view keeps *Both* (it shows either view); where it does not fit, the tab decides. */
export function chooseView(
  current: Pick<TilemapInspectorViewState, "view" | "tab">,
  wanted: TilemapInspectorView,
  layout: TilemapInspectorLayout
): Pick<TilemapInspectorViewState, "view" | "tab"> {
  if (wanted === "both") return { view: "both", tab: current.tab };
  if (current.view === "both" && layout !== "wide") return { view: "both", tab: wanted };
  return { view: wanted, tab: wanted };
}

const offsetOptions: DropdownOption[] = [
  { value: "fromMap", label: "From map" },
  ...Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: `Fixed ${i}` }))
];

const TilemapInspectorPanel = ({
  document,
  viewState
}: DocumentProps<Partial<TilemapInspectorViewState>>) => {
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const isNext = machineId === MI_ZXNEXT;
  const documentHubService = useDocumentHubService();
  const { ideCommandsService } = useAppServices();
  const dispatch = useDispatch();

  const [look, setLook] = useState<TilemapInspectorViewState>({
    ...DEFAULT_TILEMAP_INSPECTOR_VIEW_STATE,
    ...(viewState ?? {})
  });
  const updateLook = useCallback(
    (patch: Partial<TilemapInspectorViewState>) => {
      setLook((current) => {
        const next = { ...current, ...patch };
        if (document) documentHubService?.setDocumentViewState(document.id, next);
        return next;
      });
    },
    [document, documentHubService]
  );

  const { state, baseline } = useNextTilemapState({ enabled: isNext });
  const liveBank: 0 | 1 | undefined = state
    ? (state.regs.control & 0x10) !== 0
      ? 1
      : 0
    : undefined;
  const palette = useNextDevicePalette("tilemap", {
    bank: look.palettePin,
    enabled: isNext && !!state,
    liveBank
  });

  const [rawSelection, setSelection] = useState<TilemapSelection>();
  const [globalsOpen, setGlobalsOpen] = useState(false);
  const [menuState, menuApi] = useContextMenuState();
  const [cellMenuState, cellMenuApi] = useContextMenuState();

  // --- The layout follows the document's own width, in `ch` of the panel font
  const rootRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState<TilemapInspectorLayout>("narrow");
  const [chPx, setChPx] = useState(8);
  const measure = useCallback(() => {
    const width = rootRef.current?.clientWidth ?? 0;
    const ch = chRef.current?.getBoundingClientRect().width || 8;
    setChPx(ch);
    setLayout(layoutForWidth(width / ch));
  }, []);
  useResizeObserver(rootRef, measure);
  useEffect(measure, [measure, state !== undefined]);

  const view = effectiveView(look.view, layout, look.tab);

  // --- `show-tilemap <col> <row>` / `show-tiles <n>`
  useEffect(
    () =>
      onTilemapReveal((request) => {
        setLook((current) => {
          const next =
            current.view === "both"
              ? { ...current, tab: request.view }
              : { ...current, view: request.view, tab: request.view };
          if (document) documentHubService?.setDocumentViewState(document.id, next);
          return next;
        });
        if (request.view === "map" && request.cell) setSelection({ kind: "cell", ...request.cell });
        if (request.view === "tiles" && request.tile !== undefined)
          setSelection({ kind: "tile", tile: request.tile });
      }),
    [document, documentHubService]
  );

  // --- Derived
  const model = useMemo(() => (state ? buildTilemapModel(state) : undefined), [state]);
  const selection = model ? validSelection(model, rawSelection) : undefined;
  const changed = useMemo(
    () => (model ? changedCells(baseline, cellKeys(model.cells)) : new Set<number>()),
    [baseline, model]
  );
  const highlighted = useMemo(
    () => (model ? highlightedCells(model, selection) : []),
    [model, selection]
  );
  const tileOfSelection = model ? selectedTile(model, selection) : undefined;
  const abgr = useMemo(() => toAbgrTable(palette.palette ?? []), [palette.palette]);
  const textTransparent = useMemo(
    () => (model ? textTransparency(model, palette.deviceValues) : undefined),
    [model, palette.deviceValues]
  );

  const probe = (
    <span ref={chRef} className={styles.chProbe} aria-hidden="true">
      0
    </span>
  );

  if (!isNext || !model || !palette.palette) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState
          message={
            isNext
              ? "Waiting for the ZX Spectrum Next's tilemap state"
              : "The Tilemap Inspector shows a running ZX Spectrum Next"
          }
        />
      </FullPanel>
    );
  }

  // --- With the checker off, a transparent pixel shows the colour of the transparent nibble at offset 0
  const transparentAbgr = abgr[model.state.regs.transparencyIndex & 0x0f] ?? 0;
  const selectCell = (col: number, row: number) => setSelection({ kind: "cell", col, row });
  const selectTile = (tile: number) => {
    if (view === "map")
      updateLook(layout === "wide" ? { view: "both" } : chooseView(look, "tiles", layout));
    setSelection({ kind: "tile", tile });
  };
  const fromMenu = (api: { conceal: () => void }, action: () => void) => () => {
    api.conceal();
    action();
  };
  const showsMap = view !== "tiles";
  const showsTiles = view !== "map";

  // --- The selected cell, for its context menu
  const menuCell =
    selection?.kind === "cell"
      ? model.cells[cellIndex(model, selection.col, selection.row)]
      : undefined;
  const menuAddress = menuCell
    ? addressOf(model.state, model.state.regs.mapBank7, menuCell.entryOffset)
    : undefined;

  // --- A tile popped out into a read-only viewer, frozen with the palette on screen now
  const openSnapshot = (tile: number, cell?: DecodedCell) => {
    if (!documentHubService || !palette.deviceValues) return;
    void openTileSnapshot(
      documentHubService,
      tileSnapshotOf(
        model,
        tile,
        { deviceValues: palette.deviceValues, bank: palette.shownBank },
        { cell, paletteOffset: tileSheetOffset(model, look.paletteOffset)(tile) }
      )
    );
  };

  const showInMemory = async () => {
    if (menuAddress?.z80 === undefined) return;
    const result = await ideCommandsService.executeCommand("show-memory");
    if (!result?.success) return;
    await revealWhenMounted(documentHubService, MEMORY_PANEL_ID, {
      kind: "address",
      address: menuAddress.z80,
      segment: null,
      fullView: true,
      viewMode: "memory"
    });
  };
  const breakOnWrite = async () => {
    if (menuAddress?.z80 === undefined || !menuCell) return;
    const hex = `$${menuAddress.z80.toString(16).toUpperCase().padStart(4, "0")}`;
    const result = await ideCommandsService.executeCommand(
      `bp-set ${hex} -w -len ${menuCell.raw.length}`
    );
    if (result?.success)
      dispatch(setIdeStatusMessageAction(`Breakpoint set on writes to ${hex}`, true));
  };

  // --- Toolbar pieces
  const tabs = (
    <span className={spriteSegmentedClass} role="tablist" aria-label="Tilemap Inspector view">
      {(["map", "tiles", "both"] as const)
        .filter((v) => v !== "both" || layout === "wide")
        .map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            className={spriteSegmentClass}
            aria-selected={view === v}
            aria-pressed={view === v}
            onClick={() => updateLook(chooseView(look, v, layout))}
          >
            {v === "map" ? "Map" : v === "tiles" ? "Tiles" : "Both"}
          </button>
        ))}
    </span>
  );
  const paletteButtons = (
    <span className={spriteSegmentedClass} role="group" aria-label="Tilemap palette">
      {([undefined, 0, 1] as const).map((bank) => {
        const live = bank !== undefined && palette.liveBank === bank;
        const label =
          bank === undefined ? `Live (${(palette.liveBank ?? 0) + 1})` : bank === 0 ? "1" : "2";
        return (
          <button
            key={String(bank)}
            type="button"
            className={classnames(spriteSegmentClass, { [spriteSegmentLiveClass]: live })}
            aria-pressed={look.palettePin === bank}
            title={
              bank === undefined
                ? "Follow the palette the tilemap draws with (NextReg $6B bit 4)"
                : `Pin the ${bank === 0 ? "first" : "second"} tilemap palette`
            }
            onClick={() => updateLook({ palettePin: bank })}
          >
            {label}
          </button>
        );
      })}
    </span>
  );

  const globals = orderGlobals(globalsStrip(model));
  const secondary = globals.filter((g) => !g.flag && !g.primary).length;
  const hidden = layout === "wide" || globalsOpen ? 0 : secondary;

  const mapPane = (
    <TilemapMapView
      model={model}
      look={look}
      abgr={abgr}
      transparentAbgr={transparentAbgr}
      textTransparent={textTransparent}
      selected={highlighted}
      selectedIsCell={selection?.kind === "cell"}
      changed={changed}
      onSelectCell={selectCell}
      onCellMenu={(_c, _r, event: MouseEvent<HTMLElement>) => cellMenuApi.show(event)}
    />
  );
  const tilesPane = (
    <TilemapTilesView
      model={model}
      zoom={look.tileZoom}
      checker={look.checker}
      grid={look.grid}
      paletteOffset={look.paletteOffset}
      abgr={abgr}
      transparentAbgr={transparentAbgr}
      textTransparent={textTransparent}
      selectedTile={tileOfSelection}
      onSelectTile={(tile) => setSelection({ kind: "tile", tile })}
    />
  );
  const list =
    view === "map" ? (
      mapPane
    ) : view === "tiles" ? (
      tilesPane
    ) : (
      <SplitPanel
        primaryLocation="left"
        initialPrimarySize={look.splitSize ?? "62%"}
        minSize={160}
        onPrimarySizeUpdateCompleted={(size) => updateLook({ splitSize: size })}
      >
        {mapPane}
        {tilesPane}
      </SplitPanel>
    );
  const inspector = (
    <TilemapInspectorPane
      layout={layout === "narrow" ? "band" : "rail"}
      model={model}
      selection={selection}
      paletteOffset={look.paletteOffset}
      abgr={abgr}
      transparentAbgr={transparentAbgr}
      checker={look.checker}
      textTransparent={textTransparent}
      onSelectCell={(col, row) => {
        if (view === "tiles")
          updateLook(layout === "wide" ? { view: "both" } : chooseView(look, "map", layout));
        selectCell(col, row);
      }}
      onSelectTile={selectTile}
      onOpenSnapshot={openSnapshot}
    />
  );

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--main-font-family">
      <div ref={rootRef} className={styles.root} data-layout={layout}>
        {probe}
        <div className={styles.toolbar} role="toolbar" aria-label="Tilemap Inspector">
          {tabs}
          {showsMap && (
            <span className={styles.toolbarContext}>
              <span className={spriteSegmentedClass} role="group" aria-label="Map mode">
                <button
                  type="button"
                  className={spriteSegmentClass}
                  aria-pressed={!look.asDisplayed}
                  title="The whole map, unscrolled, with the screen's view outlined"
                  onClick={() => updateLook({ asDisplayed: false })}
                >
                  Whole map
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
          )}
          {showsTiles && (
            <span className={styles.toolbarContext}>
              <Dropdown
                ariaLabel="Tile palette offset"
                options={offsetOptions}
                initialValue={String(look.paletteOffset)}
                width={110}
                onChanged={(value) =>
                  updateLook({
                    paletteOffset: value === "fromMap" ? "fromMap" : parseInt(value, 10)
                  })
                }
              />
            </span>
          )}
          <span className={styles.toolbarSpacer} />
          {layout !== "narrow" && paletteButtons}
          {layout === "wide" && (
            <>
              <SpriteZoomButtons zoom={look.zoom} onChange={(zoom) => updateLook({ zoom })} />
              <LabeledSwitch
                value={look.grid}
                label="Grid"
                title="Draw the cell grid (zoom 2 and up)"
                clicked={(value) => updateLook({ grid: value })}
              />
              <LabeledSwitch
                value={look.indices}
                label="Indices"
                title="Write each cell's tile number (zoom 3 and up)"
                clicked={(value) => updateLook({ indices: value })}
              />
            </>
          )}
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

        <div
          className={classnames(styles.globals, { [styles.globalsOpen]: globalsOpen })}
          role="list"
          aria-label="Tilemap globals"
        >
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
                <span
                  className={classnames(
                    styles.chip,
                    item.flag === "warning" ? styles.chipWarning : styles.chipInfo
                  )}
                >
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
          {layout !== "wide" && secondary > 0 && (
            <button
              type="button"
              className={styles.globalsMore}
              onClick={() => setGlobalsOpen((o) => !o)}
            >
              {globalsOpen ? "less" : `+${secondary} more`}
            </button>
          )}
        </div>

        <div className={styles.body}>
          {layout === "narrow" ? (
            <SplitPanel
              key="band"
              primaryLocation="bottom"
              initialPrimarySize={look.bandSize ?? `${Math.round(BAND_CH * chPx)}px`}
              minSize={80}
              onPrimarySizeUpdateCompleted={(size) => updateLook({ bandSize: size })}
            >
              {inspector}
              <div className={styles.views}>{list}</div>
            </SplitPanel>
          ) : (
            <SplitPanel
              key="rail"
              primaryLocation="right"
              initialPrimarySize={look.railSize ?? `${Math.round(RAIL_CH * chPx)}px`}
              minSize={160}
              onPrimarySizeUpdateCompleted={(size) => updateLook({ railSize: size })}
            >
              {inspector}
              <div className={styles.views}>{list}</div>
            </SplitPanel>
          )}
        </div>

        <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
          {layout === "narrow" && (
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
            </>
          )}
          {layout !== "wide" && (
            <>
              {([1, 2, 3, 4] as const).map((z) => (
                <ContextMenuItem
                  key={z}
                  text={`Map zoom ${z}×`}
                  selected={look.zoom === z}
                  clicked={fromMenu(menuApi, () => updateLook({ zoom: z }))}
                />
              ))}
              <ContextMenuItem
                text="Cell grid"
                selected={look.grid}
                clicked={fromMenu(menuApi, () => updateLook({ grid: !look.grid }))}
              />
              <ContextMenuItem
                text="Tile indices on the map"
                selected={look.indices}
                clicked={fromMenu(menuApi, () => updateLook({ indices: !look.indices }))}
              />
              <ContextMenuSeparator />
            </>
          )}
          {([1, 2, 3, 4] as const).map((z) => (
            <ContextMenuItem
              key={`t${z}`}
              text={`Tiles zoom ${z}×`}
              selected={look.tileZoom === z}
              clicked={fromMenu(menuApi, () => updateLook({ tileZoom: z }))}
            />
          ))}
          <ContextMenuItem
            text="Checkerboard behind transparent pixels"
            selected={look.checker}
            clicked={fromMenu(menuApi, () => updateLook({ checker: !look.checker }))}
          />
        </ContextMenu>

        <ContextMenu state={cellMenuState} onClickOutside={() => cellMenuApi.conceal()}>
          <ContextMenuItem
            text={`Show entry in memory${menuAddress?.z80Text ? ` (${menuAddress.z80Text})` : " (not mapped)"}`}
            disabled={menuAddress?.z80 === undefined}
            clicked={fromMenu(cellMenuApi, () => void showInMemory())}
          />
          <ContextMenuItem
            text="Break on write to this entry"
            disabled={menuAddress?.z80 === undefined}
            clicked={fromMenu(cellMenuApi, () => void breakOnWrite())}
          />
          <ContextMenuItem
            text="Open tile snapshot"
            disabled={!menuCell}
            clicked={fromMenu(cellMenuApi, () => menuCell && openSnapshot(menuCell.tile, menuCell))}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text="Copy as .db"
            disabled={!menuCell}
            clicked={fromMenu(cellMenuApi, () => {
              if (!menuCell) return;
              void navigator.clipboard?.writeText(cellAsDb(menuCell));
              dispatch(setIdeStatusMessageAction("Cell copied to the clipboard", true));
            })}
          />
        </ContextMenu>
      </div>
    </FullPanel>
  );
};

export const createTilemapInspectorPanel = ({ document, viewState }: DocumentProps) => (
  <TilemapInspectorPanel document={document} viewState={viewState} />
);

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import classnames from "classnames";

import { MI_ZXNEXT } from "@common/machines/constants";
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
  SPRITE_SHEET_ZOOMS,
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
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useSpritePalette } from "@renderer/features/sprite-editor/useSpritePalette";
import { onSpriteReveal } from "@renderer/features/sprites/spriteReveal";
import { openPatternSnapshot } from "@renderer/features/sprites/patternSnapshot";
import { patternSlotOf } from "@common/zxnext/sprites/spriteAttributes";
import {
  buildSpriteModel,
  changedSlots,
  defaultFilter,
  globalsStrip,
  orderGlobals,
  patternCells,
  SPRITE_FILTERS,
  spriteRows,
  syncSelection,
  type PatternFormatMode,
  type SpriteFilter,
  type SpriteSelection
} from "@renderer/features/sprites/spriteViewModel";
import { useNextSpriteState } from "@renderer/features/sprites/useNextSpriteState";
import { useSpriteBreakpoints } from "@renderer/features/sprites/useSpriteBreakpoints";
import type { NexSpriteFormat } from "@common/zxnext/sprites/spritePatterns";
import { SpritesTable } from "./SpritesTable";
import { PatternsView } from "./PatternsView";
import { SpriteInspectorPane } from "./SpriteInspectorPane";
import styles from "./SpriteInspector.module.scss";

/**
 * The Sprite Inspector (`$sprites`, `.plans/SPRITE_INSPECTOR_PLAN.md`, G3.2 + G3.3): the sprite
 * attribute table and the pattern RAM in one document, with an inspector for the selection. The two
 * views are linked: selecting a sprite highlights its pattern, selecting a pattern its users.
 *
 * The layout follows the document's own width (`.plans/mockups/sprite-inspector-layout.html`):
 * - **narrow**: Sprites and Patterns as tabs, the inspector a band under the list (details | map);
 * - **medium**: tabs, the inspector a rail beside the list;
 * - **wide**: *Both* offered, the table and the sheet side by side, with the rail.
 * The toolbar and the globals strip are one line each at every width; what does not fit folds into
 * the ⋯ menu and behind "+n more".
 *
 * Read-only (D7). One snapshot per refresh (D2), read only while the document is showing (D9).
 */

export type SpriteInspectorView = "sprites" | "patterns" | "both";

export type SpriteInspectorLayout = "narrow" | "medium" | "wide";

/** What the document remembers in its view state (and so across a workspace restore). */
export type SpriteInspectorViewState = {
  view: SpriteInspectorView;
  /** The tab shown where *Both* is chosen but does not fit */
  tab?: "sprites" | "patterns";
  filter?: SpriteFilter;
  showRaw: boolean;
  zoom: SpriteSheetZoom;
  checker: boolean;
  /** Pinned sprite palette; undefined follows `$43` bit 3 */
  palettePin?: 0 | 1;
  formatMode: PatternFormatMode;
  fallback: NexSpriteFormat;
  paletteOffset: number | "fromSprite";
  /** The table's share of *Both* */
  splitSize?: string;
  /** The inspector band's height (narrow) and the rail's width (medium, wide) */
  bandSize?: string;
  railSize?: string;
};

export const DEFAULT_SPRITE_INSPECTOR_VIEW_STATE: SpriteInspectorViewState = {
  view: "both",
  showRaw: false,
  zoom: 2,
  checker: true,
  formatMode: "asUsed",
  fallback: "8bit",
  paletteOffset: "fromSprite"
};

/*
 * The breakpoints, in `ch` of the panel font: from MEDIUM the inspector fits beside the table as a
 * rail; from WIDE the table, four columns of patterns and the rail fit side by side.
 */
export const MEDIUM_FROM_CH = 114;
export const WIDE_FROM_CH = 180;
/** The rail's width and the band's height, in `ch` of the panel font */
const RAIL_CH = 44;
const BAND_CH = 33;

export function layoutForWidth(widthCh: number): SpriteInspectorLayout {
  return widthCh >= WIDE_FROM_CH ? "wide" : widthCh >= MEDIUM_FROM_CH ? "medium" : "narrow";
}

/** *Both* exists only where it fits; elsewhere the document shows its tab (the table by default). */
export function effectiveView(
  view: SpriteInspectorView,
  layout: SpriteInspectorLayout,
  tab: "sprites" | "patterns" = "sprites"
): SpriteInspectorView {
  return view === "both" && layout !== "wide" ? tab : view;
}

/**
 * What choosing a view, by a tab or by `show-sprites` / `show-patterns`, changes. The tab always
 * follows; the chosen view does too, except that *Both* is kept - it shows either view where it fits,
 * and where it does not the tab decides. The width is never consulted, so a request that arrives
 * before the document has measured itself cannot lose *Both*.
 */
export function chooseView(
  current: Pick<SpriteInspectorViewState, "view" | "tab">,
  wanted: SpriteInspectorView,
  layout: SpriteInspectorLayout
): Pick<SpriteInspectorViewState, "view" | "tab"> {
  if (wanted === "both") return { view: "both", tab: current.tab };
  // --- A tab clicked while *Both* is on screen leaves *Both*
  if (current.view === "both" && layout !== "wide") return { view: "both", tab: wanted };
  return { view: wanted, tab: wanted };
}

const filterOptions: DropdownOption[] = SPRITE_FILTERS.map((f) => ({ value: f.value, label: f.label }));

const FORMATS: { value: PatternFormatMode; label: string; title: string }[] = [
  { value: "asUsed", label: "As used", title: "Each slot as the sprites that use it read it" },
  { value: "8bit", label: "8-bit", title: "64 patterns of 256 bytes, one byte per pixel" },
  { value: "4bit", label: "4-bit", title: "128 patterns of 128 bytes, two pixels per byte (high nibble first)" }
];

const offsetOptions: DropdownOption[] = [
  { value: "fromSprite", label: "From sprite" },
  ...Array.from({ length: 16 }, (_, i) => ({ value: String(i), label: `Fixed ${i}` }))
];

const SpriteInspectorPanel = ({ document, viewState }: DocumentProps<Partial<SpriteInspectorViewState>>) => {
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const isNext = machineId === MI_ZXNEXT;
  const documentHubService = useDocumentHubService();
  const { ideCommandsService } = useAppServices();
  const dispatch = useDispatch();

  const [look, setLook] = useState<SpriteInspectorViewState>({
    ...DEFAULT_SPRITE_INSPECTOR_VIEW_STATE,
    ...(viewState ?? {})
  });
  const updateLook = useCallback(
    (patch: Partial<SpriteInspectorViewState>) => {
      setLook((current) => {
        const next = { ...current, ...patch };
        if (document) documentHubService?.setDocumentViewState(document.id, next);
        return next;
      });
    },
    [document, documentHubService]
  );

  const { state, patternsVersion, baseline } = useNextSpriteState({ enabled: isNext });
  const spriteBreakpoints = useSpriteBreakpoints();
  const palette = useSpritePalette({ bank: look.palettePin, enabled: isNext && !!state });

  const [selection, setSelection] = useState<SpriteSelection>();
  const [globalsOpen, setGlobalsOpen] = useState(false);
  const [menuState, menuApi] = useContextMenuState();

  // --- The layout follows the document's own width, measured in `ch` of the panel font
  const rootRef = useRef<HTMLDivElement>(null);
  const chRef = useRef<HTMLSpanElement>(null);
  const [layout, setLayout] = useState<SpriteInspectorLayout>("narrow");
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

  // --- `show-sprites <n>` / `show-patterns <n>` (D11)
  useEffect(
    () =>
      onSpriteReveal((request) => {
        setLook((current) => {
          // --- A request keeps *Both* (it shows either view) and sets the tab for where it does not fit
          const next =
            current.view === "both"
              ? { ...current, tab: request.view }
              : { ...current, view: request.view, tab: request.view };
          if (document) documentHubService?.setDocumentViewState(document.id, next);
          return next;
        });
        if (request.index !== undefined) {
          setSelection(
            request.view === "sprites"
              ? { kind: "sprite", index: request.index & 0x7f }
              : { kind: "pattern", slot: request.index & 0x3f }
          );
        }
      }),
    [document, documentHubService]
  );

  // --- Derived
  const model = useMemo(() => (state ? buildSpriteModel(state) : undefined), [state]);
  const filter = look.filter ?? (state ? defaultFilter(state) : "all");
  const changed = useMemo(
    () => (state ? changedSlots(baseline, state.attributes) : new Set<number>()),
    [baseline, state]
  );
  const rows = useMemo(() => (model ? spriteRows(model, filter, changed) : []), [model, filter, changed]);
  const cells = useMemo(
    () => (model ? patternCells(model, look.formatMode, look.fallback) : []),
    [model, look.formatMode, look.fallback]
  );
  const sync = useMemo(
    () => (model ? syncSelection(model, cells, selection) : { rows: [] as number[] }),
    [model, cells, selection]
  );
  const abgr = useMemo(() => toAbgrTable(palette.palette), [palette.palette]);

  const probe = (
    <span ref={chRef} className={styles.chProbe} aria-hidden="true">
      0
    </span>
  );

  if (!isNext || !model) {
    return (
      <FullPanel fontSize="--panel-font-size" fontFamily="--monospace-font">
        <EmptyState
          message={
            isNext
              ? "Waiting for the ZX Spectrum Next's sprite state"
              : "The Sprite Inspector shows a running ZX Spectrum Next"
          }
        />
      </FullPanel>
    );
  }

  const selectSprite = (index: number) => setSelection({ kind: "sprite", index });
  const selectPattern = (slot: number, half?: 0 | 1) => setSelection({ kind: "pattern", slot, half });
  // --- A pattern popped out into a read-only sprite editor, frozen as it is now
  const openSnapshot = (format: NexSpriteFormat, pattern: number, paletteOffset: number, sprite?: number) => {
    if (!documentHubService) return;
    void openPatternSnapshot(documentHubService, {
      patterns: model.state.patterns,
      format,
      pattern,
      paletteOffset,
      transparencyIndex: model.state.transparencyIndex,
      sprite
    });
  };
  const fromMenu = (action: () => void) => () => {
    menuApi.conceal();
    action();
  };
  const showsSprites = view !== "patterns";
  const showsPatterns = view !== "sprites";

  // --- Toolbar pieces
  const tabs = (
    <span className={spriteSegmentedClass} role="tablist" aria-label="Sprite Inspector view">
      {(["sprites", "patterns", "both"] as const)
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
            {v === "sprites" ? "Sprites" : v === "patterns" ? "Patterns" : "Both"}
          </button>
        ))}
    </span>
  );
  const paletteButtons = (
    <span className={spriteSegmentedClass} role="group" aria-label="Sprite palette">
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
                ? "Follow the palette the sprite engine draws with (NextReg $43 bit 3)"
                : `Pin the ${bank === 0 ? "first" : "second"} sprite palette`
            }
            onClick={() => updateLook({ palettePin: bank })}
          >
            {label}
          </button>
        );
      })}
    </span>
  );

  // --- The globals: one line; flags and the primary items first, the rest behind "+n more"
  const globals = orderGlobals(globalsStrip(model));
  const hidden = layout === "wide" || globalsOpen ? 0 : globals.filter((g) => !g.flag && !g.primary).length;

  // --- The panes
  const spritesPane = (
    <SpritesTable
      rows={rows}
      model={model}
      patternsVersion={patternsVersion}
      abgr={abgr}
      checker={look.checker}
      showRaw={look.showRaw}
      selectedRows={sync.rows}
      selectedSprite={sync.sprite}
      onSelect={selectSprite}
      onShowPattern={(row) => {
        if (view === "sprites") updateLook(layout === "wide" ? { view: "both" } : chooseView(look, "patterns", layout));
        selectPattern(row.patternSlot, row.patternHalf);
      }}
      onOpenSnapshot={(row) => {
        const r = row.resolved;
        openSnapshot(r.fourBit ? "4bit" : "8bit", r.fourBit ? r.pattern7 : patternSlotOf(r), r.paletteOffset, row.index);
      }}
      onCopy={(text, what) => {
        void navigator.clipboard?.writeText(text);
        dispatch(setIdeStatusMessageAction(`${what} copied to the clipboard`, true));
      }}
      breakpoints={spriteBreakpoints.breakpoints}
      onToggleBreakpoint={(sprite) => void spriteBreakpoints.toggle(sprite)}
      onEditBreakpoint={(sprite) => void spriteBreakpoints.edit(sprite)}
      onRunUntilWrite={(sprite) => void spriteBreakpoints.runUntilWrite(sprite)}
    />
  );
  const patternsPane = (
    <PatternsView
      model={model}
      cells={cells}
      patternsVersion={patternsVersion}
      look={look}
      abgr={abgr}
      transparentAbgr={abgr[model.state.transparencyIndex & 0xff]}
      selectedCell={sync.cell}
      selectedSprite={sync.sprite}
      onSelect={(cell) => selectPattern(cell.slot, cell.half)}
      onOpenUser={selectSprite}
    />
  );
  const list =
    view === "sprites" ? (
      spritesPane
    ) : view === "patterns" ? (
      patternsPane
    ) : (
      <SplitPanel
        primaryLocation="left"
        initialPrimarySize={look.splitSize ?? "56%"}
        minSize={160}
        onPrimarySizeUpdateCompleted={(size) => updateLook({ splitSize: size })}
      >
        {spritesPane}
        {patternsPane}
      </SplitPanel>
    );
  const inspector = (
    <SpriteInspectorPane
      layout={layout === "narrow" ? "band" : "rail"}
      model={model}
      cells={cells}
      selection={selection}
      selectedCell={sync.cell}
      look={look}
      palette={palette.palette}
      abgr={abgr}
      onSelectSprite={selectSprite}
      onSelectPattern={selectPattern}
      onOpenSnapshot={openSnapshot}
    />
  );

  return (
    <FullPanel fontSize="--panel-font-size" fontFamily="--main-font-family">
      <div ref={rootRef} className={styles.root} data-layout={layout}>
        {probe}
        <div className={styles.toolbar} role="toolbar" aria-label="Sprite Inspector">
          {tabs}
          {showsSprites && (
            <span className={styles.toolbarContext}>
              <Dropdown
                ariaLabel="Sprite filter"
                options={filterOptions}
                initialValue={filter}
                width={150}
                onChanged={(value) => updateLook({ filter: value as SpriteFilter })}
              />
            </span>
          )}
          {showsPatterns && (
            <span className={styles.toolbarContext}>
              <span className={spriteSegmentedClass} role="group" aria-label="Pattern format">
                {FORMATS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    className={spriteSegmentClass}
                    aria-pressed={look.formatMode === f.value}
                    title={f.title}
                    onClick={() => updateLook({ formatMode: f.value })}
                  >
                    {f.label}
                  </button>
                ))}
              </span>
              <Dropdown
                ariaLabel="Palette offset"
                options={offsetOptions}
                initialValue={String(look.paletteOffset)}
                width={110}
                onChanged={(value) =>
                  updateLook({ paletteOffset: value === "fromSprite" ? "fromSprite" : parseInt(value, 10) })
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
                value={look.checker}
                label="Checker"
                title="Draw transparent pixels as a checkerboard rather than in the transparency colour"
                clicked={(value) => updateLook({ checker: value })}
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
          aria-label="Sprite globals"
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
              {item.flag && item.key === "Status" ? (
                <span className={styles.globalFlagChip}>{item.value}</span>
              ) : (
                <>
                  <span className={styles.globalKey}>{item.key}</span>
                  <span className={classnames(styles.globalValue, { [styles.globalFlag]: item.flag })}>
                    {item.value}
                  </span>
                </>
              )}
            </span>
          ))}
          {layout !== "wide" && (
            <button type="button" className={styles.globalsMore} onClick={() => setGlobalsOpen((o) => !o)}>
              {globalsOpen ? "less" : `+${globals.filter((g) => !g.flag && !g.primary).length} more`}
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
                clicked={fromMenu(() => updateLook({ palettePin: undefined }))}
              />
              <ContextMenuItem
                text="Palette: 1"
                selected={look.palettePin === 0}
                clicked={fromMenu(() => updateLook({ palettePin: 0 }))}
              />
              <ContextMenuItem
                text="Palette: 2"
                selected={look.palettePin === 1}
                clicked={fromMenu(() => updateLook({ palettePin: 1 }))}
              />
              <ContextMenuSeparator />
            </>
          )}
          {layout !== "wide" && (
            <>
              {SPRITE_SHEET_ZOOMS.map((z) => (
                <ContextMenuItem
                  key={z}
                  text={`Zoom ${z}×`}
                  selected={look.zoom === z}
                  clicked={fromMenu(() => updateLook({ zoom: z }))}
                />
              ))}
              <ContextMenuItem
                text="Checkerboard behind transparent pixels"
                selected={look.checker}
                clicked={fromMenu(() => updateLook({ checker: !look.checker }))}
              />
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            text="Show raw attribute bytes"
            selected={look.showRaw}
            clicked={fromMenu(() => updateLook({ showRaw: !look.showRaw }))}
          />
          <ContextMenuItem
            text="Unused slots as 8-bit"
            selected={look.fallback === "8bit"}
            clicked={fromMenu(() => updateLook({ fallback: "8bit" }))}
          />
          <ContextMenuItem
            text="Unused slots as 4-bit"
            selected={look.fallback === "4bit"}
            clicked={fromMenu(() => updateLook({ fallback: "4bit" }))}
          />
          <ContextMenuSeparator />
          <ContextMenuItem
            text="Export pattern RAM as .spr"
            clicked={fromMenu(() => void ideCommandsService.executeCommand("export-patterns -o"))}
          />
        </ContextMenu>
      </div>
    </FullPanel>
  );
};

export const createSpriteInspectorPanel = ({ document, viewState }: DocumentProps) => (
  <SpriteInspectorPanel document={document} viewState={viewState} />
);

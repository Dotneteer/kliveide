import classnames from "classnames";
import {
  KeyboardEvent,
  memo,
  MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getAbrgForPaletteCode, getRgbPartsForPaletteCode } from "@emu/machines/zxNext/palette";
import { PanelHeaderGroup } from "@renderer/controls/data";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { AddressInput } from "@renderer/controls/AddressInput";
import { Text } from "@renderer/controls/layout/Text";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import type { NexAnnotationRegion, NexAnnotationRegionType } from "./nexAnnotations";
import {
  isBlankPattern,
  NEX_SPRITE_TRANSPARENT,
  patternAt,
  patternColours,
  patternCount,
  patternHint,
  patternOffset,
  patternPixels,
  patternSize,
  patternSpan,
  type NexSpriteFormat
} from "./nexBankSprites";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import styles from "./NexBankSpritesView.module.scss";

/*
 * The Sprites view of a popped-out NEX bank: the bank's bytes as a sheet of 16×16 sprite patterns,
 * with an inspector for the selected one. See `.plans/NEX_BANK_SPRITES_VIEW_PLAN.md`.
 *
 * Two kinds of setting, kept in two places on purpose:
 *
 * - **format** and **offset** say what the bank's data *is*, so they live in the annotation sidecar
 *   (when the bank has an annotation) and reach this view as props with a change callback;
 * - everything else — palette, 4-bit palette offset, zoom, transparency, selection — says how the
 *   data is *looked at*, and lives in the document's view state.
 *
 * The component draws; it does not read the machine. The palette comes in from `useSpritePalette`
 * in the dump component, which is the one place that decides whether the machine is read at all.
 */

export type NexSpritesZoom = 1 | 2 | 3 | 4;

/** How the sheet is looked at: document view state, never the sidecar. */
export type NexSpritesLook = {
  palette: 0 | 1;
  paletteOffset: number;
  zoom: NexSpritesZoom;
  showTransparent: boolean;
  anchor: number;
  active: number;
};

export const DEFAULT_SPRITES_LOOK: NexSpritesLook = {
  palette: 0,
  paletteOffset: 0,
  zoom: 3,
  showTransparent: true,
  anchor: 0,
  active: 0
};

export type NexSpritesPaletteInfo = {
  /** 256 palette codes in the register layout. */
  palette: number[];
  transparencyIndex: number;
  /** `default` when no Next machine answered: both palettes are then the reset palette. */
  source: "machine" | "default";
  /** The palette the sprite engine currently draws with (Reg `$43` bit 3), when known. */
  liveBank: 0 | 1 | undefined;
};

/**
 * The palette a Next starts with: index `RRRGGGBB`, and the ninth (low blue) bit the OR of the two
 * blue bits. Used when there is no machine to read, so that "default" at least means the hardware's
 * default rather than a ramp that cannot express half the blues.
 */
export const NEX_RESET_PALETTE: number[] = Array.from({ length: 256 }, (_, i) =>
  i | (i & 0x03 ? 0x100 : 0)
);

const ZOOMS: NexSpritesZoom[] = [1, 2, 3, 4];

const paletteOffsetOptions: DropdownOption[] = Array.from({ length: 16 }, (_, i) => ({
  value: String(i),
  label: `+$${toHexa2(i * 16)}`
}));

// ─── Selection helpers ───────────────────────────────────────────────────────

export function selectionRange(look: Pick<NexSpritesLook, "anchor" | "active">): {
  first: number;
  last: number;
} {
  return { first: Math.min(look.anchor, look.active), last: Math.max(look.anchor, look.active) };
}

/** Is the span entirely inside one region of this type? Regions are normalized, so one suffices. */
export function spanHasRegionType(
  regions: NexAnnotationRegion[] | undefined,
  start: number,
  end: number,
  type: NexAnnotationRegionType
): boolean {
  return !!regions?.some((r) => r.type === type && r.start <= start && r.end >= end);
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

type ToolbarProps = {
  format: NexSpriteFormat;
  offset: number;
  look: NexSpritesLook;
  paletteInfo: NexSpritesPaletteInfo;
  decimalView: boolean;
  onFormatChange: (format: NexSpriteFormat) => void;
  onOffsetChange: (offset: number) => void;
  onLookChange: (patch: Partial<NexSpritesLook>) => void;
  onGoToAddress: (address: number) => void;
};

/**
 * The Sprites view's controls, as `PanelHeaderGroup`s for the dump's own header.
 *
 * A fragment of groups rather than a bar of its own, so the view costs no second row of chrome.
 */
export const NexBankSpritesToolbar = ({
  format,
  offset,
  look,
  paletteInfo,
  decimalView,
  onFormatChange,
  onOffsetChange,
  onLookChange,
  onGoToAddress
}: ToolbarProps) => {
  const size = patternSize(format);
  return (
    <>
      <PanelHeaderGroup>
        <Text text="Palette" />
        <LabelSeparator />
        <span className={styles.segmented} role="group" aria-label="Sprite palette">
          {([0, 1] as const).map((bank) => {
            const live = paletteInfo.source === "machine" && paletteInfo.liveBank === bank;
            const name = bank === 0 ? "Primary" : "Secondary";
            return (
              <button
                key={bank}
                type="button"
                className={classnames(styles.segment, { [styles.segmentLive]: live })}
                aria-pressed={look.palette === bank}
                title={
                  `${name} sprite palette (Reg $43, bit 3)` +
                  (live ? "\nThe sprite engine is drawing with this palette now." : "")
                }
                onClick={() => onLookChange({ palette: bank })}
              >
                {name}
              </button>
            );
          })}
        </span>
        {paletteInfo.source === "default" && (
          <span
            className={styles.paletteFallback}
            title={
              "No ZX Spectrum Next machine is running, so the sprite palettes cannot be read.\n" +
              "Both are shown as the palette the Next starts with, and look the same."
            }
          >
            Default palette
          </span>
        )}
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text="Format" />
        <LabelSeparator />
        <span className={styles.segmented} role="group" aria-label="Sprite pattern format">
          {(["8bit", "4bit"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={styles.segment}
              aria-pressed={format === f}
              title={
                f === "8bit"
                  ? "8-bit patterns: 256 bytes, one byte per pixel"
                  : "4-bit patterns: 128 bytes, two pixels per byte (high nibble first)"
              }
              onClick={() => onFormatChange(f)}
            >
              {f === "8bit" ? "8-bit" : "4-bit"}
            </button>
          ))}
        </span>
        {format === "4bit" && (
          <Dropdown
            ariaLabel="4-bit palette offset"
            options={paletteOffsetOptions}
            initialValue={String(look.paletteOffset)}
            width={64}
            onChanged={(value) => onLookChange({ paletteOffset: parseInt(value, 10) })}
          />
        )}
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text="Offset" />
        <LabelSeparator />
        <OffsetControl offset={offset} step={size} onChange={onOffsetChange} />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text="Zoom" />
        <LabelSeparator />
        <span className={styles.segmented} role="group" aria-label="Zoom">
          {ZOOMS.map((z) => (
            <button
              key={z}
              type="button"
              className={styles.segment}
              aria-pressed={look.zoom === z}
              onClick={() => onLookChange({ zoom: z })}
            >
              {`${z}×`}
            </button>
          ))}
        </span>
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <LabeledSwitch
          value={look.showTransparent}
          label="Checker"
          title="Draw transparent pixels as a checkerboard rather than in the transparency colour"
          clicked={(value) => onLookChange({ showTransparent: value })}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <AddressInput
          label="Go To"
          clearOnEnter={true}
          decimalView={decimalView}
          onAddressSent={async (address) => onGoToAddress(address)}
        />
      </PanelHeaderGroup>
    </>
  );
};

/**
 * Where pattern #0 starts: nudge by a byte or a pattern, or type it.
 *
 * The typed value is committed on Enter or blur, not on every keystroke — each commit is a sidecar
 * write, and `$0` on the way to `$0803` is not an offset anyone meant.
 */
const OffsetControl = ({
  offset,
  step,
  onChange
}: {
  offset: number;
  step: number;
  onChange: (offset: number) => void;
}) => {
  const [text, setText] = useState(`$${toHexa4(offset)}`);
  useEffect(() => setText(`$${toHexa4(offset)}`), [offset]);

  const commit = () => {
    const trimmed = text.trim();
    const value = trimmed.startsWith("$")
      ? parseInt(trimmed.slice(1), 16)
      : /^[0-9]+$/.test(trimmed)
        ? parseInt(trimmed, 10)
        : parseInt(trimmed, 16);
    if (Number.isNaN(value)) {
      setText(`$${toHexa4(offset)}`);
      return;
    }
    onChange(clampOffset(value));
  };
  const nudge = (delta: number) => onChange(clampOffset(offset + delta));

  return (
    <span className={styles.offsetControl}>
      <button type="button" className={styles.nudge} title="Back one pattern" onClick={() => nudge(-step)}>
        «
      </button>
      <button type="button" className={styles.nudge} title="Back one byte" onClick={() => nudge(-1)}>
        ‹
      </button>
      <input
        className={styles.offsetInput}
        aria-label="Sprite start offset"
        title="Bank offset of pattern #0 ($hex or decimal)"
        spellCheck={false}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          // --- The emulated machine listens on `window` while it runs.
          event.stopPropagation();
        }}
      />
      <button type="button" className={styles.nudge} title="Forward one byte" onClick={() => nudge(1)}>
        ›
      </button>
      <button
        type="button"
        className={styles.nudge}
        title="Forward one pattern"
        onClick={() => nudge(step)}
      >
        »
      </button>
    </span>
  );
};

const clampOffset = (value: number) => Math.max(0, Math.min(0x3fff, Math.floor(value)));

// ─── The sheet and the inspector ─────────────────────────────────────────────

type ViewProps = {
  bank: number;
  bytes: Uint8Array;
  /** The address byte 0 of the bank is listed at (the dump's disassembly offset). */
  addressBase: number;
  format: NexSpriteFormat;
  offset: number;
  look: NexSpritesLook;
  paletteInfo: NexSpritesPaletteInfo;
  regions?: NexAnnotationRegion[];
  /** Whether the sidecar can take region edits. */
  canAnnotate: boolean;
  onLookChange: (patch: Partial<NexSpritesLook>) => void;
  onMarkSpan: (start: number, end: number, type: NexAnnotationRegionType) => void;
  onShowIn: (view: "memory" | "disassembly", bankOffset: number) => void;
  onBankComment?: () => void;
};

export const NexBankSpritesView = ({
  bank,
  bytes,
  addressBase,
  format,
  offset,
  look,
  paletteInfo,
  regions,
  canAnnotate,
  onLookChange,
  onMarkSpan,
  onShowIn,
  onBankComment
}: ViewProps) => {
  const count = patternCount(format, offset, bytes.length);
  const size = patternSize(format);
  const active = count > 0 ? Math.min(look.active, count - 1) : 0;
  const anchor = count > 0 ? Math.min(look.anchor, count - 1) : 0;
  const { first, last } = selectionRange({ anchor, active });

  const allPixels = useMemo(
    () =>
      Array.from({ length: count }, (_, i) =>
        patternPixels(bytes, i, {
          format,
          offset,
          paletteOffset: look.paletteOffset,
          transparencyIndex: paletteInfo.transparencyIndex
        })
      ),
    [bytes, count, format, offset, look.paletteOffset, paletteInfo.transparencyIndex]
  );
  const abgr = useMemo(() => toAbgrTable(paletteInfo.palette), [paletteInfo.palette]);
  const transparentAbgr = abgr[paletteInfo.transparencyIndex & 0xff];

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [menuState, menuApi] = useContextMenuState();

  // --- Keep the active pattern in view as it moves, by keyboard or by Go To.
  useLayoutEffect(() => {
    const cell = sheetRef.current?.querySelector<HTMLElement>(`[data-pattern="${active}"]`);
    cell?.scrollIntoView?.({ block: "nearest" });
  }, [active, format, offset]);

  const select = useCallback(
    (index: number, extend: boolean) => {
      const next = Math.max(0, Math.min(count - 1, index));
      onLookChange(extend ? { active: next, anchor } : { active: next, anchor: next });
    },
    [anchor, count, onLookChange]
  );

  const columns = () => {
    const cells = sheetRef.current?.querySelectorAll<HTMLElement>("[data-pattern]");
    if (!cells?.length) return 1;
    const top = cells[0].offsetTop;
    let perRow = 0;
    while (perRow < cells.length && cells[perRow].offsetTop === top) perRow++;
    return Math.max(1, perRow);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.metaKey || event.altKey || event.ctrlKey || count === 0) return;
    const perRow = columns();
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -perRow,
      ArrowDown: perRow,
      PageUp: -perRow * 4,
      PageDown: perRow * 4,
      Home: -count,
      End: count
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      select(active + move, event.shiftKey);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onShowIn(event.shiftKey ? "disassembly" : "memory", patternOffset(active, format, offset));
      return;
    }
    if ((event.key === "b" || event.key === "B") && !event.shiftKey && onBankComment) {
      event.preventDefault();
      event.stopPropagation();
      onBankComment();
    }
  };

  const span = patternSpan(first, last, format, offset);
  const markedBytes = spanHasRegionType(regions, span.start, span.end, "bytes");

  const openMenu = (index: number, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    if (index < first || index > last) select(index, false);
    menuApi.show(event);
  };

  return (
    <div className={styles.spritesView}>
      {/*
        * The app's overlay scrollbars rather than the OS ones, as every other panel uses. The listbox
        * stays the focusable element inside: `scrollIntoView` scrolls the viewer's own viewport, and
        * the cells' `offsetTop` (which the arrow keys count columns by) is unaffected by the wrapper.
        */}
      <div className={styles.sheetScroll}>
        <ScrollViewer allowHorizontal={false}>
          <div
            ref={sheetRef}
            className={styles.sheet}
            tabIndex={0}
            role="listbox"
            aria-label={`Bank $${toHexa2(bank)} sprite patterns`}
            aria-multiselectable={true}
            aria-activedescendant={count ? `nex-sprite-${bank}-${active}` : undefined}
            data-testid="nex-sprites-sheet"
            onKeyDown={keyDown}
          >
            {count === 0 ? (
              <div className={styles.empty}>No whole pattern fits after this offset.</div>
            ) : (
              <div className={styles.grid} style={{ ["--sprite-px" as string]: `${16 * look.zoom}px` }}>
                {allPixels.map((pixels, index) => {
                  const at = patternOffset(index, format, offset);
                  return (
                    <SpriteCell
                      key={index}
                      id={`nex-sprite-${bank}-${index}`}
                      index={index}
                      bankOffset={at}
                      pixels={pixels}
                      abgr={abgr}
                      transparentAbgr={transparentAbgr}
                      showTransparent={look.showTransparent}
                      selected={index >= first && index <= last}
                      active={index === active}
                      blank={isBlankPattern(pixels)}
                      markedBytes={spanHasRegionType(regions, at, at + size - 1, "bytes")}
                      onSelect={select}
                      onContextMenu={openMenu}
                      onOpen={(i) => onShowIn("memory", patternOffset(i, format, offset))}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </ScrollViewer>
      </div>
      {count > 0 && (
        <SpriteInspector
          first={first}
          last={last}
          pixels={allPixels[active]}
          activeIndex={active}
          span={span}
          addressBase={addressBase}
          format={format}
          look={look}
          paletteInfo={paletteInfo}
          abgr={abgr}
          transparentAbgr={transparentAbgr}
          canAnnotate={canAnnotate}
          markedBytes={markedBytes}
          onMarkSpan={onMarkSpan}
          onShowIn={onShowIn}
          activeOffset={patternOffset(active, format, offset)}
        />
      )}
      <ContextMenu state={menuState} onClickOutside={menuApi.conceal}>
        <ContextMenuItem
          text={markedBytes ? "Marked as Bytes" : "Mark as Bytes"}
          disabled={!canAnnotate || markedBytes}
          clicked={() => {
            menuApi.conceal();
            onMarkSpan(span.start, span.end, "bytes");
          }}
        />
        <ContextMenuItem
          text="Mark as Disassembly"
          disabled={!canAnnotate || spanHasRegionType(regions, span.start, span.end, "disassemble")}
          clicked={() => {
            menuApi.conceal();
            onMarkSpan(span.start, span.end, "disassemble");
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Show in Memory"
          clicked={() => {
            menuApi.conceal();
            onShowIn("memory", patternOffset(active, format, offset));
          }}
        />
        <ContextMenuItem
          text="Show in Disassembly"
          clicked={() => {
            menuApi.conceal();
            onShowIn("disassembly", patternOffset(active, format, offset));
          }}
        />
      </ContextMenu>
    </div>
  );
};

/** The pattern holding a listed address, for Go To. */
export function patternForAddress(
  address: number,
  addressBase: number,
  format: NexSpriteFormat,
  offset: number
): number | undefined {
  const bankOffset = (address - addressBase) & 0xffff;
  return bankOffset < 0x4000 ? patternAt(bankOffset, format, offset) : undefined;
}

// ─── Cells ───────────────────────────────────────────────────────────────────

type CellProps = {
  id: string;
  index: number;
  bankOffset: number;
  pixels: Int16Array;
  abgr: Uint32Array;
  transparentAbgr: number;
  showTransparent: boolean;
  selected: boolean;
  active: boolean;
  blank: boolean;
  markedBytes: boolean;
  onSelect: (index: number, extend: boolean) => void;
  onContextMenu: (index: number, event: MouseEvent<HTMLElement>) => void;
  onOpen: (index: number) => void;
};

const SpriteCell = memo(
  ({
    id,
    index,
    bankOffset,
    pixels,
    abgr,
    transparentAbgr,
    showTransparent,
    selected,
    active,
    blank,
    markedBytes,
    onSelect,
    onContextMenu,
    onOpen
  }: CellProps) => (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-pattern={index}
      className={classnames(styles.cell, {
        [styles.cellSelected]: selected,
        [styles.cellActive]: active,
        [styles.cellBlank]: blank
      })}
      title={`Pattern #${index} · bank offset $${toHexa4(bankOffset)}${markedBytes ? " · marked as bytes" : ""}`}
      onClick={(event) => onSelect(index, event.shiftKey)}
      onDoubleClick={() => onOpen(index)}
      onContextMenu={(event) => onContextMenu(index, event)}
    >
      <span className={styles.cellImage}>
        <SpriteCanvas
          pixels={pixels}
          abgr={abgr}
          transparentAbgr={transparentAbgr}
          showTransparent={showTransparent}
          className={styles.cellCanvas}
        />
        {markedBytes && <span className={styles.bytesMark} aria-label="Marked as bytes" />}
      </span>
      <span className={styles.cellLabel}>
        <span className={styles.cellNumber}>{`#${index}`}</span>
        {` $${toHexa4(bankOffset)}`}
      </span>
    </div>
  )
);

/**
 * A pattern at its native 16×16, scaled up by CSS with `image-rendering: pixelated`.
 *
 * Transparent pixels are left transparent in the canvas when the checker is on, so the checkerboard
 * is the element's CSS background and stays crisp at any zoom instead of being baked in at sprite
 * resolution.
 */
const SpriteCanvas = memo(
  ({
    pixels,
    abgr,
    transparentAbgr,
    showTransparent,
    className
  }: {
    pixels: Int16Array;
    abgr: Uint32Array;
    transparentAbgr: number;
    showTransparent: boolean;
    className?: string;
  }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useLayoutEffect(() => {
      const context = ref.current?.getContext?.("2d");
      if (!context) return;
      const image = context.createImageData(16, 16);
      const out = new Uint32Array(image.data.buffer);
      for (let p = 0; p < 256; p++) {
        const value = pixels[p];
        out[p] =
          value === NEX_SPRITE_TRANSPARENT ? (showTransparent ? 0 : transparentAbgr) : abgr[value];
      }
      context.putImageData(image, 0, 0);
    }, [abgr, pixels, showTransparent, transparentAbgr]);

    return (
      <canvas
        ref={ref}
        width={16}
        height={16}
        className={classnames(className, { [styles.checker]: showTransparent })}
      />
    );
  }
);

// ─── Inspector ───────────────────────────────────────────────────────────────

type InspectorProps = {
  first: number;
  last: number;
  activeIndex: number;
  activeOffset: number;
  pixels: Int16Array;
  span: { start: number; end: number };
  addressBase: number;
  format: NexSpriteFormat;
  look: NexSpritesLook;
  paletteInfo: NexSpritesPaletteInfo;
  abgr: Uint32Array;
  transparentAbgr: number;
  canAnnotate: boolean;
  markedBytes: boolean;
  onMarkSpan: (start: number, end: number, type: NexAnnotationRegionType) => void;
  onShowIn: (view: "memory" | "disassembly", bankOffset: number) => void;
};

const SpriteInspector = ({
  first,
  last,
  activeIndex,
  activeOffset,
  pixels,
  span,
  addressBase,
  format,
  look,
  paletteInfo,
  abgr,
  transparentAbgr,
  canAnnotate,
  markedBytes,
  onMarkSpan,
  onShowIn
}: InspectorProps) => {
  const range = first !== last;
  const colours = patternColours(pixels);
  const hint = patternHint(pixels);
  const shownColours = colours.slice(0, 16);

  return (
    <aside className={styles.inspector} aria-label="Pattern inspector">
      <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
        <div className={styles.inspectorContent}>
          <div className={styles.inspectorTitle}>
            {range ? `Patterns #${first}–#${last} (${last - first + 1})` : `Pattern #${activeIndex}`}
          </div>
          <span className={styles.bigFrame}>
            <SpriteCanvas
              pixels={pixels}
              abgr={abgr}
              transparentAbgr={transparentAbgr}
              showTransparent={look.showTransparent}
              className={styles.bigCanvas}
            />
          </span>
          <dl className={styles.facts}>
            <dt>{range ? "Bank offsets" : "Bank offset"}</dt>
            <dd>{`$${toHexa4(span.start)}–$${toHexa4(span.end)}`}</dd>
            <dt>Address</dt>
            <dd>{`$${toHexa4((addressBase + activeOffset) & 0xffff)}`}</dd>
            <dt>Format</dt>
            <dd>
              {format === "8bit" ? "8-bit" : `4-bit, palette +$${toHexa2(look.paletteOffset * 16)}`}
            </dd>
            <dt>Palette</dt>
            <dd>
              {`${look.palette === 0 ? "Primary" : "Secondary"}${
                paletteInfo.source === "default" ? " (default)" : ""
              }`}
            </dd>
          </dl>
          <div className={styles.inspectorSection}>
            <div className={styles.inspectorHeading}>Colours used</div>
            <div className={styles.swatches}>
              {shownColours.map(({ index, count }) =>
                index === NEX_SPRITE_TRANSPARENT ? (
                  <span key="t" className={styles.swatch} title={`Transparent · ${count} px`}>
                    <span className={classnames(styles.swatchColour, styles.checker)} />
                    transp.
                  </span>
                ) : (
                  <span
                    key={index}
                    className={styles.swatch}
                    title={`Index $${toHexa2(index)} · RGB333 ${getRgbPartsForPaletteCode(
                      paletteInfo.palette[index]
                    ).join("")} · ${count} px`}
                  >
                    <span
                      className={styles.swatchColour}
                      style={{ backgroundColor: abgrToCss(abgr[index]) }}
                    />
                    {`$${toHexa2(index)}`}
                  </span>
                )
              )}
              {colours.length > shownColours.length && (
                <span className={styles.swatch}>{`+${colours.length - shownColours.length}`}</span>
              )}
            </div>
          </div>
          <div className={styles.hint} data-testid="nex-sprite-hint">
            {describeHint(hint, paletteInfo.transparencyIndex)}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={() => onShowIn("memory", activeOffset)}>
              Show in Memory
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => onShowIn("disassembly", activeOffset)}
            >
              Show in Disassembly
            </button>
            {markedBytes ? (
              <>
                <button type="button" className={styles.action} disabled>
                  Marked as Bytes
                </button>
                <button
                  type="button"
                  className={styles.action}
                  disabled={!canAnnotate}
                  onClick={() => onMarkSpan(span.start, span.end, "disassemble")}
                >
                  Mark as Disassembly
                </button>
              </>
            ) : (
              <button
                type="button"
                className={classnames(styles.action, styles.actionPrimary)}
                disabled={!canAnnotate}
                title={
                  canAnnotate
                    ? `Mark $${toHexa4(span.start)}–$${toHexa4(span.end)} as a bytes region`
                    : "This bank has no annotation file to record regions in"
                }
                onClick={() => onMarkSpan(span.start, span.end, "bytes")}
              >
                Mark as Bytes
              </button>
            )}
          </div>
        </div>
      </ScrollViewer>
    </aside>
  );
};

function describeHint(hint: ReturnType<typeof patternHint>, transparencyIndex: number): string {
  switch (hint.kind) {
    case "blank":
      return hint.transparent
        ? `Blank: every pixel is transparent ($${toHexa2(transparencyIndex)}).`
        : `Blank: every pixel is $${toHexa2(hint.index)}.`;
    case "noisy":
      return `${hint.colours} colours with little structure: more likely code or packed data than a sprite. Check the format and offset.`;
    default:
      return `${hint.colours} colour${hint.colours === 1 ? "" : "s"}, ${hint.transparent} transparent pixel${
        hint.transparent === 1 ? "" : "s"
      }.`;
  }
}

// ─── Colour helpers ──────────────────────────────────────────────────────────

function toAbgrTable(palette: number[]): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) table[i] = getAbrgForPaletteCode(palette[i] ?? i) >>> 0;
  return table;
}

function abgrToCss(value: number): string {
  return `rgb(${value & 0xff}, ${(value >>> 8) & 0xff}, ${(value >>> 16) & 0xff})`;
}

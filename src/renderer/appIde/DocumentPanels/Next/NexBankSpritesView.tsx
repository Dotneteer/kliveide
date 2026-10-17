import classnames from "classnames";
import {
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { getRgbPartsForPaletteCode } from "@emu/machines/zxNext/palette";
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
import type { AnnotationRegion, AnnotationRegionType } from "@renderer/appIde/annotations/programAnnotations";
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
} from "@common/zxnext/sprites/spritePatterns";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import {
  SpriteCanvas,
  spriteCheckerClass,
  SpritePatternSheet,
  spriteSegmentClass,
  spriteSegmentedClass,
  spriteSegmentLiveClass,
  SpriteZoomButtons,
  type SpriteSheetCell,
  type SpriteSheetZoom
} from "@renderer/controls/Next/sprites/SpritePatternSheet";
import { abgrToCss, toAbgrTable } from "@renderer/controls/Next/sprites/spriteAbgr";
import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
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

export type NexSpritesZoom = SpriteSheetZoom;

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
  regions: AnnotationRegion[] | undefined,
  start: number,
  end: number,
  type: AnnotationRegionType
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
  const t = useT();
  const size = patternSize(format);
  return (
    <>
      <PanelHeaderGroup>
        <Text text={t("panels.next.sprites.palette")} />
        <LabelSeparator />
        <span className={spriteSegmentedClass} role="group" aria-label={t("panels.next.sprites.paletteAria")}>
          {([0, 1] as const).map((bank) => {
            const live = paletteInfo.source === "machine" && paletteInfo.liveBank === bank;
            const name = bank === 0 ? t("panels.next.sprites.primary") : t("panels.next.sprites.secondary");
            return (
              <button
                key={bank}
                type="button"
                className={classnames(spriteSegmentClass, { [spriteSegmentLiveClass]: live })}
                aria-pressed={look.palette === bank}
                title={
                  bank === 0
                    ? t(live ? "panels.next.sprites.primaryLiveTitle" : "panels.next.sprites.primaryTitle")
                    : t(live ? "panels.next.sprites.secondaryLiveTitle" : "panels.next.sprites.secondaryTitle")
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
            title={t("panels.next.sprites.defaultPaletteTitle")}
          >
            {t("panels.next.sprites.defaultPalette")}
          </span>
        )}
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text={t("panels.next.sprites.format")} />
        <LabelSeparator />
        <span className={spriteSegmentedClass} role="group" aria-label={t("panels.next.sprites.formatAria")}>
          {(["8bit", "4bit"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={spriteSegmentClass}
              aria-pressed={format === f}
              title={
                f === "8bit"
                  ? t("panels.next.sprites.format8bitTitle")
                  : t("panels.next.sprites.format4bitTitle")
              }
              onClick={() => onFormatChange(f)}
            >
              {f === "8bit" ? t("panels.next.banks.detail.format8bit") : t("panels.next.banks.detail.format4bit")}
            </button>
          ))}
        </span>
        {format === "4bit" && (
          <Dropdown
            ariaLabel={t("panels.next.sprites.paletteOffsetAria")}
            options={paletteOffsetOptions}
            initialValue={String(look.paletteOffset)}
            width={64}
            onChanged={(value) => onLookChange({ paletteOffset: parseInt(value, 10) })}
          />
        )}
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text={t("panels.next.sprites.offset")} />
        <LabelSeparator />
        <OffsetControl offset={offset} step={size} onChange={onOffsetChange} />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <Text text={t("panels.next.sprites.zoom")} />
        <LabelSeparator />
        <SpriteZoomButtons zoom={look.zoom} onChange={(zoom) => onLookChange({ zoom })} />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <LabeledSwitch
          value={look.showTransparent}
          label={t("panels.next.sprites.checker")}
          title={t("panels.next.sprites.checkerTitle")}
          clicked={(value) => onLookChange({ showTransparent: value })}
        />
      </PanelHeaderGroup>
      <PanelHeaderGroup>
        <AddressInput
          label={t("panels.next.action.goTo")}
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
  const t = useT();
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
      <button type="button" className={styles.nudge} title={t("panels.next.sprites.backPattern")} onClick={() => nudge(-step)}>
        «
      </button>
      <button type="button" className={styles.nudge} title={t("panels.next.sprites.backByte")} onClick={() => nudge(-1)}>
        ‹
      </button>
      <input
        className={styles.offsetInput}
        aria-label={t("panels.next.sprites.offsetAria")}
        title={t("panels.next.sprites.offsetTitle")}
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
      <button type="button" className={styles.nudge} title={t("panels.next.sprites.forwardByte")} onClick={() => nudge(1)}>
        ›
      </button>
      <button
        type="button"
        className={styles.nudge}
        title={t("panels.next.sprites.forwardPattern")}
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
  regions?: AnnotationRegion[];
  /** Whether the sidecar can take region edits. */
  canAnnotate: boolean;
  onLookChange: (patch: Partial<NexSpritesLook>) => void;
  onMarkSpan: (start: number, end: number, type: AnnotationRegionType) => void;
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
  const t = useT();
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
          // --- The offset control exists for 4-bit only; an 8-bit bank is shown as stored
          paletteOffset: format === "4bit" ? look.paletteOffset : 0,
          transparencyIndex: paletteInfo.transparencyIndex
        })
      ),
    [bytes, count, format, offset, look.paletteOffset, paletteInfo.transparencyIndex]
  );
  const abgr = useMemo(() => toAbgrTable(paletteInfo.palette), [paletteInfo.palette]);
  const transparentAbgr = abgr[paletteInfo.transparencyIndex & 0xff];
  const cells = useMemo<SpriteSheetCell[]>(
    () =>
      allPixels.map((pixels, index) => {
        const at = patternOffset(index, format, offset);
        const markedBytes = spanHasRegionType(regions, at, at + size - 1, "bytes");
        return {
          index,
          id: `nex-sprite-${bank}-${index}`,
          pixels,
          title: t(markedBytes ? "panels.next.sprites.cellTitleMarked" : "panels.next.sprites.cellTitle", {
            index,
            offset: toHexa4(at)
          }),
          number: `#${index}`,
          secondary: `$${toHexa4(at)}`,
          dimmed: isBlankPattern(pixels),
          fold: markedBytes
        };
      }),
    [allPixels, bank, format, offset, regions, size, t]
  );

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
            aria-label={t("panels.next.sprites.sheetAria", { bank: toHexa2(bank) })}
            aria-multiselectable={true}
            aria-activedescendant={count ? `nex-sprite-${bank}-${active}` : undefined}
            data-testid="nex-sprites-sheet"
            onKeyDown={keyDown}
          >
            {count === 0 ? (
              <div className={styles.empty}>{t("panels.next.sprites.noPattern")}</div>
            ) : (
              <SpritePatternSheet
                cells={cells}
                zoom={look.zoom}
                abgr={abgr}
                transparentAbgr={transparentAbgr}
                showTransparent={look.showTransparent}
                isSelected={(index) => index >= first && index <= last}
                activeIndex={active}
                onSelect={select}
                onContextMenu={openMenu}
                onOpen={(i) => onShowIn("memory", patternOffset(i, format, offset))}
              />
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
          text={markedBytes ? t("panels.next.sprites.markedAsBytes") : t("panels.next.sprites.markAsBytes")}
          disabled={!canAnnotate || markedBytes}
          clicked={() => {
            menuApi.conceal();
            onMarkSpan(span.start, span.end, "bytes");
          }}
        />
        <ContextMenuItem
          text={t("panels.next.sprites.markAsDisassembly")}
          disabled={!canAnnotate || spanHasRegionType(regions, span.start, span.end, "disassemble")}
          clicked={() => {
            menuApi.conceal();
            onMarkSpan(span.start, span.end, "disassemble");
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text={t("panels.next.sprites.showInMemory")}
          clicked={() => {
            menuApi.conceal();
            onShowIn("memory", patternOffset(active, format, offset));
          }}
        />
        <ContextMenuItem
          text={t("panels.next.sprites.showInDisassembly")}
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
  onMarkSpan: (start: number, end: number, type: AnnotationRegionType) => void;
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
  const t = useT();
  const range = first !== last;
  const colours = patternColours(pixels);
  const hint = patternHint(pixels);
  const shownColours = colours.slice(0, 16);
  const paletteName =
    look.palette === 0 ? t("panels.next.sprites.primary") : t("panels.next.sprites.secondary");

  return (
    <aside className={styles.inspector} aria-label={t("panels.next.sprites.inspectorAria")}>
      <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
        <div className={styles.inspectorContent}>
          <div className={styles.inspectorTitle}>
            {range
              ? t("panels.next.sprites.patternRange", { first, last, count: last - first + 1 })
              : t("panels.next.sprites.pattern", { index: activeIndex })}
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
            <dt>{range ? t("panels.next.sprites.bankOffsets") : t("panels.next.sprites.bankOffset")}</dt>
            <dd>{`$${toHexa4(span.start)}–$${toHexa4(span.end)}`}</dd>
            <dt>{t("panels.next.field.address")}</dt>
            <dd>{`$${toHexa4((addressBase + activeOffset) & 0xffff)}`}</dd>
            <dt>{t("panels.next.sprites.format")}</dt>
            <dd>
              {format === "8bit"
                ? t("panels.next.banks.detail.format8bit")
                : t("panels.next.sprites.format4bitValue", { offset: toHexa2(look.paletteOffset * 16) })}
            </dd>
            <dt>{t("panels.next.sprites.palette")}</dt>
            <dd>
              {paletteInfo.source === "default"
                ? t("panels.next.sprites.paletteDefaultValue", { palette: paletteName })
                : paletteName}
            </dd>
          </dl>
          <div className={styles.inspectorSection}>
            <div className={styles.inspectorHeading}>{t("panels.next.sprites.coloursUsed")}</div>
            <div className={styles.swatches}>
              {shownColours.map(({ index, count }) =>
                index === NEX_SPRITE_TRANSPARENT ? (
                  <span key="t" className={styles.swatch} title={t("panels.next.sprites.transparentTitle", { count })}>
                    <span className={classnames(styles.swatchColour, spriteCheckerClass)} />
                    {t("panels.next.sprites.transparentShort")}
                  </span>
                ) : (
                  <span
                    key={index}
                    className={styles.swatch}
                    title={t("panels.next.sprites.swatchTitle", {
                      index: toHexa2(index),
                      rgb: getRgbPartsForPaletteCode(paletteInfo.palette[index]).join(""),
                      count
                    })}
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
              {t("panels.next.sprites.showInMemory")}
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => onShowIn("disassembly", activeOffset)}
            >
              {t("panels.next.sprites.showInDisassembly")}
            </button>
            {markedBytes ? (
              <>
                <button type="button" className={styles.action} disabled>
                  {t("panels.next.sprites.markedAsBytes")}
                </button>
                <button
                  type="button"
                  className={styles.action}
                  disabled={!canAnnotate}
                  onClick={() => onMarkSpan(span.start, span.end, "disassemble")}
                >
                  {t("panels.next.sprites.markAsDisassembly")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={classnames(styles.action, styles.actionPrimary)}
                disabled={!canAnnotate}
                title={
                  canAnnotate
                    ? t("panels.next.sprites.markTitle", { start: toHexa4(span.start), end: toHexa4(span.end) })
                    : t("panels.next.sprites.noAnnotationFile")
                }
                onClick={() => onMarkSpan(span.start, span.end, "bytes")}
              >
                {t("panels.next.sprites.markAsBytes")}
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
        ? t("panels.next.sprites.hint.blankTransparent", { index: toHexa2(transparencyIndex) })
        : t("panels.next.sprites.hint.blank", { index: toHexa2(hint.index) });
    case "noisy":
      return t("panels.next.sprites.hint.noisy", { colours: hint.colours });
    default:
      return t("panels.next.sprites.hint.normal", {
        colours: hint.colours,
        transparent: hint.transparent
      });
  }
}

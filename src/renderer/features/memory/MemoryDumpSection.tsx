import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { AddressLabel, PartitionPrefix } from "@renderer/controls/data";
import { TooltipFactory } from "@controls/Tooltip";
import classnames from "classnames";
import { toHexa4, toHexa6Dash, toHexa2, toDecimal5, toDecimal7, toDecimal3, toBin8 } from "@renderer/appIde/services/ide-commands";
import styles from "./MemoryDumpSection.module.scss";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CharDescriptor } from "@common/machines/info-types";
import { memo, useRef, useState, useMemo, useCallback } from "react";
import { EMPTY_OBJECT } from "@renderer/utils/stablerefs";
import { isWidePartitionLabel } from "@renderer/controls/data/partitionWidth";

export type MemoryDumpSectionProps = {
  showPartitions?: boolean;
  partitionLabel?: string;
  /**
   * Characters reserved for the bank-label column, shared by every row in the dump.
   *
   * Uniform so the address and hex columns land at the same x on every row, whether or not that
   * row's own bank is labelled. 0 means the dump has no bank column and the cell is omitted
   * entirely. Derived once by `MemoryPanel` via `derivePartitionWidthCh`.
   */
  partitionWidthCh?: number;
  address: number;
  bytes: readonly number[];
  decimalView: boolean;
  charDump: boolean;
  pointedInfo?: Record<number, string>;
  lastJumpAddress: number;
  isRom?: boolean;
  editClicked?: (address: number) => void;
  /** Number of hex digits used for the address label. Defaults to 4. */
  addressDigits?: 4 | 6;
};

export type MemoryCharacterInfo = {
  characterSet: Record<number, CharDescriptor>;
  tooltipCache: readonly string[];
};

const EMPTY_CHARACTER_SET = EMPTY_OBJECT as Record<number, CharDescriptor>;
const EMPTY_CHARACTER_INFO: MemoryCharacterInfo = {
  characterSet: EMPTY_CHARACTER_SET,
  tooltipCache: buildByteTooltipCache(EMPTY_CHARACTER_SET)
};
const characterInfoCache = new WeakMap<Record<number, CharDescriptor>, MemoryCharacterInfo>();

type MemoryDumpSectionViewProps = MemoryDumpSectionProps & {
  characterInfo: MemoryCharacterInfo;
};

export const MemoryDumpSection = (props: MemoryDumpSectionProps) => {
  const { machineService } = useAppServices();
  const characterInfo = useMemoryCharacterInfo(machineService.getMachineInfo()?.machine?.charSet);

  return <MemoryDumpSectionView {...props} characterInfo={characterInfo} />;
};

const MemoryDumpSectionViewComponent = ({
  showPartitions,
  partitionLabel,
  partitionWidthCh = 0,
  address,
  bytes,
  decimalView,
  charDump,
  pointedInfo,
  lastJumpAddress,
  isRom,
  editClicked,
  addressDigits = 4,
  characterInfo
}: MemoryDumpSectionViewProps) => {
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);

  if (isWidePartitionLabel(partitionLabel, decimalView, showPartitions)) {
    partitionLabel = toDecimal3(parseInt(partitionLabel!, 16));
  }

  const addressText = decimalView
    ? (addressDigits === 6 ? toDecimal7(address) : toDecimal5(address))
    : (addressDigits === 6 ? toHexa6Dash(address) : toHexa4(address));
  /*
   * M2: `ch`, not px. Capacity preserved from 64/48/72/40 at the row's 12.8px Iosevka
   * (1ch = 6.4px). Each value comfortably holds its formatter's output: `toDecimal7` and
   * `toHexa6Dash` are 7 characters, `toDecimal5` is 5, `toHexa4` is 4.
   */
  const addressWidth = decimalView
    ? (addressDigits === 6 ? 10 : 8)
    : (addressDigits === 6 ? 12 : 7);

  return (
    <div className={classnames(styles.dumpSection)}>
      <LabelSeparator width={8} />
      {/*
        * Rendered whenever the list has a bank column at all, not merely when *this* row has a
        * label, and at the column's shared width rather than this row's own. Dropping the cell on
        * an unlabelled bank shifted that row's address and hex columns left of its neighbours'.
        */}
      {partitionWidthCh > 0 && (
        <PartitionPrefix label={partitionLabel ?? ""} width={partitionWidthCh} />
      )}
      <AddressLabel text={addressText} width={addressWidth} className={styles.memoryAddress} />
      <HexValues
        address={address}
        bytes={bytes}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        lastJumpAddress={lastJumpAddress}
        isRom={isRom}
        editClicked={editClicked}
        tooltipCache={characterInfo.tooltipCache}
        hoveredByteIndex={hoveredByteIndex}
        onHoverChange={setHoveredByteIndex}
      />
      <LabelSeparator width={8} />
      {charDump && (
        <CharDump
          bytes={bytes}
          characterSet={characterInfo.characterSet}
          hoveredByteIndex={hoveredByteIndex}
        />
      )}
    </div>
  );
};

// --- Memoize MemoryDumpSectionView to avoid re-rendering when the displayed byte values (and
// other display-impacting props) have not changed.
export const MemoryDumpSectionView = memo(MemoryDumpSectionViewComponent, (prev, next) => {
  // Address itself affects the address label and which bytes are shown
  if (prev.address !== next.address) return false;

  // View mode and layout-affecting props
  if (prev.decimalView !== next.decimalView) return false;
  if (prev.charDump !== next.charDump) return false;
  if (prev.showPartitions !== next.showPartitions) return false;
  if (prev.partitionLabel !== next.partitionLabel) return false;
  // --- The shared bank-column width. Without this a row keeps a stale column when the width
  // --- changes (switching to decimal view, or to a bank set with wider labels) and the dump goes
  // --- ragged until something else forces a re-render.
  if (prev.partitionWidthCh !== next.partitionWidthCh) return false;
  if (prev.bytes.length !== next.bytes.length) return false;

  // Highlighting/styling and edit behavior
  if (prev.lastJumpAddress !== next.lastJumpAddress) return false;
  if (prev.isRom !== next.isRom) return false;
  if (prev.editClicked !== next.editClicked) return false;
  if (prev.addressDigits !== next.addressDigits) return false;
  if (prev.characterInfo !== next.characterInfo) return false;

  // Compare the byte values actually rendered
  for (let i = 0; i < prev.bytes.length; i++) {
    const addr = prev.address + i;
    if (prev.bytes[i] !== next.bytes[i]) return false;

    // Also ensure pointed info affecting tooltip/styling hasn't changed for these addresses
    const prevPoint = prev.pointedInfo?.[addr];
    const nextPoint = next.pointedInfo?.[addr];
    if (prevPoint !== nextPoint) return false;
  }

  // If we got here, nothing relevant changed
  return true;
});

// Character dump component - memoized
type CharDumpProps = {
  bytes: readonly number[];
  characterSet: Record<number, CharDescriptor>;
  hoveredByteIndex?: number | null;
};

const CharDumpComponent = ({ bytes, characterSet, hoveredByteIndex }: CharDumpProps) => {
  return (
    <>
      <div className={styles.charValues}>
        {/*
         * `bytes` is typed as `readonly number[]`, but the live Machine Memory panel actually
         * hands it a `Uint8Array` view (`memory.subarray(...)`) to avoid copying on every scroll.
         * `Array.prototype.map` renders each byte's index and value; `Uint8Array.prototype.map`
         * builds a *new typed array* instead, coercing every callback return value (a JSX
         * element, here) to a number for storage - which turns each `<span>` into `NaN`, clamped
         * to `0`. React then rendered that all-zero Uint8Array directly, showing "0" for every
         * byte regardless of its actual value. `Array.from` normalizes both array and typed-array
         * inputs to a plain array first, so `.map` is always the one that returns JSX.
         */}
        {Array.from(bytes).map((value, i) => {
          if (value === undefined) return <span key={i} className={styles.charPlaceholder}>&nbsp;</span>;
          const valueInfo = characterSet[(value ?? 0x20) & 0xff] ?? {};
          const ch = valueInfo.v ?? ".";
          const isHovered = hoveredByteIndex === i;
          return (
            <span
              key={i}
              className={isHovered ? styles.charHighlight : styles.charItem}
            >
              {ch}
            </span>
          );
        })}
      </div>
      <LabelSeparator width={8} />
    </>
  );
};

const CharDump = memo(CharDumpComponent, (prev, next) => {
  if (prev.hoveredByteIndex !== next.hoveredByteIndex) return false;
  if (prev.characterSet !== next.characterSet) return false;
  if (prev.bytes.length !== next.bytes.length) return false;
  for (let i = 0; i < prev.bytes.length; i++) {
    if (prev.bytes[i] !== next.bytes[i]) return false;
  }
  return true;
});

type HexValuesProps = {
  address: number;
  bytes: readonly number[];
  decimalView?: boolean;
  pointedInfo?: Record<number, string>;
  lastJumpAddress?: number;
  isRom?: boolean;
  editClicked?: (address: number) => void;
  tooltipCache: readonly string[];
  hoveredByteIndex?: number | null;
  onHoverChange?: (index: number | null) => void;
};

const HexValuesComponent = ({
  address,
  bytes,
  decimalView,
  pointedInfo,
  lastJumpAddress,
  editClicked,
  tooltipCache,
  hoveredByteIndex,
  onHoverChange
}: HexValuesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the space-separated hex string for all bytes - memoized
  const { hexParts, hexString } = useMemo(() => {
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const value = bytes[i];
      if (value !== undefined) {
        parts.push(decimalView ? toDecimal3(value) : toHexa2(value));
      }
    }
    return {
      hexParts: parts,
      hexString: parts.join(" ")
    };
  }, [bytes, decimalView]);

  // Handle mouse move to determine which byte is hovered - memoized
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is actually within the container bounds
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      onHoverChange?.(null);
      return;
    }

    onHoverChange?.(getByteIndexAtOffset(x, rect.width, hexString.length, decimalView, hexParts.length));
  }, [decimalView, hexParts.length, hexString.length, onHoverChange]);

  const handleMouseLeave = useCallback(() => {
    onHoverChange?.(null);
  }, [onHoverChange]);

  const handleMouseOut = useCallback(() => {
    // Additional safeguard to clear hover state when mouse exits
    onHoverChange?.(null);
  }, [onHoverChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!editClicked || !containerRef.current) return;
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const foundIndex = getByteIndexAtOffset(x, rect.width, hexString.length, decimalView, hexParts.length);

    if (foundIndex !== null) {
      editClicked(address + foundIndex);
    }
  }, [editClicked, decimalView, hexParts.length, hexString.length, address]);

  /*
   * Tooltip content - memoized.
   *
   * Broken into its pieces (rather than one `\n`-joined string for `TooltipFactory`'s plain-text
   * `content` prop) so each line can carry the same colour as the column it describes - the
   * address heading in `--color-memory-address`, the hex/decimal/binary value in
   * `--color-memory-value`, the character/description in `--color-memory-char` - instead of every
   * line reading as identical, uncoloured text next to a row that is now anything but.
   *
   * `tooltipCache[value]` (built by `buildByteTooltipCache`) is still a plain two-line string - it
   * is also asserted on directly in tests as a string - so it is split here rather than changing
   * its shape.
   */
  const tooltipLines = useMemo(() => {
    const byteValue = hoveredByteIndex == null ? undefined : bytes[hoveredByteIndex];
    if (hoveredByteIndex == null || byteValue === undefined) {
      return null;
    }
    const byteAddress = address + hoveredByteIndex;
    const [valueLine, charDescLine] = (tooltipCache[byteValue] ?? "").split("\n");
    return {
      header: `Value at $${toHexa4(byteAddress)} (${byteAddress}):`,
      value: valueLine,
      charDesc: charDescLine
    };
  }, [hoveredByteIndex, address, bytes, tooltipCache]);

  const pointedHint = hoveredByteIndex != null ? pointedInfo?.[address + hoveredByteIndex] : undefined;

  // Calculate overlay position for the hovered byte - memoized
  const overlayStyle = useMemo(() => {
    if (hoveredByteIndex == null) return undefined;
    return {
      left: `${hoveredByteIndex * ((decimalView ? 3 : 2) + 1)}ch`,
      width: `${decimalView ? 3 : 2}ch`
    };
  }, [hoveredByteIndex, decimalView]);

  // Determine lastJump byte index - memoized
  const lastJumpByteIndex = useMemo(() => {
    for (let i = 0; i < bytes.length; i++) {
      if (lastJumpAddress === address + i) {
        return i;
      }
    }
    return null;
  }, [lastJumpAddress, address, bytes.length]);

  // Calculate overlay position for lastJump byte - memoized
  const lastJumpOverlayStyle = useMemo(() => {
    if (lastJumpByteIndex === null) return undefined;
    return {
      left: `${lastJumpByteIndex * ((decimalView ? 3 : 2) + 1)}ch`,
      width: `${decimalView ? 3 : 2}ch`
    };
  }, [lastJumpByteIndex, decimalView]);

  return (
    <div
      ref={containerRef}
      className={styles.hexValues}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseOut={handleMouseOut}
      onContextMenu={handleContextMenu}
    >
      {hexString}
      {overlayStyle && hoveredByteIndex !== null && (
        <div className={styles.byteHoverOverlay} style={overlayStyle}>
          {hexString.substring(
            hoveredByteIndex * (decimalView ? 4 : 3),
            hoveredByteIndex * (decimalView ? 4 : 3) + (decimalView ? 3 : 2)
          )}
        </div>
      )}
      {lastJumpOverlayStyle && lastJumpByteIndex !== null && (
        <div className={styles.lastJumpOverlay} style={lastJumpOverlayStyle}>
          {hexString.substring(
            lastJumpByteIndex * (decimalView ? 4 : 3),
            lastJumpByteIndex * (decimalView ? 4 : 3) + (decimalView ? 3 : 2)
          )}
        </div>
      )}
      {tooltipLines && containerRef.current && (
        <TooltipFactory
          refElement={containerRef.current}
          placement="bottom"
          offsetX={12}
          offsetY={0}
          showDelay={0}
          isShown={true}
          className={styles.memoryTooltip}
        >
          <div className={styles.tooltipHeader}>{tooltipLines.header}</div>
          <div className={styles.tooltipValue}>{tooltipLines.value}</div>
          <div className={styles.tooltipCharDesc}>{tooltipLines.charDesc}</div>
          {pointedHint && (
            <div className={styles.tooltipPointed}>Pointed by: {pointedHint}</div>
          )}
        </TooltipFactory>
      )}
    </div>
  );
};

// Memoize HexValues to avoid re-rendering when props haven't changed
const HexValues = memo(HexValuesComponent, (prev, next) => {
  // Only re-render if these props actually change
  if (prev.address !== next.address) return false;
  if (prev.decimalView !== next.decimalView) return false;
  if (prev.lastJumpAddress !== next.lastJumpAddress) return false;
  if (prev.editClicked !== next.editClicked) return false;
  if (prev.tooltipCache !== next.tooltipCache) return false;
  if (prev.hoveredByteIndex !== next.hoveredByteIndex) return false;
  if (prev.onHoverChange !== next.onHoverChange) return false;
  if (prev.bytes.length !== next.bytes.length) return false;

  // Check if the bytes have changed
  for (let i = 0; i < prev.bytes.length; i++) {
    if (prev.bytes[i] !== next.bytes[i]) return false;
  }

  // Check if pointedInfo has changed for any of the bytes
  for (let i = 0; i < prev.bytes.length; i++) {
    const addr = prev.address + i;
    if (prev.pointedInfo?.[addr] !== next.pointedInfo?.[addr]) return false;
  }

  return true;
});

function useMemoryCharacterInfo(charset?: Record<number, CharDescriptor>) {
  return getMemoryCharacterInfo(charset);
}

export function getMemoryCharacterInfo(charset?: Record<number, CharDescriptor>): MemoryCharacterInfo {
  if (!charset) {
    return EMPTY_CHARACTER_INFO;
  }

  const cached = characterInfoCache.get(charset);
  if (cached) {
    return cached;
  }

  const characterInfo = {
    characterSet: charset,
    tooltipCache: buildByteTooltipCache(charset)
  };
  characterInfoCache.set(charset, characterInfo);
  return characterInfo;
}

export function buildByteTooltipCache(charset: Record<number, CharDescriptor>): string[] {
  const tooltipCache: string[] = [];
  for (let i = 0; i < 0x100; i++) {
    const valueInfo = charset[i] ?? {};
    let description = valueInfo.t ?? "";
    if (valueInfo.c === "graph") {
      description = "(graphics)";
    } else if (valueInfo.c) {
      description = valueInfo.t ?? "";
    }
    tooltipCache[i] =
      `$${toHexa2(i)} (${i}, ${toBin8(i)})\n` +
      `${valueInfo.v ? valueInfo.v + " " : ""}${description}`;
  }
  return tooltipCache;
}

export function getByteIndexAtOffset(
  offsetX: number,
  totalWidth: number,
  totalChars: number,
  decimalView: boolean | undefined,
  byteCount: number
): number | null {
  if (offsetX < 0 || totalWidth <= 0 || totalChars <= 0 || byteCount <= 0) {
    return null;
  }

  const charWidth = totalWidth / totalChars;
  if (charWidth <= 0) {
    return null;
  }

  const byteWidth = decimalView ? 3 : 2;
  const stride = byteWidth + 1;
  for (let i = 0; i < byteCount; i++) {
    const startPos = i * stride * charWidth;
    const endPos = startPos + byteWidth * charWidth;
    if (offsetX >= startPos && offsetX < endPos) {
      return i;
    }
  }
  return null;
}

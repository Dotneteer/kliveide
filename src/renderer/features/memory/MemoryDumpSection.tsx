import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Label } from "@renderer/controls/layout/Label";
import { TooltipFactory } from "@controls/Tooltip";
import classnames from "classnames";
import { toHexa4, toHexa6Dash, toHexa2, toDecimal5, toDecimal7, toDecimal3, toBin8 } from "@renderer/appIde/services/ide-commands";
import styles from "./MemoryDumpSection.module.scss";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CharDescriptor } from "@common/machines/info-types";
import { memo, useRef, useState, useMemo, useCallback } from "react";
import { EMPTY_OBJECT } from "@renderer/utils/stablerefs";

type MemoryDumpSectionProps = {
  showPartitions?: boolean;
  partitionLabel?: string;
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

type MemoryCharacterInfo = {
  characterSet: Record<number, CharDescriptor>;
  tooltipCache: readonly string[];
};

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

  let useWidePartitions = false;
  if (showPartitions && partitionLabel && decimalView) {
    const partAsNumber = parseInt(partitionLabel, 16);
    if (!isNaN(partAsNumber)) {
      useWidePartitions = true;
      partitionLabel = toDecimal3(partAsNumber);
    }
  }

  return (
    <div className={classnames(styles.dumpSection)}>
      <LabelSeparator width={8} />
      {showPartitions && partitionLabel && (
        <>
          <LabelSeparator />
          <Label text={partitionLabel} width={useWidePartitions ? 26 : 18} />
          <Label text=":" width={6} />
          <LabelSeparator />
        </>
      )}
      <Label
        text={decimalView
          ? (addressDigits === 6 ? toDecimal7(address) : toDecimal5(address))
          : (addressDigits === 6 ? toHexa6Dash(address) : toHexa4(address))}
        width={decimalView
          ? (addressDigits === 6 ? 64 : 48)
          : (addressDigits === 6 ? 72 : 40)}
      />
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
const MemoryDumpSectionView = memo(MemoryDumpSectionViewComponent, (prev, next) => {
  // Address itself affects the address label and which bytes are shown
  if (prev.address !== next.address) return false;

  // View mode and layout-affecting props
  if (prev.decimalView !== next.decimalView) return false;
  if (prev.charDump !== next.charDump) return false;
  if (prev.showPartitions !== next.showPartitions) return false;
  if (prev.partitionLabel !== next.partitionLabel) return false;
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
        {bytes.map((value, i) => {
          if (value === undefined) return <span key={i} className={styles.charPlaceholder}>&nbsp;</span>;
          const valueInfo = characterSet[(value ?? 0x20) & 0xff];
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

  // Tooltip content - memoized
  const tooltipContent = useMemo(() => {
    if (hoveredByteIndex == null || bytes[hoveredByteIndex] === undefined) {
      return null;
    }
    return `Value at $${toHexa4(address + hoveredByteIndex)} (${address + hoveredByteIndex}):` +
      `\n${tooltipCache[bytes[hoveredByteIndex]]}`;
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
      {tooltipContent && containerRef.current && (
        <TooltipFactory
          refElement={containerRef.current}
          placement="bottom"
          offsetX={12}
          offsetY={0}
          showDelay={0}
          isShown={true}
          content={tooltipContent + `${pointedHint ? `\nPointed by: ${pointedHint}` : ""}`}
        />
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
  const characterSet = charset ?? (EMPTY_OBJECT as Record<number, CharDescriptor>);
  const tooltipCache = useMemo(() => buildByteTooltipCache(characterSet), [characterSet]);
  return useMemo(() => ({ characterSet, tooltipCache }), [characterSet, tooltipCache]);
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

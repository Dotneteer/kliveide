import { LabelSeparator, Label } from "@controls/Labels";
import { TooltipFactory } from "@controls/Tooltip";
import classnames from "classnames";
import { toHexa4, toHexa2, toDecimal5, toDecimal3, toBin8 } from "../services/ide-commands";
import styles from "./DumpSection.module.scss";
import { useAppServices } from "../services/AppServicesProvider";
import { CharDescriptor } from "@common/machines/info-types";
import { useEffect, memo, useLayoutEffect, useRef, useState } from "react";
import { EMPTY_OBJECT } from "@renderer/utils/stablerefs";

type DumpProps = {
  showPartitions?: boolean;
  partitionLabel?: string;
  address: number;
  memory: Uint8Array;
  decimalView: boolean;
  charDump: boolean;
  pointedInfo?: Record<number, string>;
  lastJumpAddress: number;
  isRom?: boolean;
  editClicked?: (address: number) => void;
};

const DumpSectionComponent = ({
  showPartitions,
  partitionLabel,
  address,
  memory,
  decimalView,
  charDump,
  pointedInfo,
  lastJumpAddress,
  isRom,
  editClicked
}: DumpProps) => {
  if (!memory) return null;

  const { machineService } = useAppServices();
  const machineCharSet = machineService.getMachineInfo()?.machine?.charSet;
  if (characterSet === EMPTY_OBJECT) {
    initTooltipCache(machineCharSet);
  }

  useEffect(() => {
    initTooltipCache(machineCharSet);
  }, [machineCharSet]);

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
          <LabelSeparator width={4} />
          <Label text={partitionLabel} width={useWidePartitions ? 26 : 18} />
          <Label text=":" width={6} />
          <LabelSeparator width={4} />
        </>
      )}
      <Label
        text={decimalView ? toDecimal5(address) : toHexa4(address)}
        width={decimalView ? 48 : 40}
      />
      <HexValues
        address={address}
        memory={memory}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        lastJumpAddress={lastJumpAddress}
        isRom={isRom}
        editClicked={editClicked}
      />
      <LabelSeparator width={8} />
      {charDump && (
        <>
          <CharValues
            address={address}
            memory={memory}
            pointedInfo={pointedInfo}
            isRom={isRom}
            editClicked={editClicked}
          />
          <LabelSeparator width={8} />
        </>
      )}
    </div>
  );
};

// --- Memoize DumpSection to avoid re-rendering when the 8 displayed byte values (and
// other display-impacting props) have not changed.
export const DumpSection = memo(DumpSectionComponent, (prev, next) => {
  // Address itself affects the address label and which bytes are shown
  if (prev.address !== next.address) return false;

  // View mode and layout-affecting props
  if (prev.decimalView !== next.decimalView) return false;
  if (prev.charDump !== next.charDump) return false;
  if (prev.showPartitions !== next.showPartitions) return false;
  if (prev.partitionLabel !== next.partitionLabel) return false;

  // Highlighting/styling and edit behavior
  if (prev.lastJumpAddress !== next.lastJumpAddress) return false;
  if (prev.isRom !== next.isRom) return false;
  if (prev.editClicked !== next.editClicked) return false;

  // Compare the 8 byte values actually rendered (address .. address+7)
  for (let i = 0; i < 8; i++) {
    const addr = prev.address + i;
    if (prev.memory[addr] !== next.memory[addr]) return false;

    // Also ensure pointed info affecting tooltip/styling hasn't changed for these addresses
    const prevPoint = prev.pointedInfo?.[addr];
    const nextPoint = next.pointedInfo?.[addr];
    if (prevPoint !== nextPoint) return false;
  }

  // If we got here, nothing relevant changed
  return true;
});

type HexValuesProps = {
  address: number;
  memory: Uint8Array;
  decimalView?: boolean;
  pointedInfo?: Record<number, string>;
  lastJumpAddress?: number;
  isRom?: boolean;
  editClicked?: (address: number) => void;
};

const HexValues = ({
  address,
  memory,
  decimalView,
  pointedInfo,
  lastJumpAddress,
  isRom: _isRom,
  editClicked: _editClicked
}: HexValuesProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredByteIndex, setHoveredByteIndex] = useState<number | null>(null);
  const [charWidth, setCharWidth] = useState<number>(0);

  // Build the space-separated hex string for all 8 bytes
  const hexParts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const value = memory[address + i];
    if (value !== undefined) {
      hexParts.push(decimalView ? toDecimal3(value) : toHexa2(value));
    }
  }
  const hexString = hexParts.join(" ");

  // Calculate character width from the container after render (monospace font)
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Create a temporary span to measure actual text width
    const tempSpan = document.createElement("span");
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    tempSpan.style.whiteSpace = "pre";

    // Copy font properties from container
    const computedStyle = window.getComputedStyle(containerRef.current);
    tempSpan.style.font = computedStyle.font;
    tempSpan.style.fontSize = computedStyle.fontSize;
    tempSpan.style.fontFamily = computedStyle.fontFamily;
    tempSpan.textContent = hexString;

    document.body.appendChild(tempSpan);
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);

    const totalChars = hexString.length;
    if (totalChars > 0) {
      setCharWidth(textWidth / totalChars);
    }
  }, [hexString]);

  // Handle mouse move to determine which byte is hovered
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || charWidth === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is actually within the container bounds
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      setHoveredByteIndex(null);
      return;
    }

    // Calculate byte positions based on character width
    // Each byte in hex is 2 chars, in decimal is 3 chars, plus 1 space between bytes
    const byteWidth = decimalView ? 3 : 2;
    const spacing = 1; // space character

    let foundIndex: number | null = null;
    for (let i = 0; i < hexParts.length; i++) {
      const startPos = i * (byteWidth + spacing) * charWidth;
      const endPos = startPos + byteWidth * charWidth;

      if (x >= startPos && x < endPos) {
        foundIndex = i;
        break;
      }
    }

    setHoveredByteIndex(foundIndex);
  };

  const handleMouseLeave = () => {
    setHoveredByteIndex(null);
  };

  const handleMouseOut = () => {
    // Additional safeguard to clear hover state when mouse exits
    setHoveredByteIndex(null);
  };

  // Tooltip content
  const tooltipContent =
    hoveredByteIndex !== null && memory[address + hoveredByteIndex] !== undefined
      ? `Value at $${toHexa4(address + hoveredByteIndex)} (${address + hoveredByteIndex}):\n${tooltipCache[memory[address + hoveredByteIndex]]}`
      : null;

  // Calculate overlay position for the hovered byte
  const overlayStyle =
    hoveredByteIndex !== null && charWidth > 0
      ? {
          left: `${hoveredByteIndex * ((decimalView ? 3 : 2) + 1) * charWidth - 2}px`,
          width: `${(decimalView ? 3 : 2) * charWidth + 4}px`
        }
      : undefined;

  // Determine styling based on pointed/lastJump for any of the 8 bytes
  let hasPointed = false;
  let hasPcPointed = false;
  let hasLastJump = false;

  for (let i = 0; i < 8; i++) {
    const addr = address + i;
    const pointedHint = pointedInfo?.[addr];
    if (pointedHint !== undefined) {
      hasPointed = true;
      if (pointedHint.indexOf("PC") >= 0) {
        hasPcPointed = true;
      }
    }
    if (lastJumpAddress === addr) {
      hasLastJump = true;
    }
  }

  return (
    <div
      ref={containerRef}
      className={classnames(styles.hexValues, {
        [styles.pointed]: hasPointed,
        [styles.pcPointed]: hasPcPointed,
        [styles.lastJump]: hasLastJump
      })}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseOut={handleMouseOut}
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
      {tooltipContent && containerRef.current && (
        <TooltipFactory
          refElement={containerRef.current}
          placement="bottom"
          offsetX={12}
          offsetY={0}
          showDelay={0}
          isShown={true}
          content={tooltipContent}
        />
      )}
    </div>
  );
};
type CharValuesProps = {
  address: number;
  memory: Uint8Array;
  pointedInfo?: Record<number, string>;
  isRom?: boolean;
  editClicked?: (address: number) => void;
};

const CharValues = ({
  address,
  memory,
  isRom: _isRom,
  editClicked: _editClicked
}: CharValuesProps) => {
  // Build the 8-character string
  let charString = "";
  for (let i = 0; i < 8; i++) {
    const value = memory[address + i];
    if (value !== undefined) {
      const valueInfo = characterSet[(value ?? 0x20) & 0xff];
      charString += valueInfo.v ?? ".";
    }
  }

  return <div className={styles.charValues}>{charString}</div>;
};

// --- Cache tooltip value
let tooltipCache: string[] = [];
let characterSet: Record<number, CharDescriptor> = EMPTY_OBJECT;
function initTooltipCache(charset: Record<number, CharDescriptor>) {
  tooltipCache = [];
  characterSet = charset;
  for (let i = 0; i < 0x100; i++) {
    const valueInfo = charset[i];
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
}

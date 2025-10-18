import { LabelSeparator, Label } from "@controls/Labels";
import classnames from "classnames";
import { toHexa4, toHexa2, toDecimal5, toDecimal3, toBin8 } from "../services/ide-commands";
import styles from "./DumpSection.module.scss";
import { useAppServices } from "../services/AppServicesProvider";
import { CharDescriptor } from "@common/machines/info-types";
import { useEffect, memo } from "react";
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
  // Build the space-separated hex string for all 8 bytes
  const hexParts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const value = memory[address + i];
    if (value !== undefined) {
      hexParts.push(decimalView ? toDecimal3(value) : toHexa2(value));
    }
  }
  const hexString = hexParts.join(" ");

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
      className={classnames(styles.hexValues, {
        [styles.pointed]: hasPointed,
        [styles.pcPointed]: hasPcPointed,
        [styles.lastJump]: hasLastJump
      })}
    >
      {hexString}
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

  return (
    <div className={styles.charValues}>
      {charString}
    </div>
  );
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

import { LabelSeparator, Label } from "@controls/Labels";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import classnames from "classnames";
import { toHexa4, toHexa2, toDecimal5, toDecimal3, toBin8 } from "../services/ide-commands";
import styles from "./DumpSection.module.scss";
import { useAppServices } from "../services/AppServicesProvider";
import { CharDescriptor } from "@common/machines/info-types";
import { useEffect } from "react";
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

export const DumpSection = ({
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
      <ByteValue
        address={address + 0}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 0]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 1}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 1]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 2}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 2]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 3}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 3]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 4}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 4]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 5}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 5]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 6}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 6]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <ByteValue
        address={address + 7}
        lastJumpAddress={lastJumpAddress}
        value={memory[address + 7]}
        decimalView={decimalView}
        pointedInfo={pointedInfo}
        isRom={isRom}
        editClicked={editClicked}
      />
      <LabelSeparator width={8} />
      {charDump && (
        <>
          <CharValue
            address={address + 0}
            value={memory[address + 0]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 1}
            value={memory[address + 1]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 2}
            value={memory[address + 2]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 3}
            value={memory[address + 3]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 4}
            value={memory[address + 4]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 5}
            value={memory[address + 5]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 6}
            value={memory[address + 6]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <CharValue
            address={address + 7}
            value={memory[address + 7]}
            pointedInfo={pointedInfo}
            editClicked={editClicked}
          />
          <LabelSeparator width={8} />
        </>
      )}
    </div>
  );
};

type ByteValueProps = {
  address: number;
  decimalView?: boolean;
  value?: number;
  pointedInfo?: Record<number, string>;
  lastJumpAddress?: number;
  isRom?: boolean;
  editClicked?: (address: number) => void;
};

const ByteValue = ({
  address,
  decimalView,
  value,
  pointedInfo,
  lastJumpAddress,
  isRom,
  editClicked
}: ByteValueProps) => {
  // --- Do not display non-existing values
  if (value === undefined) return <div style={{ width: 20 }}></div>;

  const ref = useTooltipRef(value);
  const pointedHint = pointedInfo?.[address];
  const pointed = pointedHint !== undefined;
  const pcPointed = pointed && pointedHint.indexOf("PC") >= 0;
  let title =
    "Value at " +
    (decimalView ? `${address} ($${toHexa4(address)}):\n` : `$${toHexa4(address)} (${address}):\n`);
  title += `${tooltipCache[value]}${pointed ? `\nPointed by: ${pointedHint}` : ""}`;
  title += isRom ? "\n(ROM)" : "\nRight-click to edit the memory value";
  return (
    <div
      ref={ref}
      className={classnames(styles.value, {
        [styles.pointed]: pointed,
        [styles.pcPointed]: pcPointed,
        [styles.decimal]: decimalView,
        [styles.lastJump]: lastJumpAddress === address
      })}
      onContextMenu={(e) => {
        if (isRom) return false;
        e.preventDefault();
        editClicked?.(address);
        return false;
      }}
    >
      {decimalView ? toDecimal3(value) : toHexa2(value)}
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={8}
          offsetY={32}
          showDelay={100}
          content={title}
        />
      )}
    </div>
  );
};

const CharValue = ({ address, value, isRom, editClicked }: ByteValueProps) => {
  const hasValue = value !== undefined;
  const ref = useTooltipRef(value);
  const valueInfo = characterSet[(value ?? 0x20) & 0xff];
  let text = valueInfo.v ?? ".";
  let title = `Value at $${toHexa4(address)} (${address}):\n${tooltipCache[value]}`;
  title += isRom ? "\n(ROM)" : "\nRight-click to edit the memory value";
  return (
    <div
      ref={ref}
      className={styles.char}
      onContextMenu={(e) => {
        if (isRom) return false;
        e.preventDefault();
        editClicked?.(address);
        return false;
      }}
    >
      {text}
      {title && hasValue && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={8}
          offsetY={32}
          showDelay={100}
          content={title}
        />
      )}
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

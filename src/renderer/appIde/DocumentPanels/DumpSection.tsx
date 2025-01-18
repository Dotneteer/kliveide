import { LabelSeparator, Label } from "@controls/Labels";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import classnames from "@renderer/utils/classnames";
import { toHexa4, toHexa2 } from "../services/ide-commands";
import { ZxSpectrumChars } from "./char-codes";
import styles from "./DumpSection.module.scss";

type DumpProps = {
  showPartitions?: boolean;
  partitionLabel?: string;
  address: number;
  memory: Uint8Array;
  charDump: boolean;
  pointedInfo?: Record<number, string>;
};

export const DumpSection = ({
  showPartitions,
  partitionLabel,
  address,
  memory,
  charDump,
  pointedInfo
}: DumpProps) => {
  if (!memory) return null;

  return (
    <div className={classnames(styles.dumpSection)}>
      <LabelSeparator width={8} />
      {showPartitions && partitionLabel && (
        <>
          <LabelSeparator width={4} />
          <Label text={partitionLabel} width={18} />
          <Label text=':' width={6} />
          <LabelSeparator width={4} />
        </>
      )}
      <Label text={toHexa4(address)} width={40} />
      <ByteValue
        address={address + 0}
        value={memory[address + 0]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 1}
        value={memory[address + 1]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 2}
        value={memory[address + 2]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 3}
        value={memory[address + 3]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 4}
        value={memory[address + 4]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 5}
        value={memory[address + 5]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 6}
        value={memory[address + 6]}
        pointedInfo={pointedInfo}
      />
      <ByteValue
        address={address + 7}
        value={memory[address + 7]}
        pointedInfo={pointedInfo}
      />
      <LabelSeparator width={8} />
      {charDump && (
        <>
          <CharValue
            address={address + 0}
            value={memory[address + 0]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 1}
            value={memory[address + 1]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 2}
            value={memory[address + 2]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 3}
            value={memory[address + 3]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 4}
            value={memory[address + 4]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 5}
            value={memory[address + 5]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 6}
            value={memory[address + 6]}
            pointedInfo={pointedInfo}
          />
          <CharValue
            address={address + 7}
            value={memory[address + 7]}
            pointedInfo={pointedInfo}
          />
          <LabelSeparator width={8} />
        </>
      )}
    </div>
  );
};

type ByteValueProps = {
  address: number;
  value?: number;
  pointedInfo?: Record<number, string>;
};

const ByteValue = ({ address, value, pointedInfo }: ByteValueProps) => {
  // --- Do not display non-existing values
  if (value === undefined) return <div style={{ width: 20 }}></div>;

  const ref = useTooltipRef(value);
  const pointedHint = pointedInfo?.[address];
  const pointed = pointedHint !== undefined;
  const pcPointed = pointed && pointedHint.indexOf("PC") >= 0;
  const title = `Value at $${toHexa4(address)} (${address}):\n${
    tooltipCache[value]
  }${pointed ? `\nPointed by: ${pointedHint}` : ""}`;
  return (
    <div
      ref={ref}
      className={classnames(styles.value, {
        [styles.pointed]: pointed,
        [styles.pcPointed]: pcPointed
      })}
    >
      {toHexa2(value)}
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={8}
          offsetY={32}
          showDelay={100}
          content={title}
        />
      )}
    </div>
  );
};

const CharValue = ({ address, value }: ByteValueProps) => {
  const hasValue = value !== undefined;
  const ref = useTooltipRef(value);
  const valueInfo = ZxSpectrumChars[(value ?? 0x20) & 0xff];
  let text = valueInfo.v ?? ".";
  const title = `Value at $${toHexa4(address)} (${address}):\n${
    tooltipCache[value]
  }`;
  value;
  return (
    <div ref={ref} className={styles.char}>
      {text}
      {title && hasValue && (
        <TooltipFactory
          refElement={ref.current}
          placement='right'
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
const tooltipCache: string[] = [];
for (let i = 0; i < 0x100; i++) {
  const valueInfo = ZxSpectrumChars[i];
  let description = valueInfo.t ?? "";
  if (valueInfo.c === "graph") {
    description = "(graphics)";
  } else if (valueInfo.c) {
    description = valueInfo.t ?? "";
  }
  tooltipCache[i] =
    `$${toHexa2(i)} (${i}, %${i.toString(2)})\n` +
    `${valueInfo.v ? valueInfo.v + " " : ""}${description}`;
}

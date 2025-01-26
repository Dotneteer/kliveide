import { LabelSeparator, Label } from "@controls/Labels";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";
import classnames from "@renderer/utils/classnames";
import { memo, useState } from "react";
import styles from "./DumpSection.module.scss";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { ZxSpectrumChars } from "../char-codes";
import { useInitialize } from "@renderer/core/useInitializeAsync";

type DumpSectionProps = {
  address: number;
  memory: Uint8Array;
};

const PlainDumpSection = ({ address, memory }: DumpSectionProps) => {
  if (!memory) return null;

  return (
    <div className={classnames(styles.dumpSection)}>
      <LabelSeparator width={8} />
      <Label text={toHexa4(address)} width={40} />
      <ByteValue address={address + 0} value={memory[address + 0]} />
      <ByteValue address={address + 1} value={memory[address + 1]} />
      <ByteValue address={address + 2} value={memory[address + 2]} />
      <ByteValue address={address + 3} value={memory[address + 3]} />
      <ByteValue address={address + 4} value={memory[address + 4]} />
      <ByteValue address={address + 5} value={memory[address + 5]} />
      <ByteValue address={address + 6} value={memory[address + 6]} />
      <ByteValue address={address + 7} value={memory[address + 7]} />
      <LabelSeparator width={8} />
      <CharValue address={address + 0} value={memory[address + 0]} />
      <CharValue address={address + 1} value={memory[address + 1]} />
      <CharValue address={address + 2} value={memory[address + 2]} />
      <CharValue address={address + 3} value={memory[address + 3]} />
      <CharValue address={address + 4} value={memory[address + 4]} />
      <CharValue address={address + 5} value={memory[address + 5]} />
      <CharValue address={address + 6} value={memory[address + 6]} />
      <CharValue address={address + 7} value={memory[address + 7]} />
      <LabelSeparator width={8} />
    </div>
  );
};

export const DumpSection = memo(PlainDumpSection);

type ByteValueProps = {
  address: number;
  value?: number;
};

const ByteValue = ({ address, value }: ByteValueProps) => {
  // --- Do not display non-existing values
  if (value === undefined) return <div style={{ width: 20 }}></div>;

  // --- Hack to force the component to re-render because of the tooltip
  const [version, setVersion] = useState(1);
  useInitialize(() => {
    setVersion(version + 1);
  });

  const ref = useTooltipRef();
  const title = `Value at $${toHexa4(address)} (${address}):\n${tooltipCache[value]}`;
  return (
    <div ref={ref} className={classnames(styles.value)}>
      {toHexa2(value)}
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

const CharValue = ({ address, value }: ByteValueProps) => {
  const hasValue = value !== undefined;
  const ref = useTooltipRef();
  const valueInfo = ZxSpectrumChars[(value ?? 0x20) & 0xff];
  let text = valueInfo.v ?? ".";
  const title = `Value at $${toHexa4(address)} (${address}):\n${tooltipCache[value]}`;
  value;

  // --- Hack to force the component to re-render because of the tooltip
  const [version, setVersion] = useState(1);
  useInitialize(() => {
    setVersion(version + 1);
  });

  return (
    <div ref={ref} className={styles.char}>
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

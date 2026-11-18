import { useMemo } from "react";

import type { CharDescriptor } from "@common/machines/info-types";
import { useT } from "@common/i18n/useT";
import { toBin8, toHexa2 } from "@renderer/appIde/services/ide-commands";
import { Field, Fields, InspectorButton, InspectorColumn, InspectorSection } from "./Inspector";
import styles from "./MemoryMap.module.scss";

/*
 * The inspector sections every byte view shares (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5.2):
 * **Value at cursor** (the byte every way, the word and double word there) and **Selection** (its
 * range, length, sum and XOR, text, and copy and find actions). The live Memory view adds its
 * machine sections around them (`features/memory/MemoryInspector.tsx`); a file or a popped-out
 * bank shows them alone in a `ByteInspector`, read-only.
 */

/** `$` and upper-case hex digits */
const hexOf = (value: number, digits: number) => `$${value.toString(16).toUpperCase().padStart(digits, "0")}`;

/** A byte as a character: the machine's character set when there is one, printable ASCII otherwise */
export function charOfByte(charSet: Record<number, CharDescriptor> | undefined, b: number): string {
  return charSet?.[b]?.v ?? (b >= 32 && b < 127 ? String.fromCharCode(b) : "·");
}

export const ValueSection = ({
  bytes,
  at,
  charSet,
  wordLabel
}: {
  bytes: ArrayLike<number>;
  /** The cursor's index into `bytes` */
  at: number;
  charSet?: Record<number, CharDescriptor>;
  /** The label of the word at the cursor, when it names one */
  wordLabel?: string;
}) => {
  const t = useT();
  const read = (offset: number) => bytes[(at + offset) % Math.max(1, bytes.length)] ?? 0;
  const byte = read(0);
  const wordLe = byte | (read(1) << 8);
  const wordBe = (byte << 8) | read(1);
  const dword = (byte | (read(1) << 8) | (read(2) << 16) | (read(3) << 24)) >>> 0;
  const signed = byte > 127 ? byte - 256 : byte;
  return (
    <InspectorSection title={t("panels.memoryInspector.value")}>
      <Fields>
        <Field label={t("panels.memoryInspector.byte")}>
          {hexOf(byte, 2)} · {byte} · {signed}
        </Field>
        <Field label={t("panels.memoryInspector.binary")} plain>
          {toBin8(byte)}
        </Field>
        <Field label={t("panels.memoryInspector.char")} plain>
          '{charOfByte(charSet, byte)}'
        </Field>
        <Field label={t("panels.memoryInspector.wordLe")}>
          {hexOf(wordLe, 4)} · {wordLe}
          {wordLabel && ` · ${wordLabel}`}
        </Field>
        <Field label={t("panels.memoryInspector.wordBe")} plain>
          {hexOf(wordBe, 4)}
        </Field>
        <Field label={t("panels.memoryInspector.dwordLe")} plain>
          {hexOf(dword, 8)}
        </Field>
      </Fields>
    </InspectorSection>
  );
};

export const SelectionSection = ({
  bytes,
  selection,
  addressOf = (index) => index,
  addressDigits = 4,
  charSet,
  onShowAsGraphics,
  onFindBytes
}: {
  bytes: ArrayLike<number>;
  /** Inclusive indexes into `bytes` */
  selection: [number, number];
  /** The address a byte index is shown as (a bank listed at an offset) */
  addressOf?: (index: number) => number;
  addressDigits?: number;
  charSet?: Record<number, CharDescriptor>;
  onShowAsGraphics?: () => void;
  onFindBytes?: (pattern: string) => void;
}) => {
  const t = useT();
  const selected = useMemo(() => {
    const list: number[] = [];
    for (let i = selection[0]; i <= selection[1] && list.length < 0x10000; i++) list.push(bytes[i] ?? 0);
    let sum = 0;
    let xor = 0;
    for (const b of list) {
      sum = (sum + b) & 0xffff;
      xor ^= b;
    }
    return { list, sum, xor };
  }, [bytes, selection]);
  const copy = (text: string) => void navigator.clipboard?.writeText(text);
  const { list } = selected;
  return (
    <InspectorSection title={t("panels.memoryInspector.selection")}>
      <Fields>
        <Field label={t("panels.memoryInspector.range")}>
          {hexOf(addressOf(selection[0]), addressDigits)}–{hexOf(addressOf(selection[1]), addressDigits)}
        </Field>
        <Field label={t("panels.memoryInspector.length")}>
          {list.length} ({hexOf(list.length, 4)})
        </Field>
        <Field label={t("panels.memoryInspector.sumXor")} plain>
          {hexOf(selected.sum, 4)} · {hexOf(selected.xor, 2)}
        </Field>
        <Field label={t("panels.memoryInspector.asText")} plain>
          {list.slice(0, 64).map((b) => charOfByte(charSet, b)).join("")}
          {list.length > 64 ? "…" : ""}
        </Field>
      </Fields>
      <div className={styles.actions}>
        <InspectorButton onClick={() => copy(list.map((b) => toHexa2(b)).join(" "))}>
          {t("panels.memoryInspector.copyHex")}
        </InspectorButton>
        <InspectorButton
          onClick={() => {
            const lines: string[] = [];
            for (let i = 0; i < list.length; i += 8) {
              lines.push(`  .defb ${list.slice(i, i + 8).map((b) => `$${toHexa2(b)}`).join(", ")}`);
            }
            copy(lines.join("\n"));
          }}
        >
          {t("panels.memoryInspector.copyDefb")}
        </InspectorButton>
        {onShowAsGraphics && (
          <InspectorButton onClick={onShowAsGraphics}>{t("panels.feature.memory.showAsGraphics")}</InspectorButton>
        )}
        {onFindBytes && (
          <InspectorButton
            disabled={list.length > 64}
            onClick={() => onFindBytes(list.map((b) => toHexa2(b)).join(" "))}
          >
            {t("panels.memoryInspector.findThese")}
          </InspectorButton>
        )}
      </div>
    </InspectorSection>
  );
};

/**
 * The inspector of a byte view that is not the machine: a file, a popped-out bank. Read-only: the
 * value at the cursor and the selection.
 */
export const ByteInspector = ({
  bytes,
  cursor,
  selection,
  addressOf = (index) => index,
  addressDigits = 4,
  decimal,
  badge,
  charSet,
  onShowAsGraphics,
  onFindBytes
}: {
  bytes: ArrayLike<number>;
  cursor: number;
  selection?: [number, number];
  addressOf?: (index: number) => number;
  addressDigits?: number;
  decimal: boolean;
  badge?: string;
  charSet?: Record<number, CharDescriptor>;
  onShowAsGraphics?: () => void;
  onFindBytes?: (pattern: string) => void;
}) => {
  const address = addressOf(cursor);
  return (
    <InspectorColumn
      address={decimal ? String(address) : hexOf(address, addressDigits)}
      sub={decimal ? hexOf(address, addressDigits) : String(address)}
      badge={badge}
      readOnly
    >
      <ValueSection bytes={bytes} at={cursor} charSet={charSet} />
      {selection && (
        <SelectionSection
          bytes={bytes}
          selection={selection}
          addressOf={addressOf}
          addressDigits={addressDigits}
          charSet={charSet}
          onShowAsGraphics={onShowAsGraphics}
          onFindBytes={onFindBytes}
        />
      )}
    </InspectorColumn>
  );
};

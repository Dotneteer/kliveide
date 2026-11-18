import { useEffect, useMemo, useState } from "react";

import type { PartitionInfo, PartitionRole } from "@common/annotations/partitionInfo";
import { isWritableKind } from "@common/annotations/partitionInfo";
import { useT } from "@common/i18n/useT";
import { MemorySectionType } from "@abstractions/MemorySection";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { toBin8, toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { parseGoToNumber } from "@renderer/features/memoryMap/goToTarget";
import {
  Field,
  Fields,
  InspectorButton,
  InspectorColumn,
  InspectorLink,
  InspectorSection
} from "@renderer/features/memoryMap/Inspector";
import { Segmented } from "@renderer/features/memoryMap/FrameControls";
import { kindText, partitionNote, roleText, sizeText } from "@renderer/features/memoryMap/partitionText";
import styles from "@renderer/features/memoryMap/MemoryMap.module.scss";
import type { CharDescriptor } from "@common/machines/info-types";

/*
 * The Memory view's inspector (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5.2): what the byte
 * under the cursor is, its value read every way, an editor, the selection, the instructions there,
 * its heat and what to do with it. Everything arrives as props from `MemoryPanel`; this only lays
 * it out and reports the user's choices.
 */

export type MemoryInspectorProps = {
  /** The cursor's address in the view (a CPU address, or an offset of the partition shown) */
  cursor: number;
  /** The view's bytes */
  memory: Uint8Array;
  decimal: boolean;
  /** The partition the cursor byte is in, and the offset in it */
  location?: { partition: PartitionInfo; offset: number };
  /** Where the CPU sees the cursor byte now (a partition shown on its own may not be paged in) */
  cpuAddress?: number;
  /** The 8K slot of `cpuAddress` */
  roles?: readonly PartitionRole[];
  /** The label at the cursor, if any, and its synopsis */
  label?: { name: string; origin?: string };
  /** The label at the word under the cursor */
  wordLabel?: string;
  pointedBy?: string;
  changed?: boolean;
  /** The selection, inclusive view addresses */
  selection?: [number, number];
  /** The heat line (`E 12 · R 340 · W 2`) */
  heat?: string;
  /** The machine runs a Z80: the Instructions section */
  z80: boolean;
  z80n: boolean;
  /** The machine's character set, for the Char field and "as text" */
  charSet?: Record<number, CharDescriptor>;
  partitionLabelOf: (id: number) => string | undefined;
  /** A ROM page, flash, an empty slot: the reason it cannot be written */
  readOnlyReason?: string;
  onSet: (value: number, size: 1 | 2 | 4, bigEndian: boolean) => void;
  onGoTo: (address: number) => void;
  onOpenInDisassembly: () => void;
  onShowAsGraphics: () => void;
  onFindBytes: (pattern: string) => void;
  onBreakpoint: (kind: "exec" | "write") => void;
  /** Watch the word at the cursor (needs a label) */
  onWatch?: () => void;
};

const hex = (v: number, digits = 4) => `$${v.toString(16).toUpperCase().padStart(digits, "0")}`;

/** A few instructions from the cursor, by the Z80 disassembler */
function useInstructions(memory: Uint8Array, address: number, z80n: boolean, enabled: boolean) {
  const [rows, setRows] = useState<{ address: number; bytes: string; text: string }[]>([]);
  useEffect(() => {
    if (!enabled) {
      setRows([]);
      return undefined;
    }
    let cancelled = false;
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = memory[(address + i) % memory.length] ?? 0;
    const disassembler = new Z80Disassembler(
      [new MemorySection(0, 31, MemorySectionType.Disassemble)],
      bytes,
      undefined,
      { noLabelPrefix: true, allowExtendedSet: z80n }
    );
    disassembler.setAddressOffset(address);
    void disassembler
      .disassemble(0, 31)
      .then((output) => {
        if (cancelled) return;
        const items = (output?.outputItems ?? []).slice(0, 6);
        setRows(
          items.map((item) => ({
            address: item.address,
            bytes: (item.opCodes ?? []).map((b) => toHexa2(b)).join(" "),
            text: item.instruction ?? ""
          }))
        );
      })
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [memory, address, z80n, enabled]);
  return rows;
}

export const MemoryInspector = (props: MemoryInspectorProps) => {
  const t = useT();
  const { cursor, memory, decimal, location, selection } = props;
  const at = (offset: number) => memory[(cursor + offset) % Math.max(1, memory.length)] ?? 0;
  const byte = at(0);
  const wordLe = byte | (at(1) << 8);
  const wordBe = (byte << 8) | at(1);
  const dword = (byte | (at(1) << 8) | (at(2) << 16) | (at(3) << 24)) >>> 0;
  const signed = byte > 127 ? byte - 256 : byte;
  const charOf = (b: number) => props.charSet?.[b]?.v ?? (b >= 32 && b < 127 ? String.fromCharCode(b) : "·");

  // --- The editor: the value, its size and byte order
  const [editText, setEditText] = useState("");
  const [size, setSize] = useState<1 | 2 | 4>(1);
  const [bigEndian, setBigEndian] = useState(false);
  useEffect(() => setEditText(decimal ? String(byte) : hex(byte, 2)), [cursor, byte, decimal]);
  const editValue = useMemo(() => {
    const s = editText.trim();
    const quoted = /^"(.)"$/.exec(s);
    if (quoted) return quoted[1].charCodeAt(0);
    return parseGoToNumber(s, decimal);
  }, [editText, decimal]);
  const maxValue = size === 1 ? 0xff : size === 2 ? 0xffff : 0xffffffff;
  const editValid = editValue !== undefined && editValue >= 0 && editValue <= maxValue;

  // --- The selection: its bytes, sum and XOR, text
  const selected = useMemo(() => {
    if (!selection) return undefined;
    const bytes: number[] = [];
    for (let a = selection[0]; a <= selection[1] && bytes.length < 0x10000; a++) bytes.push(memory[a] ?? 0);
    let sum = 0;
    let xor = 0;
    for (const b of bytes) {
      sum = (sum + b) & 0xffff;
      xor ^= b;
    }
    return { bytes, sum, xor };
  }, [selection, memory]);

  const instructions = useInstructions(memory, cursor, props.z80n, props.z80);
  const writable = !props.readOnlyReason && isWritableKind(location?.partition.kind);
  const kind = location ? kindText(t, location.partition.kind) : undefined;
  const note = location ? partitionNote(t, location.partition, props.partitionLabelOf) : undefined;

  const copy = (text: string) => void navigator.clipboard?.writeText(text);

  return (
    <InspectorColumn
      address={decimal ? String(cursor) : hex(cursor)}
      sub={
        location
          ? `${location.partition.name}:${hex(location.offset)}`
          : decimal
            ? hex(cursor)
            : String(cursor)
      }
      badge={location ? `${location.partition.name} · ${kind}` : undefined}
      readOnly={!writable}
    >
      <InspectorSection title={t("panels.memoryInspector.location")}>
        <Fields>
          {location && (
            <>
              <Field label={t("panels.memoryInspector.partition")}>
                {location.partition.name} + {hex(location.offset)}
              </Field>
              <Field label={t("panels.memoryInspector.is")} plain>
                {[location.partition.description, sizeText(location.partition.size)].filter(Boolean).join(" · ")}
                {note && (
                  <>
                    <br />
                    {note}
                  </>
                )}
              </Field>
            </>
          )}
          <Field label={t("panels.memoryInspector.cpuSees")}>
            {props.cpuAddress !== undefined ? (
              <InspectorLink onClick={() => props.onGoTo(props.cpuAddress!)}>
                {hex(props.cpuAddress)} ({t("panels.memoryInspector.slot", { slot: props.cpuAddress >> 13 })})
              </InspectorLink>
            ) : (
              <span className={styles.fieldDim}>{t("panels.memoryMap.notPagedIn")}</span>
            )}
          </Field>
          {props.roles?.length ? (
            <Field label={t("panels.memoryInspector.role")} plain>
              {props.roles.map((r) => roleText(t, r)).join(", ")}
            </Field>
          ) : null}
          {props.label && (
            <Field label={t("panels.memoryInspector.label")} title={props.label.origin}>
              {props.label.name}
            </Field>
          )}
          {props.pointedBy && <Field label={t("panels.memoryInspector.pointedBy")}>{props.pointedBy}</Field>}
          {props.changed && (
            <Field label={t("panels.memoryInspector.changed")} plain>
              {t("panels.memoryMap.changedTitle")}
            </Field>
          )}
        </Fields>
      </InspectorSection>

      <InspectorSection title={t("panels.memoryInspector.value")}>
        <Fields>
          <Field label={t("panels.memoryInspector.byte")}>
            {hex(byte, 2)} · {byte} · {signed}
          </Field>
          <Field label={t("panels.memoryInspector.binary")} plain>
            {toBin8(byte)}
          </Field>
          <Field label={t("panels.memoryInspector.char")} plain>
            '{charOf(byte)}'
          </Field>
          <Field label={t("panels.memoryInspector.wordLe")}>
            {hex(wordLe)} · {wordLe}
            {props.wordLabel && ` · ${props.wordLabel}`}
          </Field>
          <Field label={t("panels.memoryInspector.wordBe")} plain>
            {hex(wordBe)}
          </Field>
          <Field label={t("panels.memoryInspector.dwordLe")} plain>
            {hex(dword, 8)}
          </Field>
        </Fields>
      </InspectorSection>

      <InspectorSection title={t("panels.memoryInspector.edit")} aside={writable ? t("panels.memoryInspector.typeOver") : undefined}>
        {writable ? (
          <>
            <div className={styles.editRow}>
              <input
                type="text"
                value={editText}
                spellCheck={false}
                aria-label={t("panels.memoryInspector.editValue")}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && editValid) props.onSet(editValue!, size, bigEndian);
                }}
              />
              <Segmented
                label={t("panels.memoryInspector.size")}
                value={size}
                options={[
                  { value: 1, text: "1" },
                  { value: 2, text: "2" },
                  { value: 4, text: "4" }
                ]}
                onChange={(v) => setSize(v as 1 | 2 | 4)}
              />
              <label className={styles.check}>
                <input type="checkbox" checked={bigEndian} onChange={(e) => setBigEndian(e.target.checked)} />
                BE
              </label>
              <InspectorButton disabled={!editValid} onClick={() => props.onSet(editValue!, size, bigEndian)}>
                {t("panels.memoryInspector.set")}
              </InspectorButton>
            </div>
            <div className={styles.hint}>{t("panels.memoryInspector.editHint")}</div>
          </>
        ) : (
          <div className={styles.hint}>{props.readOnlyReason ?? t("panels.memoryInspector.readOnly")}</div>
        )}
      </InspectorSection>

      {selection && selected && (
        <InspectorSection title={t("panels.memoryInspector.selection")}>
          <Fields>
            <Field label={t("panels.memoryInspector.range")}>
              {hex(selection[0])}–{hex(selection[1])}
            </Field>
            <Field label={t("panels.memoryInspector.length")}>
              {selected.bytes.length} ({hex(selected.bytes.length)})
            </Field>
            <Field label={t("panels.memoryInspector.sumXor")} plain>
              {hex(selected.sum)} · {hex(selected.xor, 2)}
            </Field>
            <Field label={t("panels.memoryInspector.asText")} plain>
              {selected.bytes.slice(0, 64).map(charOf).join("")}
              {selected.bytes.length > 64 ? "…" : ""}
            </Field>
          </Fields>
          <div className={styles.actions}>
            <InspectorButton onClick={() => copy(selected.bytes.map((b) => toHexa2(b)).join(" "))}>
              {t("panels.memoryInspector.copyHex")}
            </InspectorButton>
            <InspectorButton
              onClick={() => {
                const lines: string[] = [];
                for (let i = 0; i < selected.bytes.length; i += 8) {
                  lines.push(`  .defb ${selected.bytes.slice(i, i + 8).map((b) => `$${toHexa2(b)}`).join(", ")}`);
                }
                copy(lines.join("\n"));
              }}
            >
              {t("panels.memoryInspector.copyDefb")}
            </InspectorButton>
            <InspectorButton onClick={props.onShowAsGraphics}>{t("panels.feature.memory.showAsGraphics")}</InspectorButton>
            <InspectorButton
              disabled={selected.bytes.length > 64}
              onClick={() => props.onFindBytes(selected.bytes.map((b) => toHexa2(b)).join(" "))}
            >
              {t("panels.memoryInspector.findThese")}
            </InspectorButton>
          </div>
        </InspectorSection>
      )}

      {props.z80 && (
        <InspectorSection
          title={t("panels.memoryInspector.instructions")}
          aside={
            <InspectorLink onClick={props.onOpenInDisassembly}>{t("panels.memoryInspector.openInDisassembly")} ↗</InspectorLink>
          }
        >
          <div className={styles.miniListing}>
            {instructions.map((row, i) => [
              <span key={`a${i}`} className={styles.miniAddress}>
                {toHexa4(row.address)}
              </span>,
              <span key={`b${i}`} className={styles.miniBytes}>
                {row.bytes}
              </span>,
              <span key={`t${i}`}>{row.text}</span>
            ])}
          </div>
        </InspectorSection>
      )}

      {props.heat && (
        <InspectorSection title={t("panels.memoryInspector.heat")}>
          <span className={styles.fieldPlain}>{props.heat}</span>
        </InspectorSection>
      )}

      <InspectorSection title={t("panels.memoryInspector.use")}>
        <div className={styles.actions}>
          <InspectorButton onClick={() => props.onBreakpoint("exec")}>{t("panels.memoryInspector.breakpointHere")}</InspectorButton>
          <InspectorButton onClick={() => props.onBreakpoint("write")}>
            {selection ? t("panels.memoryInspector.breakOnWriteRange") : t("panels.memoryInspector.breakOnWrite")}
          </InspectorButton>
          {props.onWatch && <InspectorButton onClick={props.onWatch}>{t("panels.memoryInspector.watchWord")}</InspectorButton>}
        </div>
      </InspectorSection>
    </InspectorColumn>
  );
};

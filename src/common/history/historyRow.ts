import { historyContextDecoder } from "./contexts";
import { HistoryKind, type HistoryRecord } from "./historyRecord";

/*
 * One history row as text (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.6.1): the document's cells,
 * and, through `historyExport.ts` (G4.5), the `history` command's lines, "Copy rows as text" and the
 * exported traces all come from here. Pure - the disassembly and the source location are resolved by
 * the caller (the renderer owns both).
 */

/** What the caller knows about a row beyond the record */
export type HistoryRowInput = {
  record: HistoryRecord;
  /** −1 for the newest record, −2 for the one before, ... (G4.3's numbering) */
  step: number;
  /** The machine (`historyMachineId`) */
  machineId?: string;
  /** The disassembled instruction, when known */
  instruction?: string;
  /** The instruction's length in bytes, when known (else every captured byte is shown) */
  length?: number;
  /** `file.asm:123`, when the address maps to source */
  source?: string;
  /** The Changes column (`formatRegisterDiff`) */
  changes?: string;
  /** The partition label of PC (`R0`, `0A`), when the machine has partitions */
  partitionLabel?: string;
  /** How HALT, display-run and DMA-hold counts are written (`historyEventText`); "show" by default */
  repeats?: RepeatText;
};

/**
 * How an event row writes its repeat count (`.plans/TRACE_EXPORT_PLAN.md` D6, T2): "show" is the
 * viewer's `HALT ×1,203`; "mask" writes `HALT ×*`, because the count depends on timing, not on the
 * program path; "omit" leaves it out (CSV writes it in a column of its own). A DMA hold's held
 * T-states go with the count.
 */
export type RepeatText = "show" | "mask" | "omit";

/** The cells of a row */
export type HistoryRowCells = {
  step: string;
  time: string;
  address: string;
  bytes: string;
  /** The instruction, or the separator text of an event row */
  instruction: string;
  source: string;
  changes: string;
  /** INT, NMI and DMA records render as separators (§4.6.1) */
  separator: boolean;
};

/** The text of an event row, or undefined for an instruction */
export function historyEventText(
  record: HistoryRecord,
  machineId?: string,
  repeats: RepeatText = "show"
): string | undefined {
  const count = (n: number) =>
    repeats === "show" ? ` ×${n.toLocaleString("en-US")}` : repeats === "mask" ? " ×*" : "";
  switch (record.kind) {
    case HistoryKind.Int: {
      const im = record.regs.interruptMode;
      return im === 2
        ? `IM 2 interrupt, vector $${hex(record.bytes[0], 2)}`
        : `IM ${im} interrupt`;
    }
    case HistoryKind.Nmi:
      return "NMI";
    case HistoryKind.Halt:
      return `HALT${count(record.repeat)}`;
    case HistoryKind.ForcedNop:
      return `Display NOPs${count(record.repeat)}`;
    case HistoryKind.DmaHold:
      return (
        historyContextDecoder(machineId)?.describeEvent?.(record, repeats === "show") ||
        (repeats === "show" ? `DMA held the bus for ${record.repeat} T` : "DMA held the bus")
      );
  }
  return undefined;
}

/** Whether a record is drawn as a separator row */
export function isSeparatorRecord(record: HistoryRecord): boolean {
  return record.kind === HistoryKind.Int || record.kind === HistoryKind.Nmi || record.kind === HistoryKind.DmaHold;
}

export function historyRowCells(input: HistoryRowInput): HistoryRowCells {
  const { record } = input;
  const event = historyEventText(record, input.machineId, input.repeats);
  const separator = isSeparatorRecord(record);
  const shownBytes =
    record.kind === HistoryKind.Instruction
      ? record.bytes.slice(0, Math.max(1, Math.min(4, input.length ?? 4)))
      : record.kind === HistoryKind.Halt
        ? record.bytes.slice(0, 1)
        : [];
  return {
    step: String(input.step).replace("-", "−"),
    time: String(record.frameTact),
    address: `${input.partitionLabel ? `${input.partitionLabel}:` : ""}${hex(record.regs.pc, 4)}`,
    bytes: shownBytes.map((b) => hex(b, 2)).join(" "),
    instruction: separator ? `— ${event} —` : (event ?? input.instruction ?? ""),
    source: input.source ?? "",
    changes: input.changes ?? "",
    separator
  };
}

function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, "0");
}

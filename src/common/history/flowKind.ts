import { HistoryKind, type HistoryRecord } from "./historyRecord";

/*
 * Classifies a history record by what it did to the flow of control
 * (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.4): the viewer's row icons, and G4.3's reverse
 * step-over and step-out. Conditional instructions are "taken" or not by the PC of the record that
 * follows (an INT record's PC is the interrupted address, so it works there too).
 */

export type FlowKind = "call" | "rst" | "ret" | "jump" | "int" | "nmi" | "halt" | "dma" | "other";

export type FlowInfo = {
  kind: FlowKind;
  /** Whether the instruction is conditional (CALL cc, RET cc, JP cc, JR cc, DJNZ) */
  conditional: boolean;
  /** For a conditional instruction with a known next PC: whether it branched */
  taken?: boolean;
  /** RETI / RETN */
  fromInterrupt?: boolean;
};

const CALL_CC = new Set([0xc4, 0xcc, 0xd4, 0xdc, 0xe4, 0xec, 0xf4, 0xfc]);
const RET_CC = new Set([0xc0, 0xc8, 0xd0, 0xd8, 0xe0, 0xe8, 0xf0, 0xf8]);
const JP_CC = new Set([0xc2, 0xca, 0xd2, 0xda, 0xe2, 0xea, 0xf2, 0xfa]);
const JR_CC = new Set([0x20, 0x28, 0x30, 0x38]);
const RST = new Set([0xc7, 0xcf, 0xd7, 0xdf, 0xe7, 0xef, 0xf7, 0xff]);
/* RETN and its aliases (ED 45/55/5D/65/6D/75/7D) and RETI (ED 4D) */
const RET_ED = new Set([0x45, 0x4d, 0x55, 0x5d, 0x65, 0x6d, 0x75, 0x7d]);

/**
 * @param record The record
 * @param nextPc The PC of the next record (or the live PC, for the newest); decides "taken"
 */
export function classifyFlow(record: Pick<HistoryRecord, "kind" | "bytes" | "regs">, nextPc?: number): FlowInfo {
  switch (record.kind) {
    case HistoryKind.Int:
      return { kind: "int", conditional: false };
    case HistoryKind.Nmi:
      return { kind: "nmi", conditional: false };
    case HistoryKind.Halt:
      return { kind: "halt", conditional: false };
    case HistoryKind.DmaHold:
      return { kind: "dma", conditional: false };
  }
  const [b0, b1] = record.bytes;
  const pc = record.regs.pc;
  const branched = (length: number) => (nextPc === undefined ? undefined : nextPc !== ((pc + length) & 0xffff));
  if (b0 === 0xcd) return { kind: "call", conditional: false };
  if (CALL_CC.has(b0)) return { kind: "call", conditional: true, taken: branched(3) };
  if (RST.has(b0)) return { kind: "rst", conditional: false };
  if (b0 === 0xc9) return { kind: "ret", conditional: false };
  if (RET_CC.has(b0)) return { kind: "ret", conditional: true, taken: branched(1) };
  if (b0 === 0xed && RET_ED.has(b1)) return { kind: "ret", conditional: false, fromInterrupt: true };
  if (b0 === 0xc3 || b0 === 0x18 || b0 === 0xe9) return { kind: "jump", conditional: false };
  if ((b0 === 0xdd || b0 === 0xfd) && b1 === 0xe9) return { kind: "jump", conditional: false };
  // --- Z80N JP (C)
  if (b0 === 0xed && b1 === 0x98) return { kind: "jump", conditional: false };
  if (JP_CC.has(b0)) return { kind: "jump", conditional: true, taken: branched(3) };
  if (JR_CC.has(b0) || b0 === 0x10) return { kind: "jump", conditional: true, taken: branched(2) };
  return { kind: "other", conditional: false };
}

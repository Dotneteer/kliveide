import { classifyFlow } from "./flowKind";
import { HistoryKind, type HistoryRecord } from "./historyRecord";

/*
 * Interrupt service spans (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md` D10): the viewer folds each
 * INT or NMI and the instructions that serviced it into one expandable row, so a ZX81 in SLOW mode -
 * an NMI every scan line - still reads as the program it runs. Nothing is hidden for good and the
 * step numbering stays continuous: a span is a range of sequence numbers.
 *
 * A span starts at an INT or NMI record, whose SP is the stack before the acknowledge pushed the
 * return address. It ends with the first instruction that leaves the service: a taken return (RET,
 * RET cc, RETI, RETN) or an indirect jump (the ZX81 display's `JP (HL)` / `JP (IX)`, after the
 * service popped its return address) after which SP is back at or above that level. An interrupt taken inside a service nests in it (its SP is lower), so only the
 * outermost spans fold. A service still running at the newest record does not fold.
 */

/** What a span needs of a record */
export type ServiceSpanInput = Pick<HistoryRecord, "sequence" | "kind" | "bytes" | "frame" | "frameTact"> & {
  regs: Pick<HistoryRecord["regs"], "pc" | "sp">;
};

export type HistoryServiceSpan = {
  /** The INT or NMI record */
  first: number;
  /** The last record of the service: the instruction that left it */
  last: number;
  kind: typeof HistoryKind.Int | typeof HistoryKind.Nmi;
  /** Instructions the service ran (HALT and other event records not counted) */
  instructions: number;
  /** Frame tacts from the acknowledge to the instruction after the service, when both are in one frame */
  frameTacts?: number;
};

/** Whether SP is at or above `level`, on the 64K stack's circle */
function atOrAbove(sp: number, level: number): boolean {
  return ((sp - level) & 0xffff) < 0x8000;
}

/**
 * Whether an instruction can leave a service: a return that was taken, or an indirect jump (a
 * service that popped its return address goes back with `JP (HL)`, `JP (IX)` or `JP (IY)`). A
 * relative or absolute jump stays inside, whatever SP is.
 */
function leavesService(r: ServiceSpanInput, nextPc: number): boolean {
  const flow = classifyFlow(r, nextPc);
  if (flow.kind === "ret") return flow.taken !== false;
  if (flow.kind !== "jump") return false;
  const [b0, b1] = r.bytes;
  return b0 === 0xe9 || ((b0 === 0xdd || b0 === 0xfd) && b1 === 0xe9);
}

/**
 * The outermost interrupt service spans of consecutive records, oldest first
 * @param records Consecutive records, oldest first
 */
export function findServiceSpans(records: readonly ServiceSpanInput[]): HistoryServiceSpan[] {
  const spans: HistoryServiceSpan[] = [];
  let i = 0;
  while (i < records.length) {
    const event = records[i];
    if (event.kind !== HistoryKind.Int && event.kind !== HistoryKind.Nmi) {
      i++;
      continue;
    }
    const level = event.regs.sp;
    let instructions = 0;
    let end = -1;
    for (let j = i + 1; j < records.length; j++) {
      const r = records[j];
      if (r.kind !== HistoryKind.Instruction) continue;
      instructions++;
      const next = records[j + 1];
      if (!next) break;
      if (leavesService(r, next.regs.pc) && atOrAbove(next.regs.sp, level)) {
        end = j;
        break;
      }
    }
    if (end < 0) {
      // --- Still running at the newest record: not folded, but the services nested in it still are
      i++;
      continue;
    }
    const after = records[end + 1];
    spans.push({
      first: event.sequence,
      last: records[end].sequence,
      kind: event.kind,
      instructions,
      frameTacts: after && after.frame === event.frame ? after.frameTact - event.frameTact : undefined
    });
    i = end + 1;
  }
  return spans;
}

/** The text of a folded service row: "NMI service, 14 instructions, 96 T" */
export function serviceSpanText(span: HistoryServiceSpan, frameTactsPerBaseT = 1): string {
  const what = span.kind === HistoryKind.Nmi ? "NMI service" : "Interrupt service";
  const count = `${span.instructions.toLocaleString("en-US")} instruction${span.instructions === 1 ? "" : "s"}`;
  const time =
    span.frameTacts === undefined
      ? ""
      : `, ${Math.round(span.frameTacts / frameTactsPerBaseT).toLocaleString("en-US")} T`;
  return `${what}, ${count}${time}`;
}

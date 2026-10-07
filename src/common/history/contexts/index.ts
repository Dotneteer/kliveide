import type { HistoryRecord } from "../historyRecord";
import { describeZxNextContext, describeZxNextDmaHold, zxNextPartitionFor } from "./zxnextContext";

/*
 * The per-machine context decoders (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` D4, D14). A machine
 * that records history names its decoder by `historyMachineId`; G4.2 adds one entry per core here.
 */

export type HistoryContextDecoder = {
  /** The partition an address was in when the record was made (trap T13) */
  partitionFor(context: Uint8Array, address: number): number | undefined;
  /** The detail pane's text for an instruction's context */
  describe(context: Uint8Array, partitionLabels?: Record<number, string>): string;
  /** The row text of a machine-specific event record (the Next's DMA hold), or "" */
  describeEvent?(record: Pick<HistoryRecord, "repeat" | "context" | "kind">): string;
  /** What a record's frame tact counts in */
  frameTactUnit: string;
  /** Frame tacts per CPU T-state at the machine's base clock (the Next's tact is a 28 MHz tick) */
  frameTactsPerBaseT: number;
};

const decoders: Record<string, HistoryContextDecoder> = {
  zxnext: {
    partitionFor: zxNextPartitionFor,
    describe: describeZxNextContext,
    describeEvent: describeZxNextDmaHold,
    frameTactUnit: "28 MHz ticks",
    frameTactsPerBaseT: 8
  }
};

/** The context decoder of a machine; undefined for a machine that does not record history */
export function historyContextDecoder(machineId: string | undefined): HistoryContextDecoder | undefined {
  return machineId ? decoders[machineId] : undefined;
}

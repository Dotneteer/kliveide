import type { HistoryRecord } from "../historyRecord";
import { describeSp128Context, sp128PartitionFor } from "./sp128Context";
import { describeSp48Context, sp48PartitionFor } from "./sp48Context";
import { describeSpP3eContext, spp3ePartitionFor } from "./spp3eContext";
import { describeTimexContext, timexPartitionFor } from "./timexContext";
import { describeZ88Context, z88PartitionFor } from "./z88Context";
import { describeZx8081Context, zx8081PartitionFor } from "./zx8081Context";
import { describeZxNextContext, describeZxNextDmaHold, zxNextPartitionFor } from "./zxnextContext";

/*
 * The per-machine context decoders (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` D4, D14). A machine
 * that records history names its decoder by `historyMachineId` - its machine id. G4.2
 * (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`) added one per core; models share their machine's.
 */

export type HistoryContextDecoder = {
  /** The partition an address was in when the record was made (trap T13) */
  partitionFor(context: Uint8Array, address: number): number | undefined;
  /** The detail pane's text for an instruction's context */
  describe(context: Uint8Array, partitionLabels?: Record<number, string>): string;
  /**
   * The row text of a machine-specific event record (the Next's DMA hold), or ""; `withTime: false`
   * leaves out how long it took (a diff-friendly trace, `.plans/TRACE_EXPORT_PLAN.md` T2)
   */
  describeEvent?(record: Pick<HistoryRecord, "repeat" | "context" | "kind">, withTime?: boolean): string;
  /** What a record's frame tact counts in */
  frameTactUnit: string;
  /** Frame tacts per CPU T-state at the machine's base clock (the Next's tact is a 28 MHz tick) */
  frameTactsPerBaseT: number;
};

/** A machine whose frame position counts CPU T-states */
function tStates(partitionFor: HistoryContextDecoder["partitionFor"], describe: HistoryContextDecoder["describe"]): HistoryContextDecoder {
  return { partitionFor, describe, frameTactUnit: "T-states", frameTactsPerBaseT: 1 };
}

const decoders: Record<string, HistoryContextDecoder> = {
  sp48: tStates(sp48PartitionFor, describeSp48Context),
  timex: tStates(timexPartitionFor, describeTimexContext),
  sp128: tStates(sp128PartitionFor, describeSp128Context),
  scorpion: tStates(sp128PartitionFor, describeSp128Context),
  spp3e: tStates(spp3ePartitionFor, describeSpP3eContext),
  z88: tStates(z88PartitionFor, describeZ88Context),
  zx80: tStates(zx8081PartitionFor, describeZx8081Context),
  zx81: tStates(zx8081PartitionFor, describeZx8081Context),
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

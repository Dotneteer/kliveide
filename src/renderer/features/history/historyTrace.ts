import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { historyContextDecoder } from "@common/history/contexts";
import { HistoryKind, type HistoryRecord, type HistoryRegisters } from "@common/history/historyRecord";
import type { TraceResolvers } from "@common/history/historyExport";
import type { Z80CpuState } from "@common/messaging/EmuApi";
import { locateSource } from "@renderer/appIde/utils/source-location";
import type { HistoryDisassemblyCache } from "./historyDisassembly";

/*
 * What the trace exporter needs from the renderer (`.plans/TRACE_EXPORT_PLAN.md` D12): the
 * disassembly with the current compilation's labels, the source line, the partition label and the
 * memory map of a record - the same answers the Execution History document gives.
 */

export type TraceResolverSources = {
  /** The emulator's machine (`MI_ZXNEXT` decodes Z80N, source maps by machine) */
  machineId?: string;
  /** The machine whose context decoder reads the records (`historyMachineId`) */
  historyMachineId?: string;
  compilation?: KliveCompilerOutput;
  partitionLabels: Record<number, string>;
  disassembly: HistoryDisassemblyCache;
  include?: TraceResolvers["include"];
};

export function createTraceResolvers(sources: TraceResolverSources): TraceResolvers {
  const decoder = historyContextDecoder(sources.historyMachineId);
  const partitionOf = (r: HistoryRecord) => decoder?.partitionFor(r.context, r.regs.pc);
  return {
    instruction: (r) => sources.disassembly.disassemble(r),
    source: (r) => {
      if (r.kind !== HistoryKind.Instruction) return undefined;
      const location = locateSource(sources.compilation, r.regs.pc, undefined, {
        partition: partitionOf(r),
        machineId: sources.machineId
      });
      return location ? `${location.filename.split(/[\\/]/).pop()}:${location.line}` : undefined;
    },
    partitionLabel: (r) => {
      const p = partitionOf(r);
      return p === undefined ? undefined : sources.partitionLabels[p];
    },
    describeContext: (r) => decoder?.describe(r.context, sources.partitionLabels) ?? "",
    include: sources.include
  };
}

/** The history's register set of a live CPU state (the "after" of the newest record, T4) */
export function historyRegistersOf(cpu: Z80CpuState): HistoryRegisters {
  return {
    pc: cpu.pc,
    af: cpu.af,
    bc: cpu.bc,
    de: cpu.de,
    hl: cpu.hl,
    af_: cpu.af_,
    bc_: cpu.bc_,
    de_: cpu.de_,
    hl_: cpu.hl_,
    ix: cpu.ix,
    iy: cpu.iy,
    sp: cpu.sp,
    ir: cpu.ir,
    wz: cpu.wz,
    iff1: cpu.iff1,
    iff2: cpu.iff2,
    interruptMode: cpu.interruptMode
  };
}

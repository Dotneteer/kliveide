import type { IExecutionHistorySource } from "@emu/abstractions/IExecutionHistorySource";
import { historyContextDecoder } from "@common/history/contexts";
import { decodeHistoryPage, HistoryKind, type HistoryRecord } from "@common/history/historyRecord";
import type { HistoryServiceSpan } from "@common/history/serviceSpans";
import type {
  HistoricalCpuInfo,
  HistoryNavigationOp,
  HistoryNavigationOptions,
  HistoryNavigationResult
} from "@common/history/historyNavigation";
import {
  historicalCallStack,
  isInstructionStop,
  PagedHistorySource,
  reverseContinue,
  stepBack,
  stepBackOut,
  stepBackOver,
  stepForward,
  type HistoricalCallStack,
  type HistoryWalkOptions,
  type HistoryWalkResult
} from "@common/history/reverseStep";

/*
 * The history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D1, §4.1): where in the recorded past the
 * paused machine is being looked at. It never changes the machine; it changes what
 * `getCpuState()` answers (D2). It holds a sequence number, not a position, and checks it against
 * the ring on every read (T6): a cursor whose record was overwritten or whose ring was cleared is
 * dropped, and the views return to the present.
 */

/**
 * Answers "the CPU state at sequence s" (D14). The lite provider reads it from the history record
 * and leaves memory and devices at the present; G4.4's full reverse debugging will restore a
 * keyframe and replay to s, and say `memoryIsHistorical`.
 */
export interface IHistoricalStateProvider {
  /** Whether memory and devices show the same moment as the registers */
  readonly memoryIsHistorical: boolean;
  /** The record at a sequence and what the views need to know about it */
  stateAt(sequence: number): HistoricalState | undefined;
}

/** A historical CPU state: the record (registers before it ran) and its description */
export type HistoricalState = {
  record: HistoryRecord;
  info: HistoricalCpuInfo;
  /** The partition PC was in when the record was made */
  pcPartition?: number;
};

/** What the cursor needs of the machine controller */
export interface HistoryCursorHost {
  /** The machine's ring; undefined on a machine that does not record history */
  historySource(): IExecutionHistorySource | undefined;
  /** Only a paused machine has a cursor (D1) */
  isPaused(): boolean;
  livePc(): number;
  liveSp(): number;
  /** Statement-level stepping (D12): the stops are statement entries; undefined for instruction stepping */
  statementStop(): ((record: HistoryRecord, partition: number | undefined) => boolean) | undefined;
  /**
   * Reverse Continue (D11): whether an enabled execution breakpoint stops at this record. `notes`
   * collects what the user should be told (a condition that could not be checked).
   */
  breakpointHit(
    record: HistoryRecord,
    partition: number | undefined,
    notes: Set<string>
  ): { hit: boolean; label?: string };
  /** The cursor moved: the store carries it (D3) */
  publish(position: number, sequence: number | undefined): void;
}

export class HistoryCursor implements IHistoricalStateProvider {
  readonly memoryIsHistorical = false;
  private current?: { sequence: number; generation: number };
  private spansCache?: { generation: number; newest: number; spans: HistoryServiceSpan[] };

  constructor(private readonly host: HistoryCursorHost) {}

  /** The cursor's record, validated against the ring (T6); undefined at the present */
  get sequence(): number | undefined {
    if (!this.current) return undefined;
    const info = this.host.historySource()?.getHistoryInfo();
    if (
      !info ||
      info.generation !== this.current.generation ||
      this.current.sequence < info.oldestSequence ||
      this.current.sequence > info.newestSequence ||
      !this.host.isPaused()
    ) {
      this.clear();
      return undefined;
    }
    return this.current.sequence;
  }

  /** Steps back from the present (1 = the newest record), 0 at the present */
  get position(): number {
    const sequence = this.sequence;
    if (sequence === undefined) return 0;
    const info = this.host.historySource()?.getHistoryInfo();
    return info ? info.newestSequence - sequence + 1 : 0;
  }

  /** Back to the present (D5); returns whether there was a cursor */
  clear(): boolean {
    if (!this.current) return false;
    this.current = undefined;
    this.host.publish(0, undefined);
    return true;
  }

  /** The state at the cursor, or undefined at the present */
  state(): HistoricalState | undefined {
    const sequence = this.sequence;
    return sequence === undefined ? undefined : this.stateAt(sequence);
  }

  stateAt(sequence: number): HistoricalState | undefined {
    const source = this.host.historySource();
    const info = source?.getHistoryInfo();
    if (!source || !info) return undefined;
    // --- The record and the one before it (an INT or NMI there entered this routine, D8)
    const from = Math.max(info.oldestSequence, sequence - 1);
    const page = source.readHistory(from, sequence - from + 1);
    if (!page || page.gone) return undefined;
    const records = decodeHistoryPage(page);
    const record = records[records.length - 1];
    if (!record || record.sequence !== sequence) return undefined;
    const previous = records.length > 1 ? records[0] : undefined;
    const enteredBy =
      previous?.kind === HistoryKind.Int ? "int" : previous?.kind === HistoryKind.Nmi ? "nmi" : undefined;
    return {
      record,
      pcPartition: historyContextDecoder(source.historyMachineId)?.partitionFor(record.context, record.regs.pc),
      info: {
        position: info.newestSequence - sequence + 1,
        sequence,
        frame: record.frame,
        tact: record.frameTact,
        ...(enteredBy ? { enteredBy } : {}),
        ...(enteredBy === "int" ? { enteredByMode: previous!.regs.interruptMode } : {}),
        ...(record.kind === HistoryKind.Halt ? { haltRepeat: record.repeat } : {}),
        ...(previous ? { previousRegs: previous.regs } : {}),
        memoryIsHistorical: this.memoryIsHistorical
      }
    };
  }

  /** The call stack at the cursor, reconstructed from the records (D10); undefined at the present */
  callStack(): HistoricalCallStack | undefined {
    const sequence = this.sequence;
    if (sequence === undefined) return undefined;
    const walk = this.walkContext();
    if (!walk) return undefined;
    return historicalCallStack(walk.source, sequence, { services: walk.spans });
  }

  /** Moves the cursor (§4.1); the machine is not touched */
  navigate(op: HistoryNavigationOp, options: HistoryNavigationOptions = {}): HistoryNavigationResult {
    const here = (extra: Partial<HistoryNavigationResult> = {}): HistoryNavigationResult => ({
      position: this.position,
      sequence: this.sequence,
      moved: false,
      ...extra
    });
    const source = this.host.historySource();
    if (!source) return here({ reason: "noHistory" });
    if (op === "present") {
      const moved = this.clear();
      return { position: 0, moved };
    }
    if (!this.host.isPaused()) return here({ reason: "running" });
    const walk = this.walkContext();
    if (!walk || walk.info.count === 0) return here({ reason: "empty" });

    const from = this.sequence ?? null;
    const statementStop = this.host.statementStop();
    const decoder = historyContextDecoder(source.historyMachineId);
    const partitionOf = (r: HistoryRecord) => decoder?.partitionFor(r.context, r.regs.pc);
    const isStop = statementStop
      ? (r: HistoryRecord) => r.kind === HistoryKind.Instruction && statementStop(r, partitionOf(r))
      : isInstructionStop;
    const walkOptions: HistoryWalkOptions = { services: walk.spans, isStop };
    const notes = new Set<string>();
    let breakpoint: string | undefined;

    let result: HistoryWalkResult;
    if (typeof op === "object") {
      const target = "toSequence" in op ? op.toSequence : walk.info.newestSequence - op.toPosition + 1;
      if (target > walk.info.newestSequence) {
        this.clear();
        return { position: 0, moved: from !== null };
      }
      if (target < walk.info.oldestSequence) return here({ reason: "gone" });
      const record = walk.source.record(target);
      // --- An INT, NMI or DMA row stands for the instruction that follows it
      result =
        record && isInstructionStop(record)
          ? { position: target, moved: target !== from }
          : stepForward(walk.source, target, {});
    } else {
      switch (op) {
        case "back":
          result = stepBack(walk.source, from, { ...walkOptions, foldServices: options.foldServices });
          break;
        case "forward":
          result = stepForward(walk.source, from, { ...walkOptions, foldServices: options.foldServices });
          break;
        case "backOver":
          result = stepBackOver(walk.source, from, walkOptions);
          break;
        case "backOut":
          result = stepBackOut(walk.source, from, walkOptions);
          break;
        case "reverseContinue":
          result = reverseContinue(
            walk.source,
            from,
            (r) => {
              const hit = this.host.breakpointHit(r, partitionOf(r), notes);
              if (hit.hit) breakpoint = hit.label;
              return hit.hit;
            },
            walkOptions
          );
          break;
      }
    }

    if (result.moved) this.moveTo(result.position, walk.info.generation);
    return {
      ...here(),
      moved: result.moved,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.uncertain ? { uncertain: true } : {}),
      ...(notes.size ? { notes: [...notes] } : {}),
      ...(breakpoint && result.reason !== "noHit" ? { breakpoint } : {})
    };
  }

  private moveTo(sequence: number | null, generation: number): void {
    if (sequence === null) {
      this.clear();
      return;
    }
    this.current = { sequence, generation };
    this.host.publish(this.position, sequence);
  }

  /** A walk source over the ring as it is now, with its interrupt service spans */
  private walkContext() {
    const source = this.host.historySource();
    const info = source?.getHistoryInfo();
    if (!source || !info) return undefined;
    const cache = this.spansCache;
    if (!cache || cache.generation !== info.generation || cache.newest !== info.newestSequence) {
      this.spansCache = {
        generation: info.generation,
        newest: info.newestSequence,
        spans: source.getHistoryServiceSpans() ?? []
      };
    }
    const walkSource = new PagedHistorySource(
      info.oldestSequence,
      info.newestSequence,
      this.host.livePc(),
      this.host.liveSp(),
      (from, count) => {
        const page = source.readHistory(from, count);
        return page && !page.gone ? decodeHistoryPage(page) : [];
      },
      4096
    );
    return { info, source: walkSource, spans: this.spansCache!.spans };
  }
}

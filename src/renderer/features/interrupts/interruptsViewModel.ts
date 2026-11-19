import {
  isReservedIntSource,
  NEXT_INT_SOURCE_COUNT,
  NextIntEventKind,
  nextReg20BitOf,
  NextIntSource,
  statusClearWriteOf,
  vectorOf,
  type NextInterruptState,
  type NextIntEvent
} from "@common/zxnext/interrupts/interruptState";

/**
 * The Interrupts panel's model (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §3.1, §3.3): what each
 * chain row shows, which source blocks the chain, and the diagnostics. Pure and text-free: it holds
 * keys and arguments, the panel formats them (keys at definition, text at display).
 */

export type IntRowState = "idle" | "requesting" | "inService" | "statusSet" | "none";

export type IntChainRow = {
  index: number;
  enabled: boolean;
  status: boolean;
  state: IntRowState;
  /** The vector the source supplies in hardware IM2 mode */
  vector: number;
  /** The handler word, shown when an IM 2 acknowledge would use it */
  handler?: number;
  /** The handler word is $0000 or $FFFF while the source can fire */
  handlerSuspect: boolean;
  /** A source in service above this one holds it */
  blocked: boolean;
  /** NextReg `$20`'s bit for this source, when the panel can Ring it */
  ringBit?: number;
  /** The `$C8`-`$CA` write that clears its status bit */
  clearWrite?: { reg: number; value: number };
};

export type IntDiagnosticId =
  | "disabled"
  | "im1"
  | "stuck"
  | "waiting"
  | "hole"
  | "polled"
  | "lost"
  | "nmiStackless";

export type IntDiagnostic = {
  id: IntDiagnosticId;
  severity: "info" | "warning" | "error";
  /** The message's arguments (source names, addresses) */
  args: Record<string, string | number>;
};

export type InterruptsModel = {
  rows: IntChainRow[];
  /** The highest-priority source in service, which holds every source below it (hardware IM2 only) */
  blocker?: number;
  /** IM 2 is where the handler words matter: the CPU in IM 2 with hardware IM2 mode on */
  usesVectorTable: boolean;
  diagnostics: IntDiagnostic[];
};

const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

/** The chain's source names for messages: hardware names, never translated */
export function sourceName(index: number): string {
  return ["Line", "UART 0 Rx", "UART 1 Rx", "CTC 0", "CTC 1", "CTC 2", "CTC 3", "CTC 4", "CTC 5", "CTC 6", "CTC 7", "ULA", "UART 0 Tx", "UART 1 Tx"][index] ?? `#${index}`;
}

/**
 * The sources whose status bit means something with the interrupt off: the CTC and the UART
 * receivers. Not the transmitters, whose status is set whenever their buffer is empty.
 */
function isPolledKind(index: number): boolean {
  return (index >= NextIntSource.Ctc0 && index <= NextIntSource.Ctc3) || index === NextIntSource.Uart0Rx || index === NextIntSource.Uart1Rx;
}

/**
 * Builds the panel's model. `recentEvents` (optional) are the ring's newest records, for the
 * "lost" diagnostic, which only the ring can see.
 */
export function buildInterruptsModel(state: NextInterruptState, recentEvents: NextIntEvent[] = []): InterruptsModel {
  const hw = state.hwIm2Mode;
  const usesVectorTable = hw && state.cpu.im === 2;
  let blocker: number | undefined;
  if (hw) {
    for (const s of state.sources) {
      if (s.inService) {
        blocker = s.index;
        break;
      }
    }
  }

  const rows: IntChainRow[] = [];
  for (let i = 0; i < NEXT_INT_SOURCE_COUNT; i++) {
    const s = state.sources[i];
    let rowState: IntRowState;
    if (isReservedIntSource(i)) rowState = "none";
    else if (!hw) rowState = s.status ? "statusSet" : "idle";
    else if (s.inService) rowState = "inService";
    else if (s.pending) rowState = "requesting";
    else rowState = "idle";
    const handlerSuspect = usesVectorTable && s.enabled && !isReservedIntSource(i) && (s.handler === 0x0000 || s.handler === 0xffff);
    rows.push({
      index: i,
      enabled: s.enabled,
      status: s.status,
      state: rowState,
      vector: vectorOf(state.vectorBase, i),
      handler: usesVectorTable && !isReservedIntSource(i) ? s.handler : undefined,
      handlerSuspect,
      blocked: blocker !== undefined && i > blocker,
      ringBit: nextReg20BitOf(i),
      clearWrite: isReservedIntSource(i) ? undefined : statusClearWriteOf(i)
    });
  }

  const diagnostics: IntDiagnostic[] = [];

  // --- D-STUCK: more sources in service than interrupt frames on the Call Stack
  const inService = state.sources.filter(s => s.inService);
  if (hw && inService.length > state.interruptDepth) {
    const stuck = inService[inService.length - 1 - state.interruptDepth] ?? inService[0];
    diagnostics.push({ id: "stuck", severity: "error", args: { source: sourceName(stuck.index) } });
  }

  // --- D-DI: interrupts disabled while sources wait (a handler that returned without EI, or a DI
  // --- that was never undone). Only in hardware IM2 mode can the panel see who waits.
  if (hw && !state.cpu.iff1 && state.interruptDepth === 0) {
    const waiting = state.sources.filter((s) => s.pending && !s.inService);
    if (waiting.length > 0) {
      diagnostics.push({
        id: "disabled",
        severity: "warning",
        args: { count: waiting.length, sources: waiting.map((s) => sourceName(s.index)).join(", ") }
      });
    }
  }

  // --- D-IM1: hardware IM2 mode with the CPU outside IM 2 and somebody requesting
  if (hw && state.cpu.im !== 2) {
    const waiting = state.sources.filter(s => s.pending && !s.inService && s.index !== NextIntSource.Ula);
    if (waiting.length > 0 || state.sources.some(s => s.enabled && s.index !== NextIntSource.Ula && !isReservedIntSource(s.index))) {
      diagnostics.push({ id: "im1", severity: "warning", args: { im: state.cpu.im, count: waiting.length } });
    }
  }

  // --- D-WAIT: requesting behind the blocker
  if (blocker !== undefined) {
    for (const s of state.sources) {
      if (s.index > blocker && s.pending && !s.inService) {
        diagnostics.push({
          id: "waiting",
          severity: "info",
          args: { source: sourceName(s.index), blocker: sourceName(blocker) }
        });
      }
    }
  }

  // --- D-HOLE: an empty vector table entry for a source that can fire
  for (const r of rows) {
    if (r.handlerSuspect) {
      diagnostics.push({
        id: "hole",
        severity: "error",
        args: {
          source: sourceName(r.index),
          address: hex4(state.cpu.i * 256 + r.vector),
          handler: hex4(r.handler ?? 0)
        }
      });
    }
  }

  // --- D-POLL: status set with the interrupt off (the CTC and the UARTs latch it anyway)
  const polled = state.sources.filter(s => isPolledKind(s.index) && s.status && !s.enabled).map(s => sourceName(s.index));
  if (polled.length > 0) {
    diagnostics.push({ id: "polled", severity: "info", args: { sources: polled.join(", "), count: polled.length } });
  }

  // --- D-LOST: the ring saw a pulse end untaken in the newest frame it holds
  const lost = lastFrameLost(recentEvents);
  if (lost) {
    diagnostics.push({ id: "lost", severity: "warning", args: { source: sourceName(lost.source), frame: lost.frame } });
  }

  // --- D-NMI: a stackless NMI is in progress
  if (state.nmi.stacklessArmed) {
    diagnostics.push({ id: "nmiStackless", severity: "info", args: { address: hex4(state.nmi.returnAddress) } });
  }

  return { rows, blocker, usesVectorTable, diagnostics };
}

function lastFrameLost(events: NextIntEvent[]): NextIntEvent | undefined {
  if (events.length === 0) return undefined;
  const lastFrame = events[events.length - 1].frame;
  for (let i = events.length - 1; i >= 0 && events[i].frame >= lastFrame - 1; i--) {
    if (events[i].kind === NextIntEventKind.Lost) return events[i];
  }
  return undefined;
}

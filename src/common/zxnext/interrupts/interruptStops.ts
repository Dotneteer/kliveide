import {
  NEXT_INT_SOURCE_IDS,
  NEXT_INT_SOURCE_NAMES,
  NEXT_INT_SRC_NMI_DIVMMC,
  NEXT_INT_SRC_NMI_MULTIFACE,
  NextIntEventKind,
  isReservedIntSource,
  type NextIntEvent
} from "./interruptState";

/**
 * Interrupt stops (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §5): breakpoints bound to an
 * interrupt event instead of an address, written `int:<kind>[:<argument>]`:
 *
 * | Spec | Stops when |
 * |---|---|
 * | `int:ack`, `int:ack:<source>` | the CPU takes an interrupt (from that source) |
 * | `int:lost`, `int:lost:<source>` | a pulse-mode interrupt ends before the CPU takes it |
 * | `int:retn` | a RETN executes while a maskable source is in service (hardware IM2 mode) |
 * | `int:reti` | a RETI executes outside IM 2 while a source is in service: nothing is released |
 * | `int:wait:<T>`, `int:wait:<T>:<source>` | a request waits longer than T T-states |
 * | `int:nmi`, `int:nmi:multiface`, `int:nmi:divmmc` | the CPU takes an NMI |
 *
 * Sources are the chain's ids (`line`, `uart0rx`, `uart1rx`, `ctc0`-`ctc3`, `ula`, `uart0tx`,
 * `uart1tx`). The normalized spec (lower case, no `int:`) is stored in `BreakpointInfo.interruptStop`
 * and is the breakpoint's identity.
 */

export type InterruptStopKind = "ack" | "lost" | "retn" | "reti" | "wait" | "nmi";

export type InterruptStop = {
  kind: InterruptStopKind;
  /** The chain source for ack/lost/wait, when the stop is narrowed to one */
  source?: number;
  /** The NMI device for nmi, when narrowed */
  nmiDevice?: "multiface" | "divmmc";
  /** The wait limit in T-states, for wait */
  waitLimit?: number;
};

export type InterruptStopParseError =
  | "kind"
  | "source"
  | "nmiDevice"
  | "waitLimit"
  | "extra";

const KINDS: InterruptStopKind[] = ["ack", "lost", "retn", "reti", "wait", "nmi"];

/** The chain sources a stop may name: not the reserved CTC 4-7 */
export function stopSourceIndex(id: string): number | undefined {
  const index = (NEXT_INT_SOURCE_IDS as readonly string[]).indexOf(id.toLowerCase());
  return index >= 0 && !isReservedIntSource(index) ? index : undefined;
}

/** The ids a stop may name, for help texts */
export function stopSourceIds(): string[] {
  return NEXT_INT_SOURCE_IDS.filter((_, i) => !isReservedIntSource(i));
}

/**
 * Parses the part after `int:` (`ack:ula`, `wait:300`, ...). Numbers take `$` hex and plain decimal.
 */
export function parseInterruptStop(spec: string): InterruptStop | { error: InterruptStopParseError } {
  const parts = spec.trim().toLowerCase().split(":");
  const kind = parts[0] as InterruptStopKind;
  if (!KINDS.includes(kind)) return { error: "kind" };
  const rest = parts.slice(1);
  switch (kind) {
    case "retn":
    case "reti":
      return rest.length === 0 ? { kind } : { error: "extra" };
    case "ack":
    case "lost": {
      if (rest.length === 0) return { kind };
      if (rest.length > 1) return { error: "extra" };
      const source = stopSourceIndex(rest[0]);
      return source === undefined ? { error: "source" } : { kind, source };
    }
    case "nmi": {
      if (rest.length === 0) return { kind };
      if (rest.length > 1) return { error: "extra" };
      return rest[0] === "multiface" || rest[0] === "divmmc" ? { kind, nmiDevice: rest[0] } : { error: "nmiDevice" };
    }
    case "wait": {
      if (rest.length === 0 || rest.length > 2) return rest.length === 0 ? { error: "waitLimit" } : { error: "extra" };
      const text = rest[0];
      const limit = text.startsWith("$") ? parseInt(text.slice(1), 16) : /^\d+$/.test(text) ? parseInt(text, 10) : NaN;
      if (!Number.isFinite(limit) || limit < 1 || limit > 0xffffff) return { error: "waitLimit" };
      if (rest.length === 1) return { kind, waitLimit: limit };
      const source = stopSourceIndex(rest[1]);
      return source === undefined ? { error: "source" } : { kind, waitLimit: limit, source };
    }
  }
  return { error: "kind" };
}

/** The normalized spec stored in `BreakpointInfo.interruptStop` (no `int:` prefix) */
export function formatInterruptStop(stop: InterruptStop): string {
  const src = stop.source !== undefined ? NEXT_INT_SOURCE_IDS[stop.source] : undefined;
  switch (stop.kind) {
    case "ack":
    case "lost":
      return src ? `${stop.kind}:${src}` : stop.kind;
    case "wait":
      return src ? `wait:${stop.waitLimit}:${src}` : `wait:${stop.waitLimit}`;
    case "nmi":
      return stop.nmiDevice ? `nmi:${stop.nmiDevice}` : "nmi";
    default:
      return stop.kind;
  }
}

/** Parses a stored spec; undefined when it no longer parses (never stops) */
export function interruptStopOf(spec: string | undefined): InterruptStop | undefined {
  if (spec === undefined) return undefined;
  const parsed = parseInterruptStop(spec);
  return "error" in parsed ? undefined : parsed;
}

const KIND_EVENT: Record<InterruptStopKind, number> = {
  ack: NextIntEventKind.Acknowledge,
  lost: NextIntEventKind.Lost,
  retn: NextIntEventKind.RetnInService,
  reti: NextIntEventKind.RetiIgnored,
  wait: NextIntEventKind.Wait,
  nmi: NextIntEventKind.Nmi
};

/** The core's watch (`zxnextSetIntWatch`) for a set of stops: kinds, ACK sources, NMI devices, WAIT limit */
export type InterruptWatch = { kinds: number; ackSources: number; nmiSources: number; waitLimit: number };

/**
 * The watch to arm for these stops. Exact for ACK sources and NMI devices; for WAIT the core uses the
 * smallest limit and `matchesInterruptStop` applies each stop's own. 0 kinds disarms.
 */
export function buildInterruptWatch(stops: InterruptStop[]): InterruptWatch {
  let kinds = 0;
  let ackSources = 0;
  let nmiSources = 0;
  let waitLimit = 0;
  for (const s of stops) {
    kinds |= 1 << KIND_EVENT[s.kind];
    if (s.kind === "ack") ackSources |= s.source === undefined ? 0x3fff : 1 << s.source;
    if (s.kind === "nmi") nmiSources |= s.nmiDevice === "multiface" ? 0x01 : s.nmiDevice === "divmmc" ? 0x02 : 0x07;
    if (s.kind === "wait" && s.waitLimit !== undefined) {
      waitLimit = waitLimit === 0 ? s.waitLimit : Math.min(waitLimit, s.waitLimit);
    }
  }
  return { kinds, ackSources, nmiSources, waitLimit };
}

/**
 * Does this event satisfy this stop? `waitedT` is how long a WAIT event's request has waited (the
 * core reports it once it passes the smallest limit; a stop with a larger one waits for a later run
 * of the same request, which it never sees - so a WAIT stop compares at the limit the core used).
 */
export function matchesInterruptStop(stop: InterruptStop, e: NextIntEvent, coreWaitLimit = 0): boolean {
  if (e.kind !== KIND_EVENT[stop.kind]) return false;
  switch (stop.kind) {
    case "ack":
    case "lost":
      return stop.source === undefined || stop.source === e.source;
    case "wait":
      return (stop.source === undefined || stop.source === e.source) && (stop.waitLimit ?? 0) <= Math.max(coreWaitLimit, 1);
    case "nmi":
      return (
        stop.nmiDevice === undefined ||
        (stop.nmiDevice === "multiface" && e.source === NEXT_INT_SRC_NMI_MULTIFACE) ||
        (stop.nmiDevice === "divmmc" && e.source === NEXT_INT_SRC_NMI_DIVMMC)
      );
    default:
      return true;
  }
}

/** The breakpoint key's argument part, upper case (`ACK:ULA`) */
export function interruptStopKeyPart(spec: string): string {
  return spec.toUpperCase();
}

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;
const hex4 = (v: number) => `$${(v & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;

/**
 * The Emulator output's line for an interrupt stop. English, like every stop message (output is not
 * translated).
 */
export function describeInterruptStop(
  e: NextIntEvent & { partition?: number },
  partitionLabels?: Record<number, string>
): string {
  const name = interruptEventSourceName(e);
  const paged = e.partition === undefined ? "" : ` in ${partitionLabels?.[e.partition] ?? e.partition}`;
  const site = `${hex4(e.pc)}${paged}`;
  switch (e.kind) {
    case NextIntEventKind.Acknowledge:
      return e.vector !== 0xff
        ? `Interrupt stop: ${name} taken (vector ${hex2(e.vector)}), interrupting ${site}`
        : `Interrupt stop: ${name} taken (pulse mode), interrupting ${site}`;
    case NextIntEventKind.Lost:
      return `Interrupt stop: ${name}'s pulse ended before the CPU took it (interrupts disabled), at ${site}`;
    case NextIntEventKind.RetnInService:
      return `Interrupt stop: RETN at ${site} while ${name} is in service - nothing is released, only RETI ends the service`;
    case NextIntEventKind.RetiIgnored:
      return `Interrupt stop: RETI at ${site} outside IM 2 while ${name} is in service - nothing is released`;
    case NextIntEventKind.Wait:
      return `Interrupt stop: ${name}'s request is still waiting, at ${site}`;
    case NextIntEventKind.Nmi:
      return `Interrupt stop: ${name} NMI taken, interrupting ${site}`;
    default:
      return `Interrupt stop at ${site}`;
  }
}

/** The event's source as a name: a chain source, an NMI device, or `?` */
export function interruptEventSourceName(e: NextIntEvent): string {
  if (e.source === NEXT_INT_SRC_NMI_MULTIFACE) return "Multiface";
  if (e.source === NEXT_INT_SRC_NMI_DIVMMC) return "DivMMC";
  return NEXT_INT_SOURCE_NAMES[e.source] ?? "?";
}

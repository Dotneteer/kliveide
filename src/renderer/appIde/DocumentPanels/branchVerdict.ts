import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";
import type {
  DisassemblyBranchCondition,
  DisassemblyBranchInfo,
  DisassemblyBranchKind
} from "../disassemblers/common-types";

/**
 * Deciding, from a CPU snapshot, whether a branching instruction will jump.
 *
 * Pure: no React, no IPC, no clock. Everything it needs arrives in `BranchCpuSnapshot`, which the
 * disassembly panel already has in hand — `getMemoryContents` returns the registers alongside the
 * memory image, so nothing here costs an extra round-trip.
 *
 * The one rule that governs the whole module: **a debugger view is read-only.** Where producing an
 * address would require the machine to do something it would not otherwise have done, this reports
 * the destination as unobtainable instead of producing a number. See `BranchVerdict.unobtainable`.
 */

/**
 * The CPU registers a branch verdict can depend on.
 *
 * A deliberately narrow slice of the machine state rather than the whole `Z80CpuState`, so that a
 * caller cannot accidentally hand this module something it should not be reading — most pointedly,
 * there is no way to reach an I/O port from here. See `"io-port"` in `unobtainable`.
 */
export type BranchCpuSnapshot = {
  /** Flags live in the low byte; the high byte (A) is never consulted. */
  af: number;
  /** `DJNZ` tests `B`, the high byte. */
  bc: number;
  hl: number;
  ix: number;
  iy: number;
  sp: number;
  pc: number;
  /**
   * Reads one byte of the memory image currently on display, or `undefined` where that address is
   * not part of it.
   *
   * Optional because the panel cannot always supply one: in the banked view the image is a single
   * partition, and `SP` generally points outside it. Absent means "the stack cannot be read", which
   * is a distinct outcome from "the stack says X" — see `"stack-unreadable"`.
   */
  readByte?: (address: number) => number | undefined;
};

/**
 * Why a destination could not be produced.
 *
 * Distinct from simply not resolving one. A `RET cc` away from PC has no address shown because the
 * stack top would not mean anything there (see `evaluateBranch`'s `atPc`), which is a decision, not
 * a failure. These two are failures of a kind the UI must name out loud:
 *
 * - `"io-port"` — Z80N `JP (C)`. Its destination is `(PC & $C000) | (readPort(BC) << 6)`, and the
 *   low bits come from a live I/O read. The value is in no register, and fetching it would mean
 *   performing that read, whose side effects — interrupt acknowledgement, FIFO advance, device
 *   state — would disturb the execution being debugged. Never resolved, on any row, ever.
 * - `"stack-unreadable"` — a return whose stack top is outside the displayed memory image.
 */
export type BranchUnobtainableReason = "io-port" | "stack-unreadable";

/**
 * Which way the flow leaves this instruction. Drives the gutter glyph.
 *
 * There is deliberately no `"indirect"` member. `JP (HL)`/`(IX)`/`(IY)` resolve to a real address,
 * so they are `"back"` or `"forward"` like any other jump — the register they came from is an
 * implementation detail of finding the address, not a third kind of movement, and giving them their
 * own value would only force the UI to translate it back.
 */
export type BranchDirection =
  /** Taken, to an address at or below this one — a loop closing. */
  | "back"
  /** Taken, to an address ahead. */
  | "forward"
  /** Taken, leaving through the stack. */
  | "return"
  /** Taken, but the destination is unobtainable. */
  | "unknown"
  /** Not taken: execution carries straight on. */
  | "none";

export type BranchVerdict = {
  /**
   * What kind of branch this is, carried through from the disassembler.
   *
   * The readout needs it because *direction alone does not say what happened*. `RST $08` and
   * `CALL $0008` both leave for a lower address, but neither jumps there — they are calls, and the
   * CPU will come back. Describing them as jumps is simply wrong, and was.
   */
  kind: DisassemblyBranchKind;
  /** Whether the branch will be taken. Always true for an unconditional one. */
  taken: boolean;
  /**
   * The condition as the assembler spells it (`"NZ"`), or `"B≠0"` for `DJNZ`.
   *
   * Absent on an unconditional branch, which is how a caller tells "always jumps" from "jumps
   * because the flag happens to hold".
   */
  conditionText?: string;
  /** What decided it: `"Z=0"`, `"S=1"`, or `"B $A4→$A3"`. Absent when unconditional. */
  reasonText?: string;
  /**
   * The address the CPU will execute next.
   *
   * Absent when the destination is unobtainable, and when a `RET` is not at PC — in that second
   * case `unobtainable` is *not* set, because nothing failed.
   */
  nextAddress?: number;
  /** Set only where the destination genuinely cannot be produced. */
  unobtainable?: BranchUnobtainableReason;
  direction: BranchDirection;
  /** T-states this instruction will actually spend, given the verdict. */
  tstates: number;
};

/** Tests one condition code against the F register. */
function testCondition(condition: DisassemblyBranchCondition, f: number): boolean {
  switch (condition) {
    case "nz":
      return (f & FlagsSetMask.Z) === 0;
    case "z":
      return (f & FlagsSetMask.Z) !== 0;
    case "nc":
      return (f & FlagsSetMask.C) === 0;
    case "c":
      return (f & FlagsSetMask.C) !== 0;
    case "po":
      return (f & FlagsSetMask.PV) === 0;
    case "pe":
      return (f & FlagsSetMask.PV) !== 0;
    case "p":
      return (f & FlagsSetMask.S) === 0;
    case "m":
      return (f & FlagsSetMask.S) !== 0;
  }
}

/** The flag a condition reads, and its current value — `"Z=0"`. */
function describeCondition(condition: DisassemblyBranchCondition, f: number): string {
  switch (condition) {
    case "nz":
    case "z":
      return `Z=${(f & FlagsSetMask.Z) !== 0 ? 1 : 0}`;
    case "nc":
    case "c":
      return `C=${(f & FlagsSetMask.C) !== 0 ? 1 : 0}`;
    case "po":
    case "pe":
      return `P/V=${(f & FlagsSetMask.PV) !== 0 ? 1 : 0}`;
    case "p":
    case "m":
      return `S=${(f & FlagsSetMask.S) !== 0 ? 1 : 0}`;
  }
}

/**
 * Whether this kind of branch pushes a return address, so the CPU will come back.
 *
 * `RST n` is exactly `CALL n` in a one-byte encoding, which is why the two are grouped rather than
 * `rst` being treated as a jump to a low address.
 *
 * Exported so the row's glyph and this module's wording are decided by the same rule; they were
 * two separate judgements once, and that is how `rst $08` came to say "jumps back".
 */
export function isCall(kind: DisassemblyBranchKind): boolean {
  return kind === "call" || kind === "rst";
}

function toHex2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

/** Reads a little-endian word through the snapshot's reader, or `undefined` if it cannot. */
function readWord(cpu: BranchCpuSnapshot, address: number): number | undefined {
  if (!cpu.readByte) return undefined;
  const low = cpu.readByte(address & 0xffff);
  const high = cpu.readByte((address + 1) & 0xffff);
  if (low === undefined || high === undefined) return undefined;
  return (low | (high << 8)) & 0xffff;
}

/**
 * Works out what a branching instruction will do next, given the current CPU state.
 *
 * @param branch The instruction's control-flow metadata, from the disassembler
 * @param address The instruction's own address
 * @param byteLength How many bytes the instruction occupies, for the fall-through address
 * @param cpu The register snapshot to judge against
 * @param atPc Whether this instruction is the one PC is sitting on. Governs whether the stack is
 * consulted for a return: away from PC the stack top is not the return address this instruction
 * would use, so it is not shown rather than shown wrongly.
 */
export function evaluateBranch(
  branch: DisassemblyBranchInfo,
  address: number,
  byteLength: number,
  cpu: BranchCpuSnapshot,
  atPc: boolean
): BranchVerdict {
  const fallThrough = (address + byteLength) & 0xffff;
  const f = cpu.af & 0xff;

  // --- Decide whether it is taken, and say why.
  let taken: boolean;
  let conditionText: string | undefined;
  let reasonText: string | undefined;

  if (branch.kind === "djnz") {
    // --- DJNZ decrements B first, then jumps while it is non-zero. B = 0 therefore *jumps*
    // --- (0 wraps to 255), which is the 256-iteration idiom and the case worth getting right.
    const b = (cpu.bc >>> 8) & 0xff;
    const decremented = (b - 1) & 0xff;
    taken = decremented !== 0;
    conditionText = "B≠0";
    reasonText = `B $${toHex2(b)}→$${toHex2(decremented)}`;
  } else if (branch.condition) {
    taken = testCondition(branch.condition, f);
    conditionText = branch.condition.toUpperCase();
    reasonText = describeCondition(branch.condition, f);
  } else {
    taken = true;
  }

  const tstates = taken ? branch.tstatesTaken : branch.tstatesNotTaken;

  // --- Not taken: execution simply carries on, and none of the destination logic applies.
  if (!taken) {
    return {
      kind: branch.kind,
      taken,
      conditionText,
      reasonText,
      nextAddress: fallThrough,
      direction: "none",
      tstates
    };
  }

  // --- Taken. Find where it goes, or say why that cannot be done.
  const base = { kind: branch.kind, taken, conditionText, reasonText, tstates };

  if (branch.target !== undefined) {
    const target = branch.target & 0xffff;
    return { ...base, nextAddress: target, direction: target <= address ? "back" : "forward" };
  }

  switch (branch.targetSource) {
    case "hl":
    case "ix":
    case "iy": {
      const target =
        (branch.targetSource === "hl" ? cpu.hl : branch.targetSource === "ix" ? cpu.ix : cpu.iy) &
        0xffff;
      return { ...base, nextAddress: target, direction: target <= address ? "back" : "forward" };
    }

    case "io-port":
      // --- Z80N `JP (C)`. Not "we did not bother": there is nothing to read, and reading it would
      // --- change the machine. Note there is no port accessor on `BranchCpuSnapshot` to reach for.
      return { ...base, unobtainable: "io-port", direction: "unknown" };

    case "stack": {
      // --- Decision 7: the stack top is only the return address this instruction would use while
      // --- PC is actually here. On any other row it belongs to whatever is executing now, so
      // --- showing it would be a confident lie. No address, and nothing failed.
      if (!atPc) {
        return { ...base, direction: "return" };
      }
      const target = readWord(cpu, cpu.sp);
      if (target === undefined) {
        return { ...base, unobtainable: "stack-unreadable", direction: "return" };
      }
      return { ...base, nextAddress: target, direction: "return" };
    }

    default:
      // --- A branch with neither a literal target nor a source: not reachable from the current
      // --- table, but a new entry could introduce it, and guessing would be worse than saying so.
      return { ...base, unobtainable: "stack-unreadable", direction: "unknown" };
  }
}

/**
 * One rendering of a verdict, split so the row can paint the two halves differently.
 *
 * `head` is the outcome — the verb and the address — and is the part the eye should land on;
 * `detail` is the supporting evidence. `text` is the two joined, for a tooltip or a test.
 */
export type BranchReadoutForm = {
  head: string;
  detail: string;
  text: string;
};

/**
 * The two renderings of a verdict shown on the execution-point row.
 *
 * Both are produced together, by one function, because a panel narrow enough to swap between them
 * is exactly where nobody would notice the two had drifted apart.
 */
export type BranchReadout = {
  /** Prose, for a panel with room: `jumps back to $0EFD  ·  NC met (C=0)  ·  12 T`. */
  long: BranchReadoutForm;
  /** Notation, for a panel without: `→ $0EFD  C=0  12T`. */
  short: BranchReadoutForm;
};

/**
 * Renders the execution-point readout for a verdict.
 *
 * Addresses are shown as numbers rather than as the listing's `L0EFD` labels. The label is already
 * in the instruction column two cells to the left, so repeating it says nothing new — whereas the
 * number is what the label stands for, and a fall-through address never has a label at all. Showing
 * one of each would be worse than showing neither.
 *
 * @param verdict The verdict to describe
 * @param decimalView Whether the panel is showing decimal values, so the readout matches the
 * columns beside it rather than contradicting them
 */
export function formatBranchReadout(verdict: BranchVerdict, decimalView: boolean): BranchReadout {
  const addr = (value: number) =>
    decimalView
      ? value.toString(10).padStart(5, "0")
      : `$${value.toString(16).toUpperCase().padStart(4, "0")}`;

  // --- "NC met (C=0)", or nothing at all where the branch is unconditional.
  const because = verdict.conditionText
    ? `${verdict.conditionText} ${verdict.taken ? "met" : "not met"}` +
      (verdict.reasonText ? ` (${verdict.reasonText})` : "")
    : "";

  const form = (head: string, parts: string[], separator: string): BranchReadoutForm => {
    const detail = parts.filter(Boolean).join(separator);
    return { head, detail, text: detail ? `${head}${separator}${detail}` : head };
  };
  const longForm = (head: string) => form(head, [because, `${verdict.tstates} T`], "  ·  ");
  const shortForm = (head: string) =>
    form(head, [verdict.reasonText ?? "", `${verdict.tstates}T`], "  ");

  if (verdict.unobtainable) {
    /*
     * Say *why* there is no address, not merely that there is none.
     *
     * "destination unknown" invites the reader to suspect the debugger. Naming the port says the
     * machine genuinely has not decided yet, which is the truth: the low bits of a `JP (C)` target
     * come from an I/O read that has not happened, and performing it here would disturb the very
     * execution being debugged.
     */
    const why =
      verdict.unobtainable === "io-port"
        ? "destination is read from port BC as it executes"
        : "the stack is outside the memory on display";
    const verb = isCall(verdict.kind) ? "calls" : verdict.direction === "return" ? "returns" : "jumps";
    return { long: longForm(`${verb} — ${why}`), short: shortForm("→ ?") };
  }

  if (!verdict.taken) {
    const to = addr(verdict.nextAddress ?? 0);
    return { long: longForm(`falls through to ${to}`), short: shortForm(`↓ ${to}`) };
  }

  const to = addr(verdict.nextAddress ?? 0);
  if (verdict.direction === "return") {
    return { long: longForm(`returns to ${to}`), short: shortForm(`→ ${to}`) };
  }

  /*
   * A call is not a jump, and saying so was a real error: `RST $08` reported "jumps back to $0008".
   * `RST n` is `CALL n` with a one-byte encoding — it pushes a return address and the CPU comes
   * back — so both take the verb "calls", and neither takes a direction word. "jumps back" carries
   * the sense of a loop closing, which is exactly what a call to a low vector is not.
   */
  if (isCall(verdict.kind)) {
    return { long: longForm(`calls ${to}`), short: shortForm(`→ ${to}`) };
  }

  const way = verdict.direction === "back" ? "back" : "forward";
  return { long: longForm(`jumps ${way} to ${to}`), short: shortForm(`→ ${to}`) };
}

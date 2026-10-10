import { z80InstructionLength } from "@common/profile/z80InstructionLength";
import { PF_CODE, PF_READ, PF_WRITTEN } from "@common/profile/profileTypes";
import {
  getZ80BranchInfo,
  type Z80BranchPrefix
} from "@renderer/appIde/disassemblers/z80-disassembler/z80-branch-info";

/*
 * Static reachability from code that was seen to run (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md`
 * §4.4, phase D2).
 *
 * A worklist walk over one bank as it is paged into the 64K view. It follows `JP`, `JR`, `CALL`,
 * `RST` and `DJNZ` targets and the fall-through of conditional branches, `CALL` and `RST`, using the
 * disassembler's branch table and the instruction-length table — no text formatting.
 *
 * It stops:
 * - after an unconditional `JP`/`JR`/`RET`/`RETI`/`RETN`/`JP (rr)`;
 * - at a byte observed as data (read or written, never fetched as code) — the conflict is reported;
 * - at an address outside the bank (another slot, another bank);
 * - at an instruction that runs off the end of the bank.
 *
 * `JP (HL)` and friends add nothing statically: their observed targets are already instruction
 * starts in the coverage, so their code is found anyway. It does not simulate registers (out of
 * scope, §0).
 */

export type ReachInput = {
  /** The bank's 16K. */
  bytes: Uint8Array;
  /** The bank's coverage flags, the same length; absent bytes mean "no evidence". */
  flags?: Uint8Array;
  /** The Next's extended set. */
  z80n: boolean;
  /** Bank offsets to start from: observed starts, callees, labels, the entry point. */
  seeds: Iterable<number>;
  /**
   * The bank offset a Z80 address reaches, under the paging the walk assumes, or `undefined` for an
   * address in another bank or slot.
   */
  bankOffsetOf: (address: number) => number | undefined;
  /** The Z80 address a bank offset is listed at. */
  addressOf: (offset: number) => number;
  /**
   * An instruction's length where the machine's custom disassembler knows better than the table:
   * `RST 08` / `RST 28` with inline bytes on the 48K ROM. `undefined` uses the table.
   */
  instructionLength?: (bytes: Uint8Array, offset: number) => number | undefined;
};

export type ReachResult = {
  /** 1 for every byte of every reached instruction. */
  reached: Uint8Array;
  /** The bank offsets of reached instruction starts. */
  starts: Set<number>;
  /** Bank offsets where the walk met data, or landed inside another instruction (D-T4). */
  conflicts: { offset: number; kind: "data" | "overlap" }[];
};

/** The branch metadata of the instruction at `offset`, with its prefix. */
function branchAt(bytes: Uint8Array, offset: number) {
  const op = bytes[offset];
  let prefix: Z80BranchPrefix = "none";
  let opcode = op;
  let operandAt = offset + 1;
  if (op === 0xed) {
    prefix = "ed";
    opcode = bytes[offset + 1];
    operandAt = offset + 2;
  } else if (op === 0xdd || op === 0xfd) {
    prefix = op === 0xdd ? "ix" : "iy";
    opcode = bytes[offset + 1];
    operandAt = offset + 2;
  }
  return { info: getZ80BranchInfo(prefix, opcode), operandAt };
}

export function reachBank(input: ReachInput): ReachResult {
  const { bytes, flags } = input;
  const size = bytes.length;
  const reached = new Uint8Array(size);
  const starts = new Set<number>();
  const conflicts: ReachResult["conflicts"] = [];
  const conflictAt = new Set<string>();
  const addConflict = (offset: number, kind: "data" | "overlap") => {
    const key = `${offset}:${kind}`;
    if (conflictAt.has(key)) return;
    conflictAt.add(key);
    conflicts.push({ offset, kind });
  };
  const isObservedData = (offset: number) => {
    const f = flags?.[offset] ?? 0;
    return (f & (PF_READ | PF_WRITTEN)) !== 0 && (f & PF_CODE) === 0;
  };
  const lengthAt = (offset: number) =>
    input.instructionLength?.(bytes, offset) ?? z80InstructionLength(bytes, offset, input.z80n);

  const work: number[] = [];
  for (const seed of input.seeds) {
    if (Number.isInteger(seed) && seed >= 0 && seed < size) work.push(seed);
  }

  while (work.length > 0) {
    let offset = work.pop()!;
    while (offset >= 0 && offset < size) {
      if (starts.has(offset)) break;
      if (isObservedData(offset)) {
        addConflict(offset, "data");
        break;
      }
      if (reached[offset]) {
        // --- Inside an instruction already reached: two decodings of one byte
        addConflict(offset, "overlap");
        break;
      }
      const length = lengthAt(offset);
      if (offset + length > size) break;
      let blocked = false;
      for (let i = 1; i < length; i++) {
        if (isObservedData(offset + i)) {
          addConflict(offset + i, "data");
          blocked = true;
          break;
        }
      }
      if (blocked) break;
      starts.add(offset);
      for (let i = 0; i < length; i++) reached[offset + i] = 1;

      const { info, operandAt } = branchAt(bytes, offset);
      let fallThrough = true;
      if (info) {
        let target: number | undefined;
        switch (info.kind) {
          case "jp":
          case "call":
            target = bytes[operandAt] | (bytes[operandAt + 1] << 8);
            break;
          case "jr":
          case "djnz": {
            const displacement = bytes[operandAt];
            target = (input.addressOf(offset) + length + ((displacement << 24) >> 24)) & 0xffff;
            break;
          }
          case "rst":
            target = info.target;
            break;
        }
        if (target !== undefined) {
          const targetOffset = input.bankOffsetOf(target);
          if (targetOffset !== undefined) work.push(targetOffset);
        }
        const conditional = info.condition !== undefined || info.kind === "djnz";
        if (!conditional && (info.kind === "jp" || info.kind === "jr" || info.kind === "ret" || info.kind === "jp-indirect")) {
          fallThrough = false;
        }
      }
      if (!fallThrough) break;
      offset += length;
    }
  }
  return { reached, starts, conflicts };
}

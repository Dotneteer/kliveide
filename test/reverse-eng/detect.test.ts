import { describe, expect, it } from "vitest";
import { classifyBank } from "@common/reverse/classify";
import { reachBank } from "@common/reverse/reach";
import { applyProposals, proposeForBank } from "@common/reverse/proposal";
import { PF_CODE, PF_EXECUTED, PF_READ, PF_SELF_MODIFIED, PF_WRITTEN } from "@common/profile/profileTypes";
import type { BankAnnotation, ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";

/*
 * Code/data auto-detection (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §4, D1/D2) on synthetic
 * flag arrays.
 */

const SIZE = 0x40;
const bank = (patch: (flags: Uint8Array, bytes: Uint8Array) => void) => {
  const flags = new Uint8Array(SIZE);
  const bytes = new Uint8Array(SIZE);
  patch(flags, bytes);
  return { flags, bytes };
};
/** Flag an executed instruction: its first byte executed, all of it code. */
const exec = (flags: Uint8Array, at: number, length: number) => {
  flags[at] |= PF_EXECUTED;
  for (let i = 0; i < length; i++) flags[at + i] |= PF_CODE;
};
const shape = (runs: ReturnType<typeof classifyBank>["runs"]) =>
  runs.map((r) => [r.start, r.end, r.class, r.evidence, r.proposedType ?? "-", ...(r.notes ?? [])]);

describe("classifyBank", () => {
  it("covers operand bytes and builds observed runs (D-T1)", () => {
    const { flags, bytes } = bank((f, b) => {
      b.set([0x3e, 0x05, 0x21, 0x00, 0x80, 0xc9], 0);
      exec(f, 0, 2);
      exec(f, 2, 3);
      exec(f, 5, 1);
      f[8] = PF_READ;
      f[9] = PF_READ;
    });
    expect(shape(classifyBank({ flags, bytes, z80n: false }).runs)).toEqual([
      [0, 5, "code", "observed", "disassemble"],
      [6, 7, "unknown", "observed", "-"],
      [8, 9, "data", "observed", "bytes"],
      [10, SIZE - 1, "unknown", "observed", "-"]
    ]);
  });

  it("lays down a whole instruction even when only its opcode was flagged (D-T8)", () => {
    const { flags, bytes } = bank((f, b) => {
      b.set([0x21, 0x00, 0x80], 4);
      f[4] = PF_EXECUTED;
    });
    expect(shape(classifyBank({ flags, bytes, z80n: false }).runs)[1]).toEqual([4, 6, "code", "observed", "disassemble"]);
  });

  it("lets code win over data, and notes SMC (D-T3)", () => {
    const { flags, bytes } = bank((f, b) => {
      b.set([0x3e, 0x05], 0);
      exec(f, 0, 2);
      f[1] |= PF_WRITTEN | PF_SELF_MODIFIED;
    });
    const result = classifyBank({ flags, bytes, z80n: false });
    expect(shape(result.runs)[0]).toEqual([0, 1, "code", "observed", "disassemble", "smc"]);
    expect(result.warnings.map((w) => [w.offset, w.kind])).toEqual([[1, "smc"]]);
  });

  it("warns about overlapping instructions (D-T4)", () => {
    const { flags, bytes } = bank((f, b) => {
      // --- LD BC,$3E01 hides LD A,$01 at offset 1
      b.set([0x01, 0x3e, 0x01], 0);
      exec(f, 0, 3);
      f[1] |= PF_EXECUTED;
    });
    const result = classifyBank({ flags, bytes, z80n: false });
    expect(result.warnings.map((w) => [w.offset, w.kind])).toContainEqual([1, "overlap"]);
    expect(shape(result.runs)[0]).toEqual([0, 2, "code", "observed", "disassemble"]);
  });

  it("reports operand bytes with no start in the bank (snapping)", () => {
    const { flags, bytes } = bank((f) => {
      f[0] = PF_CODE;
      f[1] = PF_CODE;
      exec(f, 2, 1);
    });
    const result = classifyBank({ flags, bytes, z80n: false });
    expect(shape(result.runs).slice(0, 2)).toEqual([
      [0, 1, "code", "observed", "bytes", "overlap"],
      [2, 2, "code", "observed", "disassemble"]
    ]);
  });

  it("proposes the screen as skip and names the stack (D-T5, D-T6)", () => {
    const { flags, bytes } = bank((f) => {
      for (let i = 0; i < 16; i++) f[i] = PF_WRITTEN;
      f[0x20] = PF_WRITTEN;
      f[0x21] = PF_READ;
    });
    const runs = classifyBank({
      flags,
      bytes,
      z80n: false,
      options: { screen: { start: 0, end: 0x1f }, stackOffset: 0x21 }
    }).runs;
    expect(shape(runs)).toEqual([
      [0, 0x1f, "data", "inferred", "skip", "screen"],
      [0x20, 0x21, "data", "observed", "bytes", "stack"],
      [0x22, SIZE - 1, "unknown", "observed", "-"]
    ]);
  });

  it("infers text and pointer tables, and marks unknown as data on request", () => {
    const { flags, bytes } = bank((f, b) => {
      b.set([1, 2, 0x48, 0x45, 0x4c, 0x4c, 0xcf, 9], 0);
      for (let i = 0; i < 8; i++) f[i] = PF_READ;
      b.set([0x00, 0x80, 0x10, 0x80, 0x20, 0x80], 0x10);
      for (let i = 0x10; i < 0x16; i++) f[i] = PF_READ;
    });
    const runs = classifyBank({
      flags,
      bytes,
      z80n: false,
      isCodePointer: (value) => value >= 0x8000,
      options: { text: true, words: true, unknown: "bytes" }
    }).runs;
    expect(shape(runs)).toEqual([
      [0, 1, "data", "observed", "bytes"],
      [2, 6, "data", "inferred", "text"],
      [7, 7, "data", "observed", "bytes"],
      [8, 0x0f, "unknown", "observed", "bytes"],
      [0x10, 0x15, "data", "inferred", "words"],
      [0x16, SIZE - 1, "unknown", "observed", "bytes"]
    ]);
  });
});

describe("reachBank", () => {
  const view = (base: number) => ({
    bankOffsetOf: (address: number) => (address >= base && address < base + SIZE ? address - base : undefined),
    addressOf: (offset: number) => base + offset
  });

  it("follows conditional branches, stops after RET and at other banks", () => {
    const bytes = new Uint8Array(SIZE);
    // --- 0: JR NZ,+3 ; 2: RET ; 3: NOP ; 5: CALL $9000 (outside) ; 8: JP $8010 ; $10: RET
    bytes.set([0x20, 0x03, 0xc9, 0x00, 0x00, 0xcd, 0x00, 0x90, 0xc3, 0x10, 0x80], 0);
    bytes[0x10] = 0xc9;
    const result = reachBank({ bytes, z80n: false, seeds: [0], ...view(0x8000) });
    expect([...result.starts].sort((a, b) => a - b)).toEqual([0, 2, 5, 8, 0x10]);
    expect(result.reached[3]).toBe(0);
    expect(result.reached[4]).toBe(0);
  });

  it("stops at observed data and reports it", () => {
    const bytes = new Uint8Array(SIZE);
    const flags = new Uint8Array(SIZE);
    flags[1] = PF_READ;
    const result = reachBank({ bytes, flags, z80n: false, seeds: [0], ...view(0) });
    expect([...result.starts]).toEqual([0]);
    expect(result.conflicts).toEqual([{ offset: 1, kind: "data" }]);
  });

  it("uses the custom length for RST 08 on the 48K ROM", () => {
    const bytes = new Uint8Array(SIZE);
    bytes.set([0xcf, 0x0b, 0x00], 0);
    const result = reachBank({
      bytes,
      z80n: false,
      seeds: [0],
      ...view(0),
      instructionLength: (b, o) => (b[o] === 0xcf ? 2 : undefined)
    });
    expect(result.starts.has(2)).toBe(true);
    expect(result.reached[1]).toBe(1);
  });

  it("feeds the classifier as reached evidence (D-T2)", () => {
    const bytes = new Uint8Array(SIZE);
    const flags = new Uint8Array(SIZE);
    bytes.set([0x28, 0x01, 0xc9, 0x3e, 0x01, 0xc9], 0);
    exec(flags, 0, 2);
    exec(flags, 2, 1);
    const reach = reachBank({ bytes, flags, z80n: false, seeds: [0], ...view(0) });
    expect(shape(classifyBank({ flags, bytes, z80n: false, reach }).runs).slice(0, 2)).toEqual([
      [0, 2, "code", "observed", "disassemble"],
      [3, 5, "code", "reached", "disassemble"]
    ]);
  });
});

describe("proposals", () => {
  const annotations = (bankAnnotation: BankAnnotation): ProgramAnnotations => ({
    schemaVersion: 3,
    machine: "sp48",
    banks: { "2": bankAnnotation }
  });
  const runs = classifyBank(
    bank((f) => {
      for (let i = 0; i < 8; i++) f[i] = PF_READ;
      exec(f, 8, 1);
    })
  ).runs;

  it("fill never touches the user's data regions", () => {
    const user: BankAnnotation = {
      offsetIndex: 2,
      regions: [
        { start: 0, end: 3, type: "words" },
        { start: 4, end: 0x3fff, type: "disassemble" }
      ]
    };
    const proposal = proposeForBank({ bank: 2, bankAnnotation: user, runs, mode: "fill" });
    expect(proposal.changes).toEqual([{ start: 4, end: 7, type: "bytes", evidence: "observed", from: "disassemble" }]);
    expect(proposal.conflicts).toEqual([{ start: 0, end: 3, type: "bytes", evidence: "observed", from: "words", user: true }]);
    const applied = applyProposals(annotations(user), [proposal], () => 2);
    expect(applied.banks["2"].regions.slice(0, 3)).toEqual([
      { start: 0, end: 3, type: "words" },
      { start: 4, end: 7, type: "bytes", origin: "auto" },
      { start: 8, end: 0x3fff, type: "disassemble" }
    ]);
  });

  it("replace lists and changes them", () => {
    const user: BankAnnotation = { offsetIndex: 2, regions: [{ start: 0, end: 0x3fff, type: "skip" }] };
    const proposal = proposeForBank({ bank: 2, bankAnnotation: user, runs, mode: "replace" });
    expect(proposal.changes.every((c) => c.user)).toBe(true);
    const applied = applyProposals(annotations(user), [proposal], () => 2);
    expect(applied.banks["2"].regions[0]).toEqual({ start: 0, end: 7, type: "bytes", origin: "auto" });
  });

  it("clear restores the gaps, and creates a missing bank on apply", () => {
    const detected = applyProposals(
      { schemaVersion: 3, machine: "sp48", banks: {} },
      [proposeForBank({ bank: 0, bankAnnotation: undefined, runs, mode: "fill" })],
      () => 3
    );
    expect(detected.banks["0"].offsetIndex).toBe(3);
    expect(detected.banks["0"].regions[0]).toEqual({ start: 0, end: 7, type: "bytes", origin: "auto" });
    const clear = proposeForBank({ bank: 0, bankAnnotation: detected.banks["0"], runs: [], mode: "clear" });
    expect(clear.changes).toHaveLength(1);
    const cleared = applyProposals(detected, [clear], () => 3);
    expect(cleared.banks["0"].regions).toEqual([{ start: 0, end: 0x3fff, type: "disassemble" }]);
  });
});

import { describe, expect, it } from "vitest";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import type { DisassemblyBranchInfo } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import {
  getZ80BranchInfo,
  z80ExtendedBranches,
  z80IndexedBranches,
  z80StandardBranches,
  type Z80BranchPrefix
} from "@renderer/appIde/disassemblers/z80-disassembler/z80-branch-info";

/**
 * Disassembles one instruction and hands back the item, so a test can compare the branch map
 * against what the instruction tables actually produce.
 *
 * Trailing zeros pad out operands: `jp nn` needs two bytes after the opcode, `jr e` one. The
 * padding is never read as a separate instruction because the memory section stops at the length
 * given, and only the first item is inspected.
 */
async function disassembleOne(opCodes: number[]) {
  const map = new MemoryMap();
  map.add(new MemorySection(0x0000, opCodes.length - 1));
  const disassembler = new Z80Disassembler(map.sections, new Uint8Array(opCodes), undefined, {
    allowExtendedSet: true
  });
  const output = await disassembler.disassemble();
  expect(output).not.toBeNull();
  return output!.outputItems[0];
}

/** Builds the byte sequence for an opcode under a given prefix, padded for its operands. */
function bytesFor(prefix: Z80BranchPrefix, opCode: number): number[] {
  const lead =
    prefix === "ed" ? [0xed] : prefix === "ix" ? [0xdd] : prefix === "iy" ? [0xfd] : [];
  return [...lead, opCode, 0x00, 0x00];
}

const CONDITIONS = ["nz", "z", "nc", "c", "po", "pe", "p", "m"] as const;

describe("z80-branch-info — structure", () => {
  it("marks DJNZ as conditional on B rather than on a flag", () => {
    const info = getZ80BranchInfo("none", 0x10);
    expect(info).toEqual<DisassemblyBranchInfo>({
      kind: "djnz",
      tstatesTaken: 13,
      tstatesNotTaken: 8
    });
    // --- The distinction matters: a consumer must not look for a flag condition here.
    expect(info!.condition).toBeUndefined();
  });

  it("covers the four JR conditions and no others", () => {
    expect(getZ80BranchInfo("none", 0x20)?.condition).toBe("nz");
    expect(getZ80BranchInfo("none", 0x28)?.condition).toBe("z");
    expect(getZ80BranchInfo("none", 0x30)?.condition).toBe("nc");
    expect(getZ80BranchInfo("none", 0x38)?.condition).toBe("c");
    // --- `jr po` and friends do not exist; those opcodes are 8-bit loads.
    expect(getZ80BranchInfo("none", 0x40)).toBeUndefined();
  });

  it.each(CONDITIONS.map((condition, index) => [condition, index] as const))(
    "places %s at the right opcode in every conditional family",
    (condition, index) => {
      const offset = index << 3;
      expect(getZ80BranchInfo("none", 0xc0 + offset)).toMatchObject({
        kind: "ret",
        condition,
        targetSource: "stack"
      });
      expect(getZ80BranchInfo("none", 0xc2 + offset)).toMatchObject({ kind: "jp", condition });
      expect(getZ80BranchInfo("none", 0xc4 + offset)).toMatchObject({ kind: "call", condition });
    }
  );

  it("gives every RST its vector, since the pragma creates no symbol for it", () => {
    for (let index = 0; index < 8; index++) {
      expect(getZ80BranchInfo("none", 0xc7 + (index << 3))).toEqual<DisassemblyBranchInfo>({
        kind: "rst",
        target: index * 8,
        tstatesTaken: 11,
        tstatesNotTaken: 11
      });
    }
  });

  it("names the register each indirect jump reads its destination from", () => {
    expect(getZ80BranchInfo("none", 0xe9)).toMatchObject({
      kind: "jp-indirect",
      targetSource: "hl"
    });
    expect(getZ80BranchInfo("ix", 0xe9)).toMatchObject({ targetSource: "ix" });
    expect(getZ80BranchInfo("iy", 0xe9)).toMatchObject({ targetSource: "iy" });
  });

  it("does not let the IY lookup mutate the shared IX entry", () => {
    getZ80BranchInfo("iy", 0xe9);
    expect(z80IndexedBranches[0xe9].targetSource).toBe("ix");
  });

  it("marks Z80N JP (C) as reading its destination from an I/O port", () => {
    // --- The one branch Z80N adds, and the one destination that can never be resolved: the low
    // --- bits come from `readPort(bc)`, and performing that read would disturb the machine.
    expect(getZ80BranchInfo("ed", 0x98)).toEqual<DisassemblyBranchInfo>({
      kind: "jp-indirect",
      targetSource: "io-port",
      tstatesTaken: 13,
      tstatesNotTaken: 13
    });
  });

  it("treats every RETN mirror as a return", () => {
    for (const opCode of [0x45, 0x4d, 0x55, 0x5d, 0x65, 0x6d, 0x75, 0x7d]) {
      expect(z80ExtendedBranches[opCode]).toMatchObject({ kind: "ret", targetSource: "stack" });
    }
  });

  it("returns undefined for an unknown prefix", () => {
    expect(getZ80BranchInfo("bogus" as Z80BranchPrefix, 0xc3)).toBeUndefined();
  });
});

describe("z80-branch-info — what must NOT be a branch", () => {
  /**
   * The block-repeat instructions are why this map exists as data rather than as a timing rule.
   * They are encoded `21/16`, exactly the two-figure shape that `CALL cc,nn` (`17/10`) has, so any
   * detector built on "has a second T-state figure" classifies them as conditional branches. They
   * repeat in place; they do not branch.
   */
  it.each([
    ["ldir", 0xb0],
    ["cpir", 0xb1],
    ["inir", 0xb2],
    ["otir", 0xb3],
    ["lddr", 0xb8],
    ["cpdr", 0xb9],
    ["indr", 0xba],
    ["otdr", 0xbb],
    ["ldirx", 0xb4],
    ["ldpirx", 0xb7],
    ["lddrx", 0xbc]
  ])("excludes %s, despite its two T-state figures", (_name, opCode) => {
    expect(getZ80BranchInfo("ed", opCode)).toBeUndefined();
  });

  it.each([
    ["nop", 0x00],
    ["ld bc,nn", 0x01],
    ["ld b,b", 0x40],
    ["add a,b", 0x80],
    ["push bc", 0xc5],
    ["ex (sp),hl", 0xe3],
    ["ld sp,hl", 0xf9]
  ])("excludes the non-branching instruction %s", (_name, opCode) => {
    expect(getZ80BranchInfo("none", opCode)).toBeUndefined();
  });
});

describe("z80-branch-info — agrees with the instruction tables", () => {
  /**
   * The map states T-states independently of the `"mnemonic|t/t2"` templates, so the two can drift.
   * This walks every entry and checks them against what the disassembler actually emits.
   *
   * The mapping is: `tstatesTaken` is the item's `tstates`, and `tstatesNotTaken` is `tstates2`
   * where the template supplies one and `tstates` where it does not — an unconditional instruction,
   * and `JP cc,nn`, which costs the same either way.
   */
  const entries: [Z80BranchPrefix, number, DisassemblyBranchInfo][] = [
    ...Object.entries(z80StandardBranches).map(
      ([op, info]) => ["none", Number(op), info] as [Z80BranchPrefix, number, DisassemblyBranchInfo]
    ),
    ...Object.entries(z80ExtendedBranches).map(
      ([op, info]) => ["ed", Number(op), info] as [Z80BranchPrefix, number, DisassemblyBranchInfo]
    ),
    ...Object.entries(z80IndexedBranches).map(
      ([op, info]) => ["ix", Number(op), info] as [Z80BranchPrefix, number, DisassemblyBranchInfo]
    )
  ];

  it.each(entries)("%s $%s timings match the disassembler", async (prefix, opCode, info) => {
    const item = await disassembleOne(bytesFor(prefix, opCode));
    expect(item.tstates).toBe(info.tstatesTaken);
    expect(item.tstates2 ? item.tstates2 : item.tstates).toBe(info.tstatesNotTaken);
  });

  it("has an entry for every instruction the tables give two timings to, except the repeats", async () => {
    // --- Walks the whole un-prefixed opcode space and asserts the map and the tables agree about
    // --- which instructions are conditional. A new conditional instruction added to the tables
    // --- without a map entry fails here.
    for (let opCode = 0; opCode < 0x100; opCode++) {
      const item = await disassembleOne([opCode, 0x00, 0x00]);
      if (!item.tstates2) continue;
      expect(
        getZ80BranchInfo("none", opCode),
        `opcode $${opCode.toString(16)} (${item.instruction}) has two timings but no branch entry`
      ).toBeDefined();
    }
  });
});

describe("z80-branch-info — attached by the disassembler", () => {
  it("fills the target of a relative jump from the resolved symbol", async () => {
    // --- JR NZ,$0E at $0000 targets $0000 + 2 + $0E = $0010.
    const item = await disassembleOne([0x20, 0x0e]);
    expect(item.instruction).toBe("jr nz,L0010");
    expect(item.branch).toEqual<DisassemblyBranchInfo>({
      kind: "jr",
      condition: "nz",
      target: 0x0010,
      tstatesTaken: 12,
      tstatesNotTaken: 7
    });
  });

  it("fills the target of an absolute jump from the resolved symbol", async () => {
    const item = await disassembleOne([0xc2, 0x34, 0x12]);
    expect(item.instruction).toBe("jp nz,L1234");
    expect(item.branch).toMatchObject({ kind: "jp", condition: "nz", target: 0x1234 });
  });

  it("fills a DJNZ target and leaves it without a flag condition", async () => {
    const item = await disassembleOne([0x10, 0xfe]);
    expect(item.branch).toMatchObject({ kind: "djnz", target: 0x0000 });
    expect(item.branch!.condition).toBeUndefined();
  });

  it("gives RET cc no target, only the source it would come from", async () => {
    const item = await disassembleOne([0xc0]);
    expect(item.instruction).toBe("ret nz");
    expect(item.branch).toEqual<DisassemblyBranchInfo>({
      kind: "ret",
      condition: "nz",
      targetSource: "stack",
      tstatesTaken: 11,
      tstatesNotTaken: 5
    });
    expect(item.branch!.target).toBeUndefined();
  });

  it("keeps the RST vector, which no pragma resolves into a symbol", async () => {
    const item = await disassembleOne([0xdf]);
    expect(item.instruction).toBe("rst $18");
    expect(item.branch).toMatchObject({ kind: "rst", target: 0x18 });
  });

  it("marks the indirect jumps with the register that supplies the address", async () => {
    expect((await disassembleOne([0xe9])).branch).toMatchObject({ targetSource: "hl" });
    expect((await disassembleOne([0xdd, 0xe9])).branch).toMatchObject({ targetSource: "ix" });
    expect((await disassembleOne([0xfd, 0xe9])).branch).toMatchObject({ targetSource: "iy" });
  });

  it("does not mistake a CB-prefixed opcode for the un-prefixed branch of the same number", async () => {
    // --- $C3 is `jp nn` un-prefixed, but `set 0,e` after CB. Keying metadata off the opcode byte
    // --- alone would put a jump verdict on a bit-set instruction.
    const item = await disassembleOne([0xcb, 0xc3]);
    expect(item.instruction).toBe("set 0,e");
    expect(item.branch).toBeUndefined();
  });

  it("does not mistake a DD CB bit operation for a branch", async () => {
    const item = await disassembleOne([0xdd, 0xcb, 0x00, 0xc3]);
    expect(item.branch).toBeUndefined();
  });

  it("still marks a branch reached through a wasted index prefix", async () => {
    // --- DD before a non-indexed opcode is a wasted prefix; the instruction is the un-prefixed
    // --- one, and `disassembleIndexedOperation` falls back to the standard table for the text.
    // --- The metadata has to fall back the same way or the two disagree.
    const item = await disassembleOne([0xdd, 0xc3, 0x34, 0x12]);
    expect(item.instruction).toBe("jp L1234");
    expect(item.branch).toMatchObject({ kind: "jp", target: 0x1234 });
  });

  it("marks Z80N JP (C) only when the extended set is enabled", async () => {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 1));

    const nextItem = (
      await new Z80Disassembler(map.sections, new Uint8Array([0xed, 0x98]), undefined, {
        allowExtendedSet: true
      }).disassemble()
    )!.outputItems[0];
    expect(nextItem.instruction).toBe("jp (c)");
    expect(nextItem.branch).toMatchObject({ kind: "jp-indirect", targetSource: "io-port" });

    // --- On a plain Z80 the same bytes are a `nop`, and a `nop` must not carry a branch.
    const plainItem = (
      await new Z80Disassembler(map.sections, new Uint8Array([0xed, 0x98]), undefined, {
        allowExtendedSet: false
      }).disassemble()
    )!.outputItems[0];
    expect(plainItem.instruction).toBe("nop");
    expect(plainItem.branch).toBeUndefined();
  });

  it.each([
    ["ldir", [0xed, 0xb0]],
    ["ld a,b", [0x78]],
    ["nop", [0x00]],
    ["push bc", [0xc5]]
  ])("attaches nothing to %s", async (_name, opCodes) => {
    expect((await disassembleOne(opCodes as number[])).branch).toBeUndefined();
  });

  it("gives each item its own branch object rather than a shared table entry", async () => {
    const map = new MemoryMap();
    map.add(new MemorySection(0x0000, 3));
    const output = await new Z80Disassembler(
      map.sections,
      new Uint8Array([0x20, 0x00, 0x20, 0x00])
    ).disassemble();
    const [first, second] = output!.outputItems;
    expect(first.branch).not.toBe(second.branch);
    expect(first.branch!.target).toBe(0x0002);
    expect(second.branch!.target).toBe(0x0004);
  });
});

import { describe, expect, it } from "vitest";
import {
  evaluateBranch,
  formatBranchReadout,
  type BranchCpuSnapshot,
  type BranchVerdict
} from "@renderer/appIde/DocumentPanels/branchVerdict";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";
import type {
  DisassemblyBranchCondition,
  DisassemblyBranchInfo
} from "@renderer/appIde/disassemblers/common-types";

/** A snapshot with everything at a recognisable non-zero value, overridable per test. */
function snapshot(overrides: Partial<BranchCpuSnapshot> = {}): BranchCpuSnapshot {
  return {
    af: 0x0000,
    bc: 0x0000,
    hl: 0x1111,
    ix: 0x2222,
    iy: 0x3333,
    sp: 0x5bff,
    pc: 0x8000,
    ...overrides
  };
}

/** A memory reader over a sparse map, standing in for the panel's displayed image. */
function reader(bytes: Record<number, number>) {
  return (address: number) => bytes[address];
}

const JR = (condition: DisassemblyBranchCondition, target: number): DisassemblyBranchInfo => ({
  kind: "jr",
  condition,
  target,
  tstatesTaken: 12,
  tstatesNotTaken: 7
});

describe("evaluateBranch — conditions", () => {
  /*
   * Each condition, in both polarities, driven through the real flag masks. The `f` values set only
   * the bit under test, so a mask mixed up with its neighbour fails here rather than passing by
   * coincidence on a value that happens to have several bits set.
   */
  const cases: [DisassemblyBranchCondition, number, boolean, string][] = [
    ["nz", 0, true, "Z=0"],
    ["nz", FlagsSetMask.Z, false, "Z=1"],
    ["z", 0, false, "Z=0"],
    ["z", FlagsSetMask.Z, true, "Z=1"],
    ["nc", 0, true, "C=0"],
    ["nc", FlagsSetMask.C, false, "C=1"],
    ["c", 0, false, "C=0"],
    ["c", FlagsSetMask.C, true, "C=1"],
    ["po", 0, true, "P/V=0"],
    ["po", FlagsSetMask.PV, false, "P/V=1"],
    ["pe", 0, false, "P/V=0"],
    ["pe", FlagsSetMask.PV, true, "P/V=1"],
    ["p", 0, true, "S=0"],
    ["p", FlagsSetMask.S, false, "S=1"],
    ["m", 0, false, "S=0"],
    ["m", FlagsSetMask.S, true, "S=1"]
  ];

  it.each(cases)("%s with f=%i is taken=%s (%s)", (condition, f, expected, reason) => {
    const verdict = evaluateBranch(JR(condition, 0x0100), 0x0200, 2, snapshot({ af: f }), false);
    expect(verdict.taken).toBe(expected);
    expect(verdict.conditionText).toBe(condition.toUpperCase());
    expect(verdict.reasonText).toBe(reason);
  });

  it("reads flags from the low byte of AF and ignores the accumulator", () => {
    // --- A = $FF must not be mistaken for a set of flags.
    const verdict = evaluateBranch(JR("z", 0x0100), 0x0200, 2, snapshot({ af: 0xff00 }), false);
    expect(verdict.taken).toBe(false);
    expect(verdict.reasonText).toBe("Z=0");
  });

  it("ignores the flags that no condition tests", () => {
    const irrelevant = FlagsSetMask.H | FlagsSetMask.N | FlagsSetMask.R3 | FlagsSetMask.R5;
    const verdict = evaluateBranch(JR("nz", 0x0100), 0x0200, 2, snapshot({ af: irrelevant }), false);
    expect(verdict.taken).toBe(true);
  });

  it("spends the taken timing when taken and the other when not", () => {
    expect(evaluateBranch(JR("z", 0x100), 0x200, 2, snapshot({ af: FlagsSetMask.Z }), false).tstates)
      .toBe(12);
    expect(evaluateBranch(JR("z", 0x100), 0x200, 2, snapshot({ af: 0 }), false).tstates).toBe(7);
  });
});

describe("evaluateBranch — DJNZ", () => {
  const DJNZ: DisassemblyBranchInfo = {
    kind: "djnz",
    target: 0x0200,
    tstatesTaken: 13,
    tstatesNotTaken: 8
  };

  it.each([
    [2, true, "B $02→$01"],
    [1, false, "B $01→$00"],
    // --- B = 0 decrements to 255 and loops: the 256-iteration idiom, not an early exit.
    [0, true, "B $00→$FF"],
    [0xa4, true, "B $A4→$A3"]
  ])("with B=%i is taken=%s", (b, expected, reason) => {
    const verdict = evaluateBranch(DJNZ, 0x0210, 2, snapshot({ bc: (b << 8) | 0x34 }), false);
    expect(verdict.taken).toBe(expected);
    expect(verdict.reasonText).toBe(reason);
  });

  it("tests B rather than a flag, and says so", () => {
    const verdict = evaluateBranch(DJNZ, 0x0210, 2, snapshot({ bc: 0x0500, af: 0xff }), false);
    expect(verdict.conditionText).toBe("B≠0");
    // --- Every flag is set; none of them may change the answer.
    expect(verdict.taken).toBe(true);
  });
});

describe("evaluateBranch — destinations", () => {
  it("reports the fall-through address when not taken", () => {
    const verdict = evaluateBranch(JR("z", 0x0100), 0x0200, 2, snapshot({ af: 0 }), false);
    expect(verdict.nextAddress).toBe(0x0202);
    expect(verdict.direction).toBe("none");
  });

  it("derives fall-through from the instruction length, not from the next listing row", () => {
    const jp: DisassemblyBranchInfo = {
      kind: "jp",
      condition: "z",
      target: 0x9000,
      tstatesTaken: 10,
      tstatesNotTaken: 10
    };
    expect(evaluateBranch(jp, 0x0200, 3, snapshot({ af: 0 }), false).nextAddress).toBe(0x0203);
  });

  it("wraps the fall-through address at the top of memory", () => {
    expect(evaluateBranch(JR("z", 0x0100), 0xffff, 2, snapshot({ af: 0 }), false).nextAddress)
      .toBe(0x0001);
  });

  it("calls a jump to a lower address backward and a higher one forward", () => {
    const taken = snapshot({ af: FlagsSetMask.Z });
    expect(evaluateBranch(JR("z", 0x0100), 0x0200, 2, taken, false).direction).toBe("back");
    expect(evaluateBranch(JR("z", 0x0300), 0x0200, 2, taken, false).direction).toBe("forward");
    // --- A jump to itself is a loop, not a step forward.
    expect(evaluateBranch(JR("z", 0x0200), 0x0200, 2, taken, false).direction).toBe("back");
  });

  it.each([
    ["hl", 0x1111],
    ["ix", 0x2222],
    ["iy", 0x3333]
  ] as const)("resolves jp (%s) from the register", (targetSource, expected) => {
    const branch: DisassemblyBranchInfo = {
      kind: "jp-indirect",
      targetSource,
      tstatesTaken: 8,
      tstatesNotTaken: 8
    };
    const verdict = evaluateBranch(branch, 0x8000, 2, snapshot(), false);
    expect(verdict.taken).toBe(true);
    expect(verdict.nextAddress).toBe(expected);
    // --- Resolved, so it takes an ordinary direction rather than a category of its own.
    expect(verdict.direction).toBe("back");
    expect(verdict.unobtainable).toBeUndefined();
  });

  it("keeps an RST vector as its destination", () => {
    const rst: DisassemblyBranchInfo = {
      kind: "rst",
      target: 0x0028,
      tstatesTaken: 11,
      tstatesNotTaken: 11
    };
    const verdict = evaluateBranch(rst, 0x8000, 1, snapshot(), false);
    expect(verdict.nextAddress).toBe(0x0028);
    expect(verdict.direction).toBe("back");
    expect(verdict.conditionText).toBeUndefined();
  });
});

describe("evaluateBranch — RET cc and the stack (decision 7)", () => {
  const RET_NZ: DisassemblyBranchInfo = {
    kind: "ret",
    condition: "nz",
    targetSource: "stack",
    tstatesTaken: 11,
    tstatesNotTaken: 5
  };
  const stack = { 0x5bff: 0x03, 0x5c00: 0x13 };

  it("reads the return address from the stack at PC", () => {
    const cpu = snapshot({ af: 0, readByte: reader(stack) });
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, cpu, true);
    expect(verdict.taken).toBe(true);
    expect(verdict.nextAddress).toBe(0x1303);
    expect(verdict.direction).toBe("return");
    expect(verdict.unobtainable).toBeUndefined();
  });

  it("withholds the address away from PC, without calling it a failure", () => {
    // --- The stack top belongs to whatever is executing now, not to this row. Showing it would be
    // --- a confident lie; `unobtainable` stays clear because nothing actually went wrong.
    const cpu = snapshot({ af: 0, readByte: reader(stack) });
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, cpu, false);
    expect(verdict.taken).toBe(true);
    expect(verdict.nextAddress).toBeUndefined();
    expect(verdict.unobtainable).toBeUndefined();
    expect(verdict.direction).toBe("return");
  });

  it("does not consult the stack at all when the return is not taken", () => {
    let reads = 0;
    const cpu = snapshot({
      af: FlagsSetMask.Z,
      readByte: (address) => {
        reads++;
        return stack[address as keyof typeof stack];
      }
    });
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, cpu, true);
    expect(verdict.taken).toBe(false);
    expect(verdict.nextAddress).toBe(0x0f10);
    expect(reads).toBe(0);
  });

  it("reports an unreadable stack as unobtainable, distinct from withholding it", () => {
    // --- The banked view: the image is one partition and SP points outside it.
    const cpu = snapshot({ af: 0, readByte: () => undefined });
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, cpu, true);
    expect(verdict.unobtainable).toBe("stack-unreadable");
    expect(verdict.nextAddress).toBeUndefined();
  });

  it("reports no reader at all the same way", () => {
    const verdict = evaluateBranch(RET_NZ, 0x0f0f, 1, snapshot({ af: 0 }), true);
    expect(verdict.unobtainable).toBe("stack-unreadable");
  });

  it("does not treat a half-readable word as an address", () => {
    // --- Low byte inside the image, high byte outside: the word is not knowable, so no guessing.
    const cpu = snapshot({ af: 0, readByte: reader({ 0x5bff: 0x03 }) });
    expect(evaluateBranch(RET_NZ, 0x0f0f, 1, cpu, true).unobtainable).toBe("stack-unreadable");
  });

  it("reads the stack word little-endian and wraps at the top of memory", () => {
    const cpu = snapshot({
      af: 0,
      sp: 0xffff,
      readByte: reader({ 0xffff: 0xcd, 0x0000: 0xab })
    });
    expect(evaluateBranch(RET_NZ, 0x0f0f, 1, cpu, true).nextAddress).toBe(0xabcd);
  });
});

describe("evaluateBranch — JP (C) is never resolved (decision 11)", () => {
  const JP_C: DisassemblyBranchInfo = {
    kind: "jp-indirect",
    targetSource: "io-port",
    tstatesTaken: 13,
    tstatesNotTaken: 13
  };

  it("says the destination is unobtainable rather than producing one", () => {
    const verdict = evaluateBranch(JP_C, 0x8000, 2, snapshot(), true);
    expect(verdict.taken).toBe(true);
    expect(verdict.nextAddress).toBeUndefined();
    expect(verdict.unobtainable).toBe("io-port");
    expect(verdict.direction).toBe("unknown");
    expect(verdict.tstates).toBe(13);
  });

  it("stays unobtainable at PC, where every other source becomes resolvable", () => {
    // --- `atPc` unlocks the stack for RET. It must unlock nothing here: there is no amount of
    // --- certainty about position that makes an unperformed I/O read knowable.
    expect(evaluateBranch(JP_C, 0x8000, 2, snapshot(), true).unobtainable).toBe("io-port");
    expect(evaluateBranch(JP_C, 0x8000, 2, snapshot(), false).unobtainable).toBe("io-port");
  });

  it("cannot be resolved from BC, which is only the port number", () => {
    // --- The destination is (PC & $C000) | (readPort(BC) << 6). An earlier draft of the plan had
    // --- this as (PC & $C000) | (C << 6), which would make it resolvable from the snapshot. It is
    // --- not. This pins the corrected behaviour so the wrong formula cannot come back.
    const verdict = evaluateBranch(JP_C, 0x8000, 2, snapshot({ bc: 0x243b, pc: 0x8000 }), true);
    expect(verdict.nextAddress).toBeUndefined();
    // --- Specifically, not the address the wrong formula would have given.
    expect(verdict.nextAddress).not.toBe((0x8000 & 0xc000) | (0x3b << 6));
  });

  it("offers no way to reach a port, by construction", () => {
    // --- `BranchCpuSnapshot` has no port accessor, so there is nothing for a later edit to call.
    const cpu = snapshot();
    expect(Object.keys(cpu).some((key) => /port|io/i.test(key))).toBe(false);
  });
});

describe("evaluateBranch — unconditional branches", () => {
  it.each([
    ["jr", { kind: "jr", target: 0x0100, tstatesTaken: 12, tstatesNotTaken: 12 }],
    ["jp", { kind: "jp", target: 0x0100, tstatesTaken: 10, tstatesNotTaken: 10 }],
    ["call", { kind: "call", target: 0x0100, tstatesTaken: 17, tstatesNotTaken: 17 }]
  ] as [string, DisassemblyBranchInfo][])("%s is always taken and states no condition", (_n, branch) => {
    const verdict = evaluateBranch(branch, 0x0200, 3, snapshot({ af: 0xff }), false);
    expect(verdict.taken).toBe(true);
    expect(verdict.conditionText).toBeUndefined();
    expect(verdict.reasonText).toBeUndefined();
    expect(verdict.nextAddress).toBe(0x0100);
  });
});

describe("evaluateBranch — the imported flag masks survive bundling", () => {
  /*
   * `FlagsSetMask` is a `const enum` in `src/emu`, and this is the first renderer-side module to
   * import one. A `const enum` emits no runtime object, so under a per-file transpiler a
   * cross-module import can resolve to `undefined` — at which point `f & FlagsSetMask.Z` is 0 for
   * every input and every condition silently answers "not set" instead of failing loudly.
   *
   * These cases therefore use raw hex rather than the enum, so they still fail if the import
   * evaporates. The rest of the suite would not: it builds its `af` values from the same enum, so
   * both sides would collapse together.
   */
  it.each([
    ["z", 0x40, true],
    ["nz", 0x40, false],
    ["c", 0x01, true],
    ["nc", 0x01, false],
    ["pe", 0x04, true],
    ["po", 0x04, false],
    ["m", 0x80, true],
    ["p", 0x80, false]
  ] as [DisassemblyBranchCondition, number, boolean][])(
    "%s against raw flag $%s is taken=%s",
    (condition, f, expected) => {
      expect(evaluateBranch(JR(condition, 0x0100), 0x0200, 2, snapshot({ af: f }), false).taken)
        .toBe(expected);
    }
  );

  it("distinguishes each flag from its neighbours", () => {
    // --- Setting only C must not satisfy Z, and vice versa: a mask off by one bit passes the
    // --- single-condition cases above but fails here.
    expect(evaluateBranch(JR("z", 0x100), 0x200, 2, snapshot({ af: 0x01 }), false).taken).toBe(false);
    expect(evaluateBranch(JR("c", 0x100), 0x200, 2, snapshot({ af: 0x40 }), false).taken).toBe(false);
    expect(evaluateBranch(JR("z", 0x100), 0x200, 2, snapshot({ af: 0x04 }), false).taken).toBe(false);
  });
});

describe("formatBranchReadout", () => {
  const base: BranchVerdict = {
    kind: "jr",
    taken: true,
    conditionText: "NC",
    reasonText: "C=0",
    nextAddress: 0x0efd,
    direction: "back",
    tstates: 12
  };

  it("describes a backward jump in both forms", () => {
    const { long, short } = formatBranchReadout(base, false);
    expect(long.text).toBe("jumps back to $0EFD  ·  NC met (C=0)  ·  12 T");
    expect(short.text).toBe("→ $0EFD  C=0  12T");
  });

  it("says forward for a forward jump", () => {
    expect(formatBranchReadout({ ...base, direction: "forward" }, false).long.text).toContain(
      "jumps forward to $0EFD"
    );
  });

  it("describes a fall-through, and says the condition was not met", () => {
    const { long, short } = formatBranchReadout(
      { ...base, taken: false, direction: "none", nextAddress: 0x0f12, reasonText: "C=1", tstates: 7 },
      false
    );
    expect(long.text).toBe("falls through to $0F12  ·  NC not met (C=1)  ·  7 T");
    expect(short.text).toBe("↓ $0F12  C=1  7T");
  });

  it("describes a return", () => {
    expect(
      formatBranchReadout(
        { ...base, direction: "return", nextAddress: 0x1303, conditionText: "M", reasonText: "S=1", tstates: 11 },
        false
      ).long.text
    ).toBe("returns to $1303  ·  M met (S=1)  ·  11 T");
  });

  it("omits the condition clause entirely for an unconditional branch", () => {
    const { long, short } = formatBranchReadout(
      { kind: "jp", taken: true, nextAddress: 0x8000, direction: "forward", tstates: 10 },
      false
    );
    expect(long.text).toBe("jumps forward to $8000  ·  10 T");
    expect(short.text).toBe("→ $8000  10T");
  });

  it("names the port for an unobtainable JP (C) rather than saying 'unknown'", () => {
    // --- Wording rule: say *why* there is no address. "destination unknown" reads as a defect in
    // --- the debugger; naming the port says the machine has genuinely not decided yet.
    const { long, short } = formatBranchReadout(
      { kind: "jp-indirect", taken: true, unobtainable: "io-port", direction: "unknown", tstates: 13 },
      false
    );
    expect(long.text).toBe("jumps — destination is read from port BC as it executes  ·  13 T");
    expect(long.text).not.toContain("unknown");
    expect(short.text).toBe("→ ?  13T");
  });

  it("explains an unreadable stack in terms of the view, not as a failure", () => {
    const { long } = formatBranchReadout(
      {
        kind: "ret",
        taken: true,
        unobtainable: "stack-unreadable",
        direction: "return",
        conditionText: "NZ",
        reasonText: "Z=0",
        tstates: 11
      },
      false
    );
    expect(long.text).toBe(
      "returns — the stack is outside the memory on display  ·  NZ met (Z=0)  ·  11 T"
    );
  });

  it("follows the panel into decimal, so it never contradicts the columns beside it", () => {
    const { long, short } = formatBranchReadout(base, true);
    expect(long.text).toContain("03837");
    expect(long.text).not.toContain("$");
    expect(short.text).toContain("03837");
  });

  it("shows the address rather than the label, which the instruction column already carries", () => {
    expect(formatBranchReadout(base, false).long.text).not.toContain("L0EFD");
  });
});

describe("formatBranchReadout — head and detail split", () => {
  const base: BranchVerdict = {
    kind: "jr",
    taken: true,
    conditionText: "NC",
    reasonText: "C=0",
    nextAddress: 0x0efd,
    direction: "back",
    tstates: 12
  };

  it("puts the outcome in the head and the evidence in the detail", () => {
    // --- The row paints these differently: the head is the answer, the detail supports it.
    // --- Colouring the whole sentence as the outcome turned the readout into a green paragraph.
    const { long, short } = formatBranchReadout(base, false);
    expect(long.head).toBe("jumps back to $0EFD");
    expect(long.detail).toBe("NC met (C=0)  ·  12 T");
    expect(short.head).toBe("→ $0EFD");
    expect(short.detail).toBe("C=0  12T");
  });

  it("keeps `text` as head and detail joined, which is what the tooltip shows", () => {
    const { long } = formatBranchReadout(base, false);
    expect(long.text).toBe(`${long.head}  ·  ${long.detail}`);
  });

  it("leaves the detail empty for an unconditional branch rather than emitting a stray separator", () => {
    const { long } = formatBranchReadout(
      { kind: "jp", taken: true, nextAddress: 0x8000, direction: "forward", tstates: 10 },
      false
    );
    expect(long.head).toBe("jumps forward to $8000");
    expect(long.detail).toBe("10 T");
    expect(long.text).not.toContain("·  ·");
  });
});

describe("formatBranchReadout — a call is not a jump", () => {
  /*
   * `RST n` is `CALL n` in a one-byte encoding: it pushes a return address and the CPU comes back.
   * Reporting `rst $08` as "jumps back to $0008" was wrong twice over — wrong verb, and "back"
   * carries the sense of a loop closing, which a call to a low vector is not.
   */
  it("says calls, not jumps, for RST", () => {
    const { long, short } = formatBranchReadout(
      { kind: "rst", taken: true, nextAddress: 0x0008, direction: "back", tstates: 11 },
      false
    );
    expect(long.head).toBe("calls $0008");
    expect(long.text).toBe("calls $0008  ·  11 T");
    expect(long.text).not.toContain("jumps");
    expect(long.text).not.toContain("back");
    expect(short.head).toBe("→ $0008");
  });

  it("says calls for CALL nn too, which had the same defect", () => {
    const { long } = formatBranchReadout(
      { kind: "call", taken: true, nextAddress: 0x15e6, direction: "forward", tstates: 17 },
      false
    );
    expect(long.head).toBe("calls $15E6");
    expect(long.text).not.toContain("jumps");
    expect(long.text).not.toContain("forward");
  });

  it("keeps the condition clause on a conditional call", () => {
    const { long } = formatBranchReadout(
      {
        kind: "call",
        taken: true,
        conditionText: "NZ",
        reasonText: "Z=0",
        nextAddress: 0x15e6,
        direction: "forward",
        tstates: 17
      },
      false
    );
    expect(long.text).toBe("calls $15E6  ·  NZ met (Z=0)  ·  17 T");
  });

  it("still says falls through when a conditional call is not taken", () => {
    const { long } = formatBranchReadout(
      {
        kind: "call",
        taken: false,
        conditionText: "NZ",
        reasonText: "Z=1",
        nextAddress: 0x15e1,
        direction: "none",
        tstates: 10
      },
      false
    );
    expect(long.head).toBe("falls through to $15E1");
  });

  it.each([
    ["jr", "back", "jumps back to $0EFD"],
    ["jp", "forward", "jumps forward to $0EFD"],
    ["djnz", "back", "jumps back to $0EFD"]
  ] as const)("leaves %s describing a jump", (kind, direction, expected) => {
    const { long } = formatBranchReadout(
      { kind, taken: true, nextAddress: 0x0efd, direction, tstates: 12 },
      false
    );
    expect(long.head).toBe(expected);
  });

  it("carries the kind through from evaluateBranch, not just from a hand-built verdict", () => {
    // --- The wording depends on `kind` reaching the verdict; a regression there would silently
    // --- restore "jumps", because an undefined kind is not a call.
    const rst = evaluateBranch(
      { kind: "rst", target: 0x0008, tstatesTaken: 11, tstatesNotTaken: 11 },
      0x8000,
      1,
      snapshot(),
      true
    );
    expect(rst.kind).toBe("rst");
    expect(formatBranchReadout(rst, false).long.head).toBe("calls $0008");
  });
});

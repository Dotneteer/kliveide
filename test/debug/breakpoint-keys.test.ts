import { describe, expect, it } from "vitest";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import {
  getBreakpointAddressSpec,
  getBreakpointDisplayKey,
  getBreakpointStorageKey
} from "@common/utils/breakpoints";

/*
 * A breakpoint's key serves two masters, and conflating them is what let `bp-list` print
 * breakpoints in a notation `bp-set` would not accept back. The storage key names a partition by
 * index so it cannot move when a machine's labels do; the display key names it by label because
 * that is what a user types.
 *
 * See `.plans/PARTITION_NAMING_UNIFICATION_PLAN.md` §8, decision 4.
 */

/** A 128K-shaped label map: ROMs indexed negatively, banks from zero. */
const LABELS: Record<number, string> = {
  [-2]: "R1",
  [-1]: "R0",
  0: "B0",
  1: "B1",
  7: "B7"
};

const exec = (over: Partial<BreakpointInfo> = {}): BreakpointInfo => ({
  address: 0x8000,
  exec: true,
  ...over
});

describe("breakpoint keys - the parts both forms share", () => {
  it.each([
    ["an execution breakpoint", {}, "$8000"],
    ["a memory read", { memoryRead: true }, "$8000:R"],
    ["a memory write", { memoryWrite: true }, "$8000:W"],
    ["an I/O read", { ioRead: true }, "$8000:IR"],
    ["an I/O write", { ioWrite: true }, "$8000:IW"]
  ])("names %s the same way in both forms", (_what, over, expected) => {
    const bp = exec(over);
    expect(getBreakpointStorageKey(bp)).toBe(expected);
    expect(getBreakpointDisplayKey(bp, LABELS)).toBe(expected);
  });

  it("names a source-bound breakpoint by file and line in both forms", () => {
    const bp: BreakpointInfo = { resource: "code/code.kz80.asm", line: 12 };
    expect(getBreakpointStorageKey(bp)).toBe("[code/code.kz80.asm]:12");
    expect(getBreakpointDisplayKey(bp, LABELS)).toBe("[code/code.kz80.asm]:12");
  });

  it("refuses a breakpoint that is neither address- nor source-bound", () => {
    expect(() => getBreakpointStorageKey({})).toThrow();
    expect(() => getBreakpointDisplayKey({}, LABELS)).toThrow();
  });
});

describe("breakpoint keys - where the two forms differ", () => {
  it("names a partition by index for storage and by label for display", () => {
    const bp = exec({ partition: -1 });
    expect(getBreakpointStorageKey(bp)).toBe("-1:$8000");
    expect(getBreakpointDisplayKey(bp, LABELS)).toBe("R0:$8000");
  });

  it("keeps the storage key stable when the labels change", () => {
    // --- The whole reason for the split: a stored key must not move when a machine is
    // --- reconfigured, or it stops naming the breakpoint it was written for.
    const bp = exec({ partition: 1 });
    const key = getBreakpointStorageKey(bp);

    expect(getBreakpointDisplayKey(bp, LABELS)).toBe("B1:$8000");
    expect(getBreakpointDisplayKey(bp, { 1: "01" })).toBe("01:$8000");
    expect(getBreakpointStorageKey(bp)).toBe(key);
  });

  it("marks an index the machine has no label for, rather than inventing one", () => {
    expect(getBreakpointDisplayKey(exec({ partition: 99 }), LABELS)).toBe("?:$8000");
  });

  it("survives a missing label map without falling back to the storage notation", () => {
    // --- `partitionLabels` is a required parameter, so this can only happen through an untyped
    // --- caller. It must not silently produce `-1:$8000` — that is the bug the split prevents.
    expect(getBreakpointDisplayKey(exec({ partition: -1 }), undefined as any)).toBe("?:$8000");
  });

  it("carries the kind suffix on a partitioned breakpoint in both forms", () => {
    const bp = exec({ partition: -1, exec: false, memoryWrite: true });
    expect(getBreakpointStorageKey(bp)).toBe("-1:$8000:W");
    expect(getBreakpointDisplayKey(bp, LABELS)).toBe("R0:$8000:W");
  });
});

describe("breakpoint keys - the round trip bp-list used to break", () => {
  /**
   * The invariant: what a listing prints, a setter must accept.
   *
   * Mirrors `parseSpectrumPartitionLabel`'s grammar rather than importing a machine, so this stays
   * a fast node test. `bp-set` splits on the first colon and parses the left side as a partition.
   */
  const parses = (key: string): boolean => {
    const [partition] = key.split(":");
    return /^[RB]\d+$/i.test(partition);
  };

  it("prints a partition a command can parse back", () => {
    for (const partition of [-2, -1, 0, 1, 7]) {
      const key = getBreakpointDisplayKey(exec({ partition }), LABELS);
      expect(parses(key), key).toBe(true);
    }
  });

  it("does not print one the storage form would produce", () => {
    // --- `-1:$8000` is what `bp-list` used to emit, and `bp-set -1:$8000` rejects it.
    for (const partition of [-2, -1, 0, 1, 7]) {
      expect(parses(getBreakpointStorageKey(exec({ partition })))).toBe(false);
    }
  });
});

describe("breakpoint keys - NextReg write breakpoints", () => {
  /*
   * The fifth binding shape, and the first that is not a place. It carries no address and no
   * partition, so the two key forms coincide and the label map is never consulted — which is what
   * every case below asserts by checking both forms against one string.
   *
   * See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.3.
   */
  const bothForms = (bp: BreakpointInfo): string => {
    const storage = getBreakpointStorageKey(bp);
    expect(getBreakpointDisplayKey(bp, LABELS)).toBe(storage);
    return storage;
  };

  it.each([
    ["any write to a register", { nextReg: 0x07 }, "NR:$07"],
    ["a filtered write", { nextReg: 0x07, nextRegValue: 0x03 }, "NR:$07=$03"],
    [
      "a masked filtered write",
      { nextReg: 0x07, nextRegValue: 0x03, nextRegMask: 0x0f },
      "NR:$07=$03/$0F"
    ]
  ])("names %s", (_what, bp, expected) => {
    expect(bothForms(bp)).toBe(expected);
  });

  it("pads and upper-cases the register number", () => {
    expect(bothForms({ nextReg: 0x0a })).toBe("NR:$0A");
    expect(bothForms({ nextReg: 0xff })).toBe("NR:$FF");
    expect(bothForms({ nextReg: 0x00 })).toBe("NR:$00");
  });

  it("treats a $FF mask as no mask at all", () => {
    // --- Comparing all eight bits is what "no mask" means, so the two spellings are one
    // --- breakpoint and must not produce two keys.
    expect(bothForms({ nextReg: 0x07, nextRegValue: 0x03, nextRegMask: 0xff })).toBe(
      bothForms({ nextReg: 0x07, nextRegValue: 0x03 })
    );
  });

  it("ignores a mask that has no value to mask", () => {
    // --- The command layer and the dialog both reject this, so it should be unreachable. If it
    // --- arrives anyway, the key must stay one a user can type back.
    expect(bothForms({ nextReg: 0x07, nextRegMask: 0x0f })).toBe("NR:$07");
  });

  it("keeps the Copper opt-in out of the key", () => {
    // --- `nextRegCopper` is a property, not an identity: a CPU-only and a CPU-plus-Copper
    // --- breakpoint on one register are not two breakpoints, the second subsumes the first. So
    // --- `bp-set nr:$07 -c` must update the existing breakpoint rather than add a second one.
    expect(bothForms({ nextReg: 0x07, nextRegCopper: true })).toBe("NR:$07");
    expect(bothForms({ nextReg: 0x07, nextRegValue: 0x03, nextRegCopper: true })).toBe(
      "NR:$07=$03"
    );
  });

  it("keeps `disabled` and `hitCount` out of the key, as every other shape does", () => {
    expect(bothForms({ nextReg: 0x07, disabled: true, hitCount: 12 })).toBe("NR:$07");
  });

  it("names the register before the address branch, so a stray address cannot win", () => {
    // --- Not a shape anything should build, but the branch order is load-bearing: were it
    // --- reversed, resolution or a careless spread could silently turn a register breakpoint
    // --- into an address one under the same identity.
    expect(bothForms({ nextReg: 0x07, address: 0x8000 })).toBe("NR:$07");
  });

  it("refuses a value filter with no register", () => {
    // --- The register is the binding. Without it there is nothing to name, exactly as for a
    // --- breakpoint with neither an address nor a resource.
    expect(() => getBreakpointStorageKey({ nextRegValue: 0x03 })).toThrow();
    expect(() => getBreakpointDisplayKey({ nextRegValue: 0x03 }, LABELS)).toThrow();
  });
});

describe("breakpoint keys - the address spec a `bp-*` command takes back", () => {
  it("returns a NextReg key unchanged, because its shape is its kind", () => {
    // --- `getBreakpointAddressSpec` rebuilds the key with the kind flags cleared, so that
    // --- `BreakpointIndicator` can splice it into `bp-del <spec> -w`. A NextReg breakpoint has no
    // --- kind flag to clear and no `:R`/`:W` suffix to lose, so the spec is the key.
    for (const bp of [
      { nextReg: 0x07 },
      { nextReg: 0x07, nextRegValue: 0x03 },
      { nextReg: 0x07, nextRegValue: 0x03, nextRegMask: 0x0f },
      { nextReg: 0x07, nextRegCopper: true }
    ]) {
      expect(getBreakpointAddressSpec(bp, LABELS)).toBe(getBreakpointDisplayKey(bp, LABELS));
    }
  });
});

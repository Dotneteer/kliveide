import { describe, it, expect } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import {
  fromSidecarBreakpoints,
  sameSidecarBreakpoints,
  sidecarKindOf,
  toSidecarBreakpoints
} from "@renderer/appIde/DocumentPanels/Next/nexBreakpointSync";

const SIDECAR = "/p/Game.nex.dis";
const OTHER = "/p/Other.nex.dis";

function owned(over: Partial<BreakpointInfo> = {}, sidecar = SIDECAR): BreakpointInfo {
  return {
    bank: 5,
    bankOffset: 0x100,
    exec: true,
    owner: { kind: "nex", sidecar },
    ...over
  };
}

describe("sidecarKindOf", () => {
  it("names the memory kinds, and treats anything else as execution", () => {
    expect(sidecarKindOf({ memoryRead: true })).toEqual("memRead");
    expect(sidecarKindOf({ memoryWrite: true })).toEqual("memWrite");
    expect(sidecarKindOf({ exec: true })).toEqual("exec");
    expect(sidecarKindOf({})).toEqual("exec");
  });

  it("refuses an I/O breakpoint, which has a port rather than a bank", () => {
    expect(sidecarKindOf({ ioRead: true })).toEqual(undefined);
    expect(sidecarKindOf({ ioWrite: true })).toEqual(undefined);
  });
});

describe("toSidecarBreakpoints", () => {
  it("stores the bank-relative breakpoints this sidecar owns", () => {
    expect(toSidecarBreakpoints([owned()], SIDECAR)).toEqual([
      { bank: 5, offset: 0x100, kind: "exec" }
    ]);
  });

  it("leaves another sidecar's breakpoints to that file", () => {
    expect(toSidecarBreakpoints([owned({}, OTHER)], SIDECAR)).toEqual([]);
  });

  it("leaves the project's and the session's breakpoints alone", () => {
    const project: BreakpointInfo = { bank: 5, bankOffset: 0x100, exec: true };
    const session: BreakpointInfo = {
      bank: 5,
      bankOffset: 0x200,
      exec: true,
      owner: { kind: "session" }
    };
    expect(toSidecarBreakpoints([project, session], SIDECAR)).toEqual([]);
  });

  it("skips a breakpoint that is not bank-relative", () => {
    // --- An address breakpoint that happens to land inside the bank's window is not a breakpoint
    // --- *on the bank*, and has no offset to store.
    const addressBp = owned({ bank: undefined, bankOffset: undefined, address: 0x8000 });
    expect(toSidecarBreakpoints([addressBp], SIDECAR)).toEqual([]);
  });

  it("skips an I/O breakpoint even when it claims a bank", () => {
    expect(toSidecarBreakpoints([owned({ exec: undefined, ioRead: true })], SIDECAR)).toEqual([]);
  });

  it("records the disabled flag, and only when set", () => {
    expect(toSidecarBreakpoints([owned({ disabled: true })], SIDECAR)[0]).toEqual({
      bank: 5,
      offset: 0x100,
      kind: "exec",
      disabled: true
    });
    // --- Absent rather than `false`, so an armed breakpoint reads the same as it always did.
    expect("disabled" in toSidecarBreakpoints([owned()], SIDECAR)[0]).toEqual(false);
  });

  it("sorts by bank then offset, so the file does not churn", () => {
    const stored = toSidecarBreakpoints(
      [
        owned({ bank: 6, bankOffset: 0x10 }),
        owned({ bank: 5, bankOffset: 0x200 }),
        owned({ bank: 5, bankOffset: 0x100 })
      ],
      SIDECAR
    );
    expect(stored.map((entry) => [entry.bank, entry.offset])).toEqual([
      [5, 0x100],
      [5, 0x200],
      [6, 0x10]
    ]);
  });
});

describe("fromSidecarBreakpoints", () => {
  it("restores each kind as the flag the emulator expects, owned by its sidecar", () => {
    const restored = fromSidecarBreakpoints(
      [
        { bank: 5, offset: 0x100, kind: "exec" },
        { bank: 5, offset: 0x200, kind: "memRead" },
        { bank: 6, offset: 0x300, kind: "memWrite", disabled: true }
      ],
      SIDECAR
    );

    expect(restored[0]).toEqual({
      bank: 5,
      bankOffset: 0x100,
      exec: true,
      owner: { kind: "nex", sidecar: SIDECAR }
    });
    expect(restored[1].memoryRead).toEqual(true);
    expect(restored[1].exec).toEqual(undefined);
    expect(restored[2].memoryWrite).toEqual(true);
    expect(restored[2].disabled).toEqual(true);
  });

  it("copes with nothing stored", () => {
    expect(fromSidecarBreakpoints(undefined, SIDECAR)).toEqual([]);
    expect(fromSidecarBreakpoints([], SIDECAR)).toEqual([]);
  });
});

describe("the round trip", () => {
  it("survives store and restore unchanged", () => {
    const original = [
      owned({ bank: 5, bankOffset: 0x100 }),
      owned({ bank: 5, bankOffset: 0x200, exec: undefined, memoryWrite: true }),
      owned({ bank: 0, bankOffset: 0, disabled: true })
    ];
    const stored = toSidecarBreakpoints(original, SIDECAR);
    const restored = fromSidecarBreakpoints(stored, SIDECAR);
    expect(toSidecarBreakpoints(restored, SIDECAR)).toEqual(stored);
  });

  it("keeps bank 0 at offset 0, which is every falsy value at once", () => {
    const stored = toSidecarBreakpoints([owned({ bank: 0, bankOffset: 0 })], SIDECAR);
    expect(stored).toEqual([{ bank: 0, offset: 0, kind: "exec" }]);
    expect(fromSidecarBreakpoints(stored, SIDECAR)[0]).toMatchObject({ bank: 0, bankOffset: 0 });
  });
});

describe("sameSidecarBreakpoints", () => {
  it("is true for identical sets, and for two empty ones however they are spelled", () => {
    const set = [{ bank: 5, offset: 0x100, kind: "exec" as const }];
    expect(sameSidecarBreakpoints(set, [{ bank: 5, offset: 0x100, kind: "exec" }])).toEqual(true);
    expect(sameSidecarBreakpoints(undefined, [])).toEqual(true);
  });

  it("notices any difference that would need writing", () => {
    const set = [{ bank: 5, offset: 0x100, kind: "exec" as const }];
    expect(sameSidecarBreakpoints(set, [])).toEqual(false);
    expect(sameSidecarBreakpoints(set, [{ bank: 6, offset: 0x100, kind: "exec" }])).toEqual(false);
    expect(sameSidecarBreakpoints(set, [{ bank: 5, offset: 0x101, kind: "exec" }])).toEqual(false);
    expect(sameSidecarBreakpoints(set, [{ bank: 5, offset: 0x100, kind: "memRead" }])).toEqual(
      false
    );
    expect(
      sameSidecarBreakpoints(set, [{ bank: 5, offset: 0x100, kind: "exec", disabled: true }])
    ).toEqual(false);
  });
});

describe("label-anchored breakpoints are not stored as bank offsets", () => {
  it("skips one that has resolved to a bank site", () => {
    /*
     * A resolved label breakpoint has an *effective* bank site, so anything keyed off
     * `isBankRelative` would store it as a bare bank and offset — losing the label that is its
     * identity, and reloading as a different kind of breakpoint that no longer follows its label.
     * Storing them properly needs its own sidecar field; being session-lived is honest, a lossy
     * save is not. See `.plans/NEX_DEBUGGING_PLAN.md` §13.2.
     */
    const labelBp: BreakpointInfo = {
      label: "DrawSprite",
      labelFile: SIDECAR,
      bank: 5,
      exec: true,
      resolvedBank: 5,
      resolvedBankOffset: 0x0100,
      owner: { kind: "nex", sidecar: SIDECAR }
    };
    expect(toSidecarBreakpoints([labelBp], SIDECAR)).toEqual([]);
  });

  it("still stores a real bank-relative breakpoint beside it", () => {
    const labelBp: BreakpointInfo = {
      label: "DrawSprite",
      labelFile: SIDECAR,
      bank: 5,
      exec: true,
      owner: { kind: "nex", sidecar: SIDECAR }
    };
    expect(toSidecarBreakpoints([labelBp, owned()], SIDECAR)).toEqual([
      { bank: 5, offset: 0x100, kind: "exec" }
    ]);
  });
});

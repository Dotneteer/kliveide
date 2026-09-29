import { describe, expect, it } from "vitest";

import { createRuntimeRig } from "./runtime-kit";

// --- A caller's IY that is not $5C3A but still safe for the ROM's interrupt routine to write near
const CALLER_IY = 0x9000;

describe("Klive BASIC runtime - program start-up and END", () => {
  it("END returns n in BC and restores the caller's SP, IY, IX and HL'", async () => {
    const rig = await createRuntimeRig({
      uses: [],
      init: false,
      main: ["    ld ix,0", "    exx", "    ld hl,0", "    exx", "    ld bc,42", "    jp core.End"].join("\n")
    });
    const r = rig.call("Main", { iy: CALLER_IY, ix: 0x1234, hl_: 0x4321 });
    expect(r).toMatchObject({ bc: 42, iy: CALLER_IY, ix: 0x1234, hl_: 0x4321 });
  });

  it("END leaves from inside nested calls with the stack as the caller left it", async () => {
    const rig = await createRuntimeRig({
      uses: [],
      init: false,
      main: "    call Deeper",
      extra: ["Deeper:", "    push hl", "    push hl", "    ld bc,7", "    jp core.End"].join("\n")
    });
    expect(rig.call("Main", { iy: CALLER_IY }).bc).toBe(7); // rig.call checks SP
  });

  it("records the main program's baseline SP and runs it with IY = $5C3A", async () => {
    const rig = await createRuntimeRig({
      uses: [],
      init: false,
      main: ["    ld (SeenSP),sp", "    ld (SeenIY),iy"].join("\n"),
      extra: "SeenSP:\n    .defw 0\nSeenIY:\n    .defw 0"
    });
    const sp = rig.session.machine.sp;
    rig.call("Main", { iy: CALLER_IY });
    const s = rig.session;
    const p = rig.program;
    expect(s.peekWord(p.symbol("SeenSP"))).toBe(sp - 2);
    expect(s.peekWord(p.symbol("core.ProgramSP"))).toBe(sp - 2);
    expect(s.peekWord(p.symbol("SeenIY"))).toBe(0x5c3a);
  });

  it("calls every linked module's initialiser before the main program", async () => {
    const rig = await createRuntimeRig({
      uses: ["PrintStr", "Alloc"],
      init: false,
      main: "    ld hl,(core.FreeList)\n    ld (SeenFree),hl",
      extra: "SeenFree:\n    .defw 0"
    });
    rig.session.poke(0x5c88, [33 - 4, 24 - 2]);
    rig.runMain();
    expect(rig.session.peekWord(rig.program.symbol("SeenFree"))).toBe(rig.program.symbol("core.HeapStart"));
    expect(rig.session.peek(rig.program.symbol("core.PrintRow"))).toBe(2);
    expect(rig.session.peek(rig.program.symbol("core.PrintCol"))).toBe(4);
  });
});

describe("Klive BASIC runtime - rom", () => {
  it("RomCall passes every register and flag through and runs the routine with IY = $5C3A", async () => {
    const rig = await createRuntimeRig({
      uses: ["RomCall"],
      extra: [
        "CallIt:",
        "    call core.RomCall",
        "    .defw Target",
        "    ret",
        "Target:",
        "    ld (SeenIY),iy",
        "    ld (SeenHL),hl",
        "    ld (SeenDE),de",
        "    ld (SeenBC),bc",
        "    push af",
        "    pop hl",
        "    ld (SeenAF),hl",
        "    ld a,$99",
        "    ld bc,$1111",
        "    ld de,$2222",
        "    ld hl,$3333",
        "    scf",
        "    ret",
        "SeenIY: .defw 0",
        "SeenHL: .defw 0",
        "SeenDE: .defw 0",
        "SeenBC: .defw 0",
        "SeenAF: .defw 0"
      ].join("\n")
    });
    const r = rig.call("CallIt", { a: 0x42, f: 0x01, bc: 0xbbcc, de: 0xddee, hl: 0x1122, iy: CALLER_IY });
    const seen = (label: string) => rig.session.peekWord(rig.program.symbol(label));
    expect(seen("SeenIY")).toBe(0x5c3a);
    expect([seen("SeenHL"), seen("SeenDE"), seen("SeenBC")]).toEqual([0x1122, 0xddee, 0xbbcc]);
    expect(seen("SeenAF")).toBe(0x4201);
    expect(r).toMatchObject({ a: 0x99, bc: 0x1111, de: 0x2222, hl: 0x3333, iy: CALLER_IY });
    expect(r.f & 1, "carry comes back").toBe(1);
  });

  it("RomCall runs real ROM routines", async () => {
    const rig = await createRuntimeRig({
      uses: ["RomCall"],
      extra: [
        "PrintK:",
        "    di",
        "    ld iy,0",
        "    ld a,2",
        "    call core.RomCall",
        "    .defw $1601           ; CHAN-OPEN",
        "    ld a,'K'",
        "    call core.RomCall",
        "    .defw $0010           ; PRINT-A",
        "    ld (SeenIY),iy",
        "    ld iy,$5c3a",
        "    ei",
        "    ret",
        "SeenIY: .defw $ffff"
      ].join("\n")
    });
    rig.call("PrintK");
    expect(rig.session.screenChar(0, 0)).toBe("K");
    expect(rig.session.peekWord(rig.program.symbol("SeenIY"))).toBe(0);
  });
});

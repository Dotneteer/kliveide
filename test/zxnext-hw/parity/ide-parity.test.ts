import { describe, expect, it } from "vitest";

import { onEachCore, type NextTestSession } from "../../harness/zxnext";

/*
 * PAR-006: IDE state parity - the Next panels show the same thing whichever core runs.
 *
 * The Next Registers, Memory Mapping, Palettes and ULA & I/O panels read the machine through
 * `IZxNextIdeMachine` (`s.ideState()`). Both cores run the same program - palette writes to every
 * palette, the palette control and transparency registers, MMU paging, the border, EAR/MIC, a held
 * key - and must then report the same panel contents. As in the other PAR tests, the expectation is
 * the other core: a difference is a finding for one of them.
 */

/** Writes every one of the 8 palettes (`$43` bits 6-4) with a distinct pattern, then the control registers. */
const PROGRAM = `
        .org $8000
Start:  di
        ld e,0                  ; palette select 0..7 in bits 6-4 of $43
PalLoop:
        ld a,e
        rlca
        rlca
        rlca
        rlca
        and $70
        nextreg $43,a
        nextreg $40,0
        ld b,0                  ; 256 entries
        ld c,e
EntryLoop:
        ld a,b
        xor c
        add a,c
        nextreg $41,a           ; 8-bit writes
        djnz EntryLoop
        ld a,e
        and $01
        jr z,Nine
        nextreg $40,$10         ; and some 9-bit writes through $44
        nextreg $44,$a5
        nextreg $44,$01
        nextreg $44,$3c
        nextreg $44,$00
Nine:   inc e
        ld a,e
        cp 8
        jr nz,PalLoop
        nextreg $43,$2a         ; select palette 2, second Layer 2 + ULA palettes, ULANext off
        nextreg $4b,$17         ; sprite transparency index
        nextreg $4c,$09         ; tilemap transparency index
        nextreg $6b,$81         ; tilemap control
        nextreg $42,$0f         ; ULANext format
        nextreg $56,$20         ; MMU 6 -> page $20
        nextreg $57,$21         ; MMU 7 -> page $21
        ld a,$1d                ; border 5, EAR 1, MIC 1
        out ($fe),a
        nextreg $7f,$a5
        jr $
`;

async function ideAfterProgram(s: NextTestSession) {
  await s.loadCode(PROGRAM);
  s.runUntilReady();
  s.keyDown("A");
  s.runFrames(2);
  return s.ideState();
}

describe("PAR-006: the IDE panels show the same state on both cores", () => {
  it("palettes, memory mapping, register descriptors and ULA state agree", async () => {
    const r = await onEachCore(ideAfterProgram);

    expect(r.wasm.palette, "Next Palettes panel").toEqual(r.ts.palette);
    expect(r.wasm.memoryMapping, "Next Memory Mapping panel").toEqual(r.ts.memoryMapping);
    expect(r.wasm.descriptors, "Next Registers panel: descriptors").toEqual(r.ts.descriptors);
    expect(r.wasm.ula, "ULA & I/O panel").toEqual(r.ts.ula);
  });

  it("Next Registers panel: every register's value and last write agree", async () => {
    const r = await onEachCore(ideAfterProgram);
    const byId = (state: typeof r.ts.nextRegs) => new Map(state.regs.map((reg) => [reg.id, reg]));
    const ts = byId(r.ts.nextRegs);
    const wasm = byId(r.wasm.nextRegs);
    const diffs: string[] = [];
    for (const id of new Set([...ts.keys(), ...wasm.keys()])) {
      const a = ts.get(id);
      const b = wasm.get(id);
      if (a?.value !== b?.value || a?.lastWrite !== b?.lastWrite) {
        diffs.push(`$${id.toString(16).padStart(2, "0")}: value ${a?.value}/${b?.value} lastWrite ${a?.lastWrite}/${b?.lastWrite}`);
      }
    }
    expect(diffs, "reg: ts/wasm").toEqual([]);
    expect(r.wasm.nextRegs.lastRegisterIndex, "last register index").toBe(r.ts.nextRegs.lastRegisterIndex);
  });
});

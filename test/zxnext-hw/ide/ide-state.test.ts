import { describe, expect, it } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * IDE-001: the IDE's Next panels show the machine state the program set up.
 *
 * The Next Registers, Memory Mapping, Palettes and ULA & I/O panels read the machine through
 * `IZxNextIdeMachine` (`s.ideState()`, no side effects). The program writes every palette, the palette
 * control and transparency registers, MMU slots 6 and 7, the border and EAR/MIC, and a key is held;
 * every expectation below follows from those writes. (Until 2026-09-19 this compared the two cores'
 * panels, and found five differences on both - `.ai/wasm-migration-intent-and-lessons.md`.)
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

/** The 9-bit colour an 8-bit RRRGGGBB write stores: blue's low bit is the OR of the two blue bits. */
const nine = (rgb8: number) => ((rgb8 << 1) | ((rgb8 & 0x03) !== 0 ? 1 : 0)) & 0x1ff;

/**
 * Palette `sel` ($43 bits 6-4) after the program: entry i was written with B = (256 - i) & $ff, the
 * value (B xor sel) + sel; the odd palettes then got two 9-bit writes through $44 at entries 16-17.
 */
function expectedPalette(sel: number): number[] {
  const entries = Array.from({ length: 256 }, (_, i) => nine(((((256 - i) & 0xff) ^ sel) + sel) & 0xff));
  if (sel & 1) {
    entries[16] = (0xa5 << 1) | 1;
    entries[17] = 0x3c << 1;
  }
  return entries;
}

async function ideAfterProgram() {
  const s = await createSession();
  await s.loadCode(PROGRAM);
  s.runUntilReady();
  s.keyDown("A");
  s.runFrames(2);
  return s.ideState();
}

describe("IDE-001: the IDE panels show the machine state", () => {
  it("Next Palettes panel: all eight palettes and the control registers", async () => {
    const { palette } = await ideAfterProgram();
    const bySelect = [
      palette.ulaFirst, palette.layer2First, palette.spriteFirst, palette.tilemapFirst,
      palette.ulaSecond, palette.layer2Second, palette.spriteSecond, palette.tilemapSecond
    ];
    bySelect.forEach((entries, sel) => expect(Array.from(entries), `palette select ${sel}`).toEqual(expectedPalette(sel)));
    expect({
      stored: palette.storedPaletteValue,
      sprite: palette.spriteTransparencyIndex,
      tilemap: palette.tilemapTransparencyIndex,
      reg43: palette.reg43Value,
      reg6b: palette.reg6bValue,
      format: palette.ulaNextFormat
    }).toEqual({ stored: 0x3c, sprite: 0x17, tilemap: 0x09, reg43: 0x2a, reg6b: 0x81, format: 0x0f });
  });

  it("Next Memory Mapping panel: ROM, banks 5 and 2, and the paged MMU slots", async () => {
    const { memoryMapping: m } = await ideAfterProgram();
    expect(m.pageInfo.map((p) => p.bank8k), "8K page per slot (255: ROM)").toEqual([255, 255, 10, 11, 4, 5, 0x20, 0x21]);
    expect(m.pageInfo.slice(0, 2).map((p) => p.writeOffset), "the ROM is read-only").toEqual([null, null]);
    expect(m.pageInfo[6].readOffset + 0x2000, "slots 6 and 7 are consecutive pages").toBe(m.pageInfo[7].readOffset);
    expect([m.port7ffd, m.port1ffd, m.portDffd, m.portEff7, m.divMmcIn]).toEqual([0, 0, 0, 0, false]);
  });

  it("Next Registers panel: values, last CPU writes and descriptors", async () => {
    const { nextRegs, descriptors } = await ideAfterProgram();
    const reg = (id: number) => nextRegs.regs.find((r) => r.id === id);
    for (const [id, value] of [[0x42, 0x0f], [0x43, 0x2a], [0x4b, 0x17], [0x4c, 0x09], [0x56, 0x20], [0x57, 0x21], [0x6b, 0x81], [0x7f, 0xa5]]) {
      expect(reg(id), `$${id.toString(16)}`).toEqual({ id, value, lastWrite: value });
    }
    // --- $40 auto-increments past the two 9-bit entries written from 16
    expect(reg(0x40)).toEqual({ id: 0x40, value: 18, lastWrite: 0x10 });
    // --- read-only registers have no last write
    expect(reg(0x00)).toEqual({ id: 0x00, value: 0x08 });
    expect(descriptors.find((d) => d.id === 0x00)?.description).toBe("Machine ID");
    expect(new Set(nextRegs.regs.map((r) => r.id)), "one row per described register").toEqual(new Set(descriptors.map((d) => d.id)));
  });

  it("ULA & I/O panel: border, EAR/MIC and the held key", async () => {
    const { ula } = await ideAfterProgram();
    expect({ bor: ula.bor, ear: ula.ear, mic: ula.mic, keyLines: ula.keyLines }).toEqual({
      bor: "Cyan",
      ear: true,
      mic: true,
      keyLines: [0, 1, 0, 0, 0, 0, 0, 0]
    });
  });
});

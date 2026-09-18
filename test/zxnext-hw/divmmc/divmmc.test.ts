import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * DivMMC paging and automap (catalogue DIV-001 - DIV-013; DIV-014 is NMI-002).
 *
 * Hardware (`_input/next-fpga/src`):
 * - device/divmmc.vhd:
 *   - conmem = $E3 bit 7, mapram = bit 6. In $0000-$1FFF (page0) with conmem or automap: the DivMMC ROM
 *     when mapram = 0, RAM page 3 when mapram = 1. In $2000-$3FFF (page1): RAM page $E3 bits 3-0.
 *     Read-only: page0 always, and RAM page 3 wherever it is when mapram = 1.
 *   - automap_hold is updated at every opcode fetch (MREQ and M1 low): set by an entry point (instant or
 *     delayed), kept while held unless the fetch is a "delayed off" address; automap_held follows it once
 *     MREQ goes high, i.e. from the bytes after the opcode. automap = held, or an instant entry point
 *     during its own fetch. So: instant = the opcode at the entry point already comes from DivMMC;
 *     delayed = only that opcode comes from ROM (its operands come from DivMMC); off at $1FF8 = that
 *     opcode still comes from DivMMC, its operands from ROM.
 *   - hold, held and the NMI button latch are cleared by reset, `i_automap_reset` and RETN.
 * - zxnext.vhd:
 *   - ~4092: `divmmc_automap_reset` = port enable bit 8 ($83 bit 0) off or $0A bit 4 off; ~4125: the port
 *     enable also gates the paging (`i_en`); ~2564: and the $E3 port.
 *   - ~4155-4170: $E3 is cleared by `reset` (soft and hard reset alike); bit 6 (mapram) is sticky - a
 *     write ORs it in - and only a `$09` write with bit 3 clears it. It reads back bits 7-6 and 3-0.
 *   - ~2804-2864: entry points. RST $00-$38: $B8 enables, $B9 "valid" (1 = always, 0 = only with ROM 3),
 *     $BA instant (1) / delayed (0). $BB: bit 7 $3D00-$3DFF instant, 6 off at $1FF8-$1FFF, 5 $056A, 4 $04D7,
 *     3 $0562, 2 $04C6 (delayed, ROM 3 only), 1/0 $0066 instant/delayed (NMI button only). Reset values
 *     $B8 $83, $B9 $01, $BA $00, $BB $CD.
 *   - ~3036-3093: DivMMC can override any fetch in $0000-$3FFF (`sram_pre_override(2)`), unless the
 *     Multiface is paged; the "ROM 3" entry points also need the ROM itself there, and it must be ROM 3.
 */

// ---------------------------------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------------------------------

const E3 = 0x00e3;
const CONMEM = 0x80;
const MAPRAM = 0x40;

/** Marker byte at $1800 of RAM page 3: "the DivMMC is mapped". */
const MARK_ADDR = 0x1800;
const MARK = 0xa5;
/** `ld bc,$1122` at an entry point: BC = $1122 means the DivMMC supplied the opcode. */
const LD_BC = [0x01, 0x22, 0x11];
const BC_MARK = 0x1122;
/** `ld bc,$1122` at $0008 doubles as the operand address $1122 of ROM 3's `LD HL,(nn)` there; it holds $6677. */
const OPERAND_ADDR = 0x1122;
/** Where code goes after the DivMMC's `jp $8100`. */
const AFTER = 0x8100;

/** Entry points given `ld bc,$1122` in RAM page 3 (its $0000-$1FFF), each followed by `jp $8100`. */
const PAGE3_ENTRIES = [0x0000, 0x0008, 0x0010, 0x0038, 0x04c6, 0x04d7, 0x0562, 0x056a];

/**
 * A parked session with RAM page 3 set up as a "DivMMC ROM" (mapram mode), page 5 at $2000 holding
 * `ld bc,$1122` at $3D00, the Spectrum ROM 3 or ROM 0 selected, automap enabled, $E3 = mapram + page 5.
 */
async function divmmc(core: CoreName, opts: { rom3?: boolean } = {}): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(" .org $8000\n di\nPark: jr Park");
  const page3 = new Array(0x2000).fill(0x00);
  for (const e of PAGE3_ENTRIES) page3.splice(e, 6, ...LD_BC, 0xc3, AFTER & 0xff, AFTER >> 8);
  page3.splice(0x1ff8, 3, ...LD_BC);
  page3[MARK_ADDR] = MARK;
  page3.splice(OPERAND_ADDR, 2, 0x77, 0x66);
  s.out(E3, CONMEM | 3).poke(0x2000, page3);
  s.out(E3, CONMEM | 5).poke(0x2000, new Array(0x2000).fill(0x00)).poke(0x3d00, LD_BC);
  const rom3 = opts.rom3 ?? true;
  s.out(0x7ffd, rom3 ? 0x10 : 0x00).out(0x1ffd, rom3 ? 0x04 : 0x00);
  s.setNextReg(0x0a, s.readNextReg(0x0a) | 0x10);
  s.out(E3, MAPRAM | 5);
  return s;
}

/** The DivMMC is mapped: $1800 reads page 3's marker. */
const mapped = (s: NextTestSession) => s.peek(MARK_ADDR) === MARK;

/**
 * Loads `jp target` at $8000 (BC = 0) and `after` at $8100, runs to `target` and executes the
 * instruction there. Returns BC, PC and whether the DivMMC is mapped afterwards.
 */
async function fetchAt(s: NextTestSession, target: number, after = " jr $", prepare?: (s: NextTestSession) => void) {
  await s.loadCode(
    `
        .org $8000
Start:  di
        ld bc,0
        jp $${target.toString(16)}
        .org $8100
${after}`,
    { entry: "Start" }
  );
  prepare?.(s); // --- after the load, which resets the MMU
  s.runTo(target);
  const before = mapped(s);
  s.step(1);
  const r = s.registers();
  return { before, bc: r.bc, pc: r.pc, after: mapped(s) };
}

/** What `fetchAt` sees for an instant, a delayed and no automap at `e`. */
const INSTANT = (e: number) => ({ before: false, bc: BC_MARK, pc: e + 3, after: true });
const isDelayed = (r: { before: boolean; bc: number; after: boolean }) => !r.before && r.bc !== BC_MARK && r.after;
const isNone = (r: { before: boolean; bc: number; after: boolean }) => !r.before && r.bc !== BC_MARK && !r.after;

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("DivMMC - %s core", (core: CoreName) => {
  // --- DIV-001 - DIV-004: $E3 --------------------------------------------------------------------------

  it("DIV-001: conmem puts the DivMMC ROM (read-only) at $0000 and the selected RAM page at $2000", async () => {
    const t = await createSession(core);
    await t.loadCode(" .org $8000\n di\nPark: jr Park");
    const spectrum = Array.from(t.peekBytes(0x0000, 16));
    t.out(E3, CONMEM | 7);
    const divRom = Array.from(t.peekBytes(0x0000, 16));
    expect(divRom, "not the Spectrum ROM").not.toEqual(spectrum);
    t.poke(0x0000, divRom.map((b) => b ^ 0xff));
    expect(Array.from(t.peekBytes(0x0000, 16)), "read-only").toEqual(divRom);
    t.poke(0x2000, [0x12, 0x34]);
    expect(Array.from(t.peekBytes(0x2000, 2)), "RAM page 7 is writable").toEqual([0x12, 0x34]);
    t.out(E3, 0x07);
    expect(Array.from(t.peekBytes(0x0000, 16)), "conmem off: the Spectrum ROM").toEqual(spectrum);
    t.out(E3, CONMEM | 6);
    expect(Array.from(t.peekBytes(0x2000, 2)), "page 6 is another page").not.toEqual([0x12, 0x34]);
  });

  it("DIV-001: $E3 reads bits 7-6 and 3-0", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    s.out(E3, 0xb5);
    expect(s.in(E3)).toBe(0x85);
    s.out(E3, 0x0f);
    expect(s.in(E3)).toBe(0x0f);
  });

  it("DIV-002: the 16 RAM pages at $2000 are distinct", async () => {
    const s = await createSession(core);
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    for (let p = 0; p < 16; p++) s.out(E3, CONMEM | p).poke(0x2000, [p * 3 + 1, 0x80 | p]).poke(0x3fff, p * 5 + 2);
    const got = [];
    for (let p = 0; p < 16; p++) {
      s.out(E3, CONMEM | p);
      got.push([...s.peekBytes(0x2000, 2), s.peek(0x3fff)]);
    }
    expect(got).toEqual(Array.from({ length: 16 }, (_, p) => [p * 3 + 1, 0x80 | p, p * 5 + 2]));
  });

  it("DIV-003: mapram puts RAM page 3 read-only at $0000; it is sticky until $09 bit 3", async () => {
    const s = await divmmc(core);
    s.out(E3, CONMEM | MAPRAM | 0);
    s.poke(MARK_ADDR, 0x00);
    expect(s.peek(MARK_ADDR), "page 3 at $0000, read-only").toBe(MARK);
    s.out(E3, CONMEM | 0);
    expect(s.in(E3) & MAPRAM, "a write of 0 does not clear it").toBe(MAPRAM);
    expect(s.peek(MARK_ADDR), "still page 3").toBe(MARK);
    s.setNextReg(0x09, s.readNextReg(0x09) | 0x08);
    expect(s.in(E3) & MAPRAM, "$09 bit 3 clears it").toBe(0);
    expect(s.peek(MARK_ADDR), "the DivMMC ROM again").not.toBe(MARK);
  });

  it("DIV-004: with mapram, RAM page 3 is read-only at $2000 too; other pages stay writable", async () => {
    const s = await divmmc(core);
    s.out(E3, CONMEM | MAPRAM | 3);
    s.poke(0x2000 + MARK_ADDR, 0x00);
    expect(s.peek(0x2000 + MARK_ADDR), "page 3 at $2000").toBe(MARK);
    s.out(E3, CONMEM | MAPRAM | 4).poke(0x2000, 0x5a);
    expect(s.peek(0x2000), "page 4").toBe(0x5a);
    // --- through automap (conmem off) too
    await fetchAt(s, 0x0000);
    s.out(E3, MAPRAM | 3);
    s.poke(0x2000 + MARK_ADDR, 0x00);
    expect([mapped(s), s.peek(0x2000 + MARK_ADDR)], "automapped page 3 at $2000").toEqual([true, MARK]);
  });

  // --- DIV-005 - DIV-011: automap ----------------------------------------------------------------------

  it("DIV-005: automap only with $0A bit 4; clearing it unmaps at once", async () => {
    const s = await divmmc(core);
    s.setNextReg(0x0a, s.readNextReg(0x0a) & ~0x10);
    expect(isNone(await fetchAt(s, 0x0000)), "off").toBe(true);
    s.setNextReg(0x0a, s.readNextReg(0x0a) | 0x10);
    expect(isDelayed(await fetchAt(s, 0x0000)), "on").toBe(true);
    s.setNextReg(0x0a, s.readNextReg(0x0a) & ~0x10);
    expect(mapped(s), "automap reset").toBe(false);
  });

  for (const e of [0x0000, 0x0008, 0x0038, 0x04c6, 0x0562]) {
    it(`DIV-006: the reset entry points map at $${e.toString(16).padStart(4, "0")}, delayed`, async () => {
      const s = await divmmc(core);
      const r = await fetchAt(s, e);
      expect(isDelayed(r), JSON.stringify(r)).toBe(true);
    });
  }

  it("DIV-006: a delayed entry point takes only the opcode from ROM; its operands come from DivMMC", async () => {
    const s = await divmmc(core);
    expect(s.peekBytes(0x0008, 1)[0], "ROM 3 at $0008: LD HL,(nn)").toBe(0x2a);
    // --- DivMMC page 3 holds $22,$11 at $0009: the operand address $1122 (page 3 again), marked $6677
    await fetchAt(s, 0x0008);
    expect(s.registers().hl).toBe(0x6677);
  });

  it("DIV-006: RST $10 - $30 are not entry points after reset", async () => {
    for (const e of [0x0010, 0x0018, 0x0020, 0x0028, 0x0030]) {
      const s = await divmmc(core);
      expect(isNone(await fetchAt(s, e)), `$${e.toString(16)}`).toBe(true);
    }
  });

  it("DIV-007: a fetch in $3D00-$3DFF maps instantly with ROM 3, not with ROM 0", async () => {
    const s = await divmmc(core);
    expect(await fetchAt(s, 0x3d00)).toEqual(INSTANT(0x3d00));
    const t = await divmmc(core, { rom3: false });
    expect(isNone(await fetchAt(t, 0x3d00)), "ROM 0").toBe(true);
  });

  it("DIV-008: with $BB bit 6 a fetch at $1FF8 unmaps after its opcode: the operands come from ROM", async () => {
    const rom = await createSession(core);
    await rom.loadCode(" .org $8000\n di\nPark: jr Park");
    rom.out(0x7ffd, 0x10).out(0x1ffd, 0x04);
    const romWord = rom.peekWord(0x1ff9);

    const s = await divmmc(core);
    s.setNextReg(0xba, 0x01); // --- RST $00 instant: $0000 runs ld bc / jp $8100 from DivMMC
    const r = await fetchAt(s, 0x0000, " jp $1ff8");
    expect(r).toEqual(INSTANT(0x0000));
    s.runTo(0x1ff8);
    expect(mapped(s), "mapped on arrival").toBe(true);
    s.step(1);
    expect({ bc: s.registers().bc, pc: s.registers().pc, mapped: mapped(s) }).toEqual({ bc: romWord, pc: 0x1ffb, mapped: false });
  });

  it("DIV-008: without $BB bit 6 a fetch at $1FF8 keeps the DivMMC mapped", async () => {
    const s = await divmmc(core);
    s.setNextReg(0xba, 0x01).setNextReg(0xbb, 0x8d);
    await fetchAt(s, 0x0000, " jp $1ff8");
    s.runTo(0x1ff8).step(1);
    expect({ bc: s.registers().bc, mapped: mapped(s) }).toEqual({ bc: BC_MARK, mapped: true });
  });

  it("DIV-009: $B8-$BA program the RST entry points: enable, instant, always/ROM 3 only", async () => {
    let s = await divmmc(core);
    s.setNextReg(0xb8, 0x87).setNextReg(0xb9, 0x05).setNextReg(0xba, 0x04); // --- RST $10: on, always, instant
    expect(await fetchAt(s, 0x0010), "RST $10 instant").toEqual(INSTANT(0x0010));
    s = await divmmc(core);
    s.setNextReg(0xb8, 0x82);
    expect(isNone(await fetchAt(s, 0x0000)), "RST $00 disabled").toBe(true);
    s = await divmmc(core, { rom3: false });
    s.setNextReg(0xb9, 0x00);
    expect(isNone(await fetchAt(s, 0x0000)), "RST $00 ROM 3 only, ROM 0 paged").toBe(true);
    s = await divmmc(core, { rom3: false });
    expect(isDelayed(await fetchAt(s, 0x0000)), "RST $00 always (reset $B9)").toBe(true);
  });

  it("DIV-009: $BB bits 5/4 add $056A and $04D7; bits 3/2 remove $0562 and $04C6", async () => {
    const s = await divmmc(core);
    s.setNextReg(0xbb, 0xf1);
    expect(isDelayed(await fetchAt(s, 0x056a)), "$056A").toBe(true);
    const t = await divmmc(core);
    t.setNextReg(0xbb, 0xf1);
    expect(isDelayed(await fetchAt(t, 0x04d7)), "$04D7").toBe(true);
    const u = await divmmc(core);
    u.setNextReg(0xbb, 0xf1);
    expect(isNone(await fetchAt(u, 0x0562)), "$0562").toBe(true);
    const v = await divmmc(core);
    v.setNextReg(0xbb, 0xf1);
    expect(isNone(await fetchAt(v, 0x04c6)), "$04C6").toBe(true);
    const w = await divmmc(core);
    expect(isNone(await fetchAt(w, 0x056a)), "$056A off after reset").toBe(true);
  });

  it("DIV-010: RETN unmaps before the next fetch; conmem stays", async () => {
    const s = await divmmc(core);
    s.setNextReg(0xba, 0x01);
    await fetchAt(s, 0x0000, " ld hl,$8200\n push hl\n retn\n .org $8200\nBack: jr Back");
    s.runTo(0x8200);
    expect(mapped(s), "RETN").toBe(false);
    s.out(E3, CONMEM | MAPRAM | 5);
    await fetchAt(s, 0x0000, " ld hl,$8200\n push hl\n retn\n .org $8200\nBack: jr Back");
    s.runTo(0x8200);
    expect([mapped(s), s.in(E3) & CONMEM], "conmem is not automap").toEqual([true, CONMEM]);
  });

  it("DIV-010: a RETN into $0000-$3FFF fetches its next opcode from ROM", async () => {
    const s = await divmmc(core);
    s.setNextReg(0xba, 0x01);
    // --- RST $10 is not an entry point: page 3 holds ld bc,$1122 there, the ROM does not
    await fetchAt(s, 0x0000, " ld bc,0\n ld hl,$0010\n push hl\n retn");
    s.runTo(0x0010);
    expect(mapped(s), "unmapped on arrival").toBe(false);
    s.step(1);
    expect(s.registers().bc, "the ROM's instruction ran").not.toBe(BC_MARK);
  });

  it("DIV-010: RETI (ED 4D) and the RETN alias ED 55 do not unmap", async () => {
    for (const op of ["reti", ".defb $ed,$55"]) {
      const s = await divmmc(core);
      s.setNextReg(0xba, 0x01);
      await fetchAt(s, 0x0000, ` ld hl,$8200\n push hl\n ${op}\n .org $8200\nBack: jr Back`);
      s.runTo(0x8200);
      expect(mapped(s), op).toBe(true);
    }
  });

  it("DIV-011: ROM-3-only entry points need ROM 3 paged in at $0000; 'always' ones do not", async () => {
    const s = await divmmc(core, { rom3: false });
    expect(isNone(await fetchAt(s, 0x0008)), "RST $08, ROM 0").toBe(true);
    const ramAt0000 = (x: NextTestSession) => x.setNextReg(0x50, 0x20).setNextReg(0x51, 0x21); // --- zeroed RAM: NOPs
    const t = await divmmc(core);
    expect(isNone(await fetchAt(t, 0x0008, " jr $", ramAt0000)), "RST $08, RAM paged").toBe(true);
    const u = await divmmc(core);
    expect(isDelayed(await fetchAt(u, 0x0000, " jr $", ramAt0000)), "RST $00 (always), RAM paged").toBe(true);
  });

  // --- DIV-012 / DIV-013 --------------------------------------------------------------------------------

  it("DIV-012: with port enable bit 8 ($83 bit 0) off the DivMMC is gone and $E3 ignores writes", async () => {
    const s = await divmmc(core);
    const spectrum = s.peekBytes(0x0000, 8);
    s.out(E3, CONMEM | MAPRAM | 5);
    expect(mapped(s)).toBe(true);
    const e83 = s.readNextReg(0x83);
    s.setNextReg(0x83, e83 & ~0x01);
    expect(Array.from(s.peekBytes(0x0000, 8)), "no paging").toEqual(Array.from(spectrum));
    s.out(E3, 0x00);
    s.setNextReg(0x83, e83);
    expect(mapped(s), "the write was ignored: conmem still set").toBe(true);
    s.setNextReg(0x83, e83 & ~0x01);
    s.setNextReg(0x83, e83);
    expect(isDelayed(await fetchAt((s.out(E3, MAPRAM | 5), s), 0x0000)), "and automap works again").toBe(true);
  });

  it("DIV-013: a soft reset clears $E3, mapram included, and unmaps", async () => {
    const s = await divmmc(core);
    await fetchAt(s, 0x0000);
    s.out(E3, CONMEM | MAPRAM | 9);
    s.reset();
    await s.loadCode(" .org $8000\n di\nPark: jr Park");
    expect([s.in(E3), mapped(s)]).toEqual([0x00, false]);
  });
});

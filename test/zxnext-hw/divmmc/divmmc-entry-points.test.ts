import { describe, expect, it } from "vitest";

import { ALL_CORES, createSession, type CoreName, type NextTestSession } from "../../harness/zxnext";

/*
 * DivMMC automap entry points, ROM 3 gating, $1FF8 off, conmem sweep and the DivMMC NMI button
 * (catalogue DIV-020 - DIV-035). Ported from the TypeScript-only tests test/zxnext/DivMmmc.test.ts,
 * DivMmcDevice-regression.test.ts and DivMmcDevice-fpga.test.ts; `divmmc.test.ts` (DIV-001 - DIV-013)
 * has the rest.
 *
 * Hardware (`_input/next-fpga/src`):
 * - zxnext.vhd ~2804-2839: RST $00-$38 (A7-6 = 00, A2-0 = 000) pick bit n of $B8 (enable), $B9 (valid:
 *   1 = always, 0 = ROM 3 only) and $BA (timing: 1 instant, 0 delayed).
 *   ~2841-2843: always + enabled -> `divmmc_automap_instant_on` / `_delayed_on`.
 *   ~2847: `divmmc_automap_delayed_off` = $1FF8-$1FFF (A7-3 = 11111) and $BB bit 6.
 *   ~2849-2856: ROM-3-only RSTs, $3Dxx ($BB bit 7, instant), $04C6/$0562/$04D7/$056A ($BB bits 2/3/4/5,
 *   delayed) -> `divmmc_automap_rom3_*`.
 *   ~2863-2864: $0066 with $BB bit 1 (instant) / bit 0 (delayed) -> `divmmc_automap_nmi_*`.
 *   ~3092: `sram_divmmc_automap_en` = `sram_pre_override(2)` (any fetch in $0000-$3FFF);
 *   ~3093: `sram_divmmc_automap_rom3_en` also needs the ROM there (`sram_pre_override(0)`), ROM 3 (or an
 *   alt ROM standing in for it), no ROMCS and **no Layer 2 mapping** (`not sram_layer2_map_en`, ~3032:
 *   a read mapping counts on a fetch, a write-only mapping does not; in $0000-$3FFF every segment
 *   overrides, ~2998-3012).
 * - device/divmmc.vhd:
 *   - ~131-132: $0000-$1FFF is the DivMMC ROM when conmem ($E3 bit 7) or automap and not mapram,
 *     whatever $E3 bits 3-0 say; without conmem or automap nothing is paged.
 *   - ~142-153: `button_nmi` is set by `i_divmmc_button` (zxnext.vhd ~2126: a DivMMC NMI - DRIVE button or
 *     $02 bit 2 - accepted in state IDLE), cleared by reset, `i_automap_reset` ($0A bit 4 off / port
 *     enable off, zxnext.vhd ~4092) or RETN, and also once `automap_held` is set.
 *   - ~157-158: the $0066 entry points need `button_nmi`.
 *   - ~163-169: `automap_hold` at each opcode fetch; ~185: an instant entry maps during its own fetch.
 *   - ~187: `o_disable_nmi` (`divmmc_nmi_hold`) = automap or `button_nmi`.
 * - zxnext.vhd ~2051-2071: a Multiface NMI is latched only while `port_e3_reg(7)` and `divmmc_nmi_hold`
 *   are 0; a DivMMC NMI has no conmem condition. ~2074-2100: the NMI state machine stays in HOLD while
 *   the source holds, then END -> IDLE. ~3833-3842: the $02 bit 2 flag is set only while
 *   `nmi_accept_cause` (IDLE / FETCH), so it tells from outside whether the DivMMC still holds the NMI.
 */

// ---------------------------------------------------------------------------------------------------
// Scaffolding
// ---------------------------------------------------------------------------------------------------

const E3 = 0x00e3;
const CONMEM = 0x80;
const MAPRAM = 0x40;
const PARK = " .org $8000\n di\nPark: jr Park";

/** Marker byte at $1800 of RAM page 3: "the DivMMC is mapped". */
const MARK_ADDR = 0x1800;
const MARK = 0xa5;
/** `ld bc,$1122` at an entry point: BC = $1122 means the DivMMC supplied the opcode. */
const LD_BC = [0x01, 0x22, 0x11];
const BC_MARK = 0x1122;
const AFTER = 0x8100;
const LD_BC_JP_AFTER = [...LD_BC, 0xc3, AFTER & 0xff, AFTER >> 8];
const JP_HL = 0xe9;

/** Entry points given `ld bc,$1122 / jp $8100` in RAM page 3. */
const PAGE3_ENTRIES = [0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38, 0x0066, 0x04c6, 0x04d7, 0x0562, 0x056a];

type Patch = Array<[addr: number, bytes: number[]]>;

/**
 * A parked session with RAM page 3 set up as a "DivMMC ROM" (mapram mode) holding `ld bc,$1122 / jp $8100`
 * at every entry point, page 5 at $2000 (zeroed, plus `page5` patches at their CPU addresses), ROM 3 or
 * ROM 0 selected, automap enabled ($0A bit 4), $E3 = mapram + page 5.
 */
async function divmmc(core: CoreName, opts: { rom3?: boolean; page3?: Patch; page5?: Patch } = {}): Promise<NextTestSession> {
  const s = await createSession(core);
  await s.loadCode(PARK);
  const page3 = new Array(0x2000).fill(0x00);
  for (const e of PAGE3_ENTRIES) page3.splice(e, LD_BC_JP_AFTER.length, ...LD_BC_JP_AFTER);
  page3[MARK_ADDR] = MARK;
  for (const [a, bytes] of opts.page3 ?? []) page3.splice(a, bytes.length, ...bytes);
  s.out(E3, CONMEM | 3).poke(0x2000, page3);
  s.out(E3, CONMEM | 5).poke(0x2000, new Array(0x2000).fill(0x00));
  for (const [a, bytes] of opts.page5 ?? []) s.poke(a, bytes);
  const rom3 = opts.rom3 ?? true;
  s.out(0x7ffd, rom3 ? 0x10 : 0x00).out(0x1ffd, rom3 ? 0x04 : 0x00);
  s.setNextReg(0x0a, s.readNextReg(0x0a) | 0x10);
  s.out(E3, MAPRAM | 5);
  return s;
}

/** The DivMMC is mapped: $1800 reads page 3's marker. */
const mapped = (s: NextTestSession) => s.peek(MARK_ADDR) === MARK;

type Fetch = { before: boolean; bc: number; pc: number; after: boolean };

/** Loads `jp target` at $8000 (BC = 0) and `after` at $8100, runs to `target` and executes one instruction. */
async function fetchAt(s: NextTestSession, target: number, after = " jr $", prepare?: (s: NextTestSession) => void): Promise<Fetch> {
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

type Kind = "instant" | "delayed" | "none" | string;

/**
 * instant: the opcode at the entry point came from the DivMMC (BC = $1122) and it stays mapped;
 * delayed: the opcode came from the ROM, the DivMMC is mapped after it; none: neither.
 */
function kind(r: Fetch): Kind {
  if (!r.before && r.after && r.bc === BC_MARK) return "instant";
  if (!r.before && r.after && r.bc !== BC_MARK) return "delayed";
  if (!r.before && !r.after && r.bc !== BC_MARK) return "none";
  return `odd ${JSON.stringify(r)}`;
}

const hex = (v: number, w = 2) => `$${v.toString(16).toUpperCase().padStart(w, "0")}`;

/** Reads NextReg $02 bit 2 (the DivMMC NMI flag) into A. */
const READ_02_BIT2 = `
        ld bc,$243b
        ld a,$02
        out (c),a
        inc b
        in a,(c)
        and $04`;

// ---------------------------------------------------------------------------------------------------

describe.each(ALL_CORES)("DivMMC entry points - %s core", (core: CoreName) => {
  // --- DIV-020: the RST matrix --------------------------------------------------------------------------

  /** $B8 / $B9 / $BA bit n, the ROM paged in, and what zxnext.vhd ~2841-2856 make of it. */
  const RST_CASES: Array<{ name: string; enabled: boolean; always: boolean; instant: boolean; rom3: boolean; expected: Kind }> = [
    { name: "disabled ($B8 bit clear)", enabled: false, always: true, instant: true, rom3: true, expected: "none" },
    { name: "always, instant, ROM 0", enabled: true, always: true, instant: true, rom3: false, expected: "instant" },
    { name: "always, delayed, ROM 0", enabled: true, always: true, instant: false, rom3: false, expected: "delayed" },
    { name: "ROM 3 only, instant, ROM 0", enabled: true, always: false, instant: true, rom3: false, expected: "none" },
    { name: "ROM 3 only, delayed, ROM 0", enabled: true, always: false, instant: false, rom3: false, expected: "none" },
    { name: "ROM 3 only, instant, ROM 3", enabled: true, always: false, instant: true, rom3: true, expected: "instant" },
    { name: "ROM 3 only, delayed, ROM 3", enabled: true, always: false, instant: false, rom3: true, expected: "delayed" }
  ];

  for (let n = 0; n < 8; n++) {
    it(`DIV-020: RST ${hex(n * 8)} follows $B8/$B9/$BA bit ${n} and the ROM 3 gate`, async () => {
      const got: Record<string, Kind> = {};
      const want: Record<string, Kind> = {};
      for (const c of RST_CASES) {
        const s = await divmmc(core, { rom3: c.rom3 });
        const bit = 1 << n;
        s.setNextReg(0xb8, c.enabled ? bit : 0).setNextReg(0xb9, c.always ? bit : 0).setNextReg(0xba, c.instant ? bit : 0);
        got[c.name] = kind(await fetchAt(s, n * 8));
        want[c.name] = c.expected;
      }
      expect(got).toEqual(want);
    });
  }

  // --- DIV-021: $BB ROM 3 entry points -------------------------------------------------------------------

  it("DIV-021: $04C6, $0562, $04D7 and $056A map (delayed) only with ROM 3 paged in", async () => {
    // --- zxnext.vhd ~2854-2856: ROM-3 entry points; ~3093: need sram_pre_rom3
    const got: Record<string, Kind> = {};
    const want: Record<string, Kind> = {};
    for (const [e, bit] of [[0x04c6, 2], [0x0562, 3], [0x04d7, 4], [0x056a, 5]]) {
      for (const rom3 of [false, true]) {
        const s = await divmmc(core, { rom3 });
        s.setNextReg(0xbb, 0x80 | (1 << bit));
        got[`${hex(e, 4)} ROM ${rom3 ? 3 : 0}`] = kind(await fetchAt(s, e));
        want[`${hex(e, 4)} ROM ${rom3 ? 3 : 0}`] = rom3 ? "delayed" : "none";
      }
    }
    expect(got).toEqual(want);
  });

  // --- DIV-022: $3D00-$3DFF --------------------------------------------------------------------------------

  it("DIV-022: $3D00-$3DFF is an instant entry point (ROM 3, $BB bit 7); $3CFF and $3E00 are not", async () => {
    // --- zxnext.vhd ~2851: port_3dxx_msb and $BB bit 7 -> rom3 instant; the opcode already comes from page 5
    const got: Record<string, Kind> = {};
    const want: Record<string, Kind> = {};
    const cases: Array<[addr: number, bb: number, expected: Kind]> = [
      [0x3d00, 0xcd, "instant"],
      [0x3d80, 0xcd, "instant"],
      [0x3dff, 0xcd, "instant"],
      [0x3cff, 0xcd, "none"],
      [0x3e00, 0xcd, "none"],
      [0x3d80, 0x4d, "none"] // --- $BB bit 7 clear
    ];
    for (const [addr, bb, expected] of cases) {
      const s = await divmmc(core, { page5: [[addr, LD_BC]] });
      s.setNextReg(0xbb, bb);
      const key = `${hex(addr, 4)} $BB=${hex(bb)}`;
      got[key] = kind(await fetchAt(s, addr));
      want[key] = expected;
    }
    expect(got).toEqual(want);
  });

  it("DIV-022: $3Dxx needs ROM 3: with ROM 0 paged in, no fetch in $3D00-$3DFF maps", async () => {
    const got: Kind[] = [];
    for (const addr of [0x3d00, 0x3d80, 0x3dff]) {
      const s = await divmmc(core, { rom3: false, page5: [[addr, LD_BC]] });
      got.push(kind(await fetchAt(s, addr)));
    }
    expect(got).toEqual(["none", "none", "none"]);
  });

  it("DIV-022: an instant $3Dxx mapping stays after the CPU leaves the range", async () => {
    const s = await divmmc(core, { page5: [[0x3dfd, [0x00, 0x00, 0x00, ...LD_BC]]] }); // --- NOPs, then ld bc at $3E00
    await fetchAt(s, 0x3dfd);
    s.step(3); // --- $3DFE, $3DFF, then the ld bc at $3E00 - outside the range
    expect({ bc: s.registers().bc, pc: s.registers().pc, mapped: mapped(s) }).toEqual({ bc: BC_MARK, pc: 0x3e03, mapped: true });
  });

  // --- DIV-023: $1FF8-$1FFF --------------------------------------------------------------------------------

  for (const [addr, stays] of [[0x1ff7, true], [0x1ff8, false], [0x1ffc, false], [0x1fff, false]] as Array<[number, boolean]>) {
    it(`DIV-023: with ROM 0 paged in, a fetch at ${hex(addr, 4)} ${stays ? "keeps the DivMMC" : "unmaps after its opcode"}`, async () => {
      // --- zxnext.vhd ~2847: A7-3 = 11111 and $BB bit 6 (set after reset: $CD); it is an i_automap_active
      // --- term, not a ROM 3 one; divmmc.vhd ~168 + ~185: that opcode still comes from DivMMC (jp (hl))
      const s = await divmmc(core, { rom3: false, page3: [[addr, [JP_HL]]] });
      s.setNextReg(0xba, 0x01); // --- RST $00 instant
      const r = await fetchAt(s, 0x0000, ` ld hl,$8200\n jp $${addr.toString(16)}\n .org $8200\nBack: jr Back`);
      expect(kind(r), "RST $00 instant").toBe("instant");
      s.runTo(addr);
      expect(mapped(s), "mapped on arrival").toBe(true);
      s.step(1);
      expect({ pc: s.registers().pc, mapped: mapped(s) }).toEqual({ pc: 0x8200, mapped: stays });
    });
  }

  // --- DIV-024: Layer 2 mapping over the ROM ----------------------------------------------------------------

  /**
   * Fetches at `target` with port $123B = `port123b` (Layer 2 mapping) and reports whether the DivMMC is
   * mapped afterwards. zxnext.vhd ~3093: `not sram_layer2_map_en` is in the ROM 3 term only; ~3032: a
   * fetch is a read, so only $123B bit 2 (read mapping) counts; ~2998-3012 with ~2922: in $0000-$3FFF
   * every segment overrides (00/01/10 = the 1st/2nd/3rd 16K of Layer 2 there, 11 = the first 48K).
   */
  async function throughLayer2(target: number, port123b: number): Promise<boolean> {
    const s = await divmmc(core);
    // --- The code runs from $C000: segment 3 maps Layer 2 over $0000-$BFFF for reads.
    await s.loadCode(
      `
        .org $c000
Start:  di
        ld bc,0
        jp $${target.toString(16)}
        .org $c100
Park:   jr Park`,
      { entry: "Start" }
    );
    // --- Layer 2 in banks 8-10 (pages 16, 18, 20 start them): zero the bytes the fetch can land on (NOPs)
    s.setNextReg(0x12, 8);
    for (const page of [16, 18, 20]) s.setNextReg(0x57, page).poke(0xe000, new Array(0x100).fill(0));
    s.setNextReg(0x57, 1);
    s.out(0x123b, port123b);
    s.runTo(target);
    s.step(1);
    s.out(0x123b, 0x00); // --- unmap Layer 2 before looking at $1800
    return mapped(s);
  }

  // Parity finding, fixed 2026-09-19: the WASM core ignores Layer 2 when it decides "ROM 3 present"
  // (zxnext-divmmc.c zxnextDivMmcRom3Present checks only MMU = $FF and the selected ROM), so a ROM 3
  // entry point still maps under a Layer 2 read mapping. VHDL: zxnext.vhd ~3093 `not sram_layer2_map_en`.
  it("DIV-024: a Layer 2 read mapping over $0000 (segment 0 or 48K) disables the ROM 3 entry points", async () => {
    expect({
      "RST $08, Layer 2 read, segment 0": await throughLayer2(0x0008, 0x04),
      "RST $08, Layer 2 read, segment 3 (48K)": await throughLayer2(0x0008, 0xc4)
    }).toEqual({
      "RST $08, Layer 2 read, segment 0": false,
      "RST $08, Layer 2 read, segment 3 (48K)": false
    });
  });

  // Parity finding, fixed 2026-09-19 (both cores): segments 1 and 2 also put Layer 2 at $0000-$3FFF (ports.txt $123B bits
  // 7-6; zxnext.vhd ~2922 offset = segment, ~2998-3012 override(1) = 1 in $0000-$3FFF), so they block the
  // ROM 3 entry points too (~3093). The TypeScript core's DivMmcDevice.isRom3AutomapActive checks only
  // segments 0 and 3; the WASM core checks no Layer 2 mapping at all.
  it("DIV-024: Layer 2 read segments 1 and 2 are over $0000 too and disable the ROM 3 entry points", async () => {
    expect({
      "RST $08, Layer 2 read, segment 1": await throughLayer2(0x0008, 0x44),
      "RST $08, Layer 2 read, segment 2": await throughLayer2(0x0008, 0x84)
    }).toEqual({
      "RST $08, Layer 2 read, segment 1": false,
      "RST $08, Layer 2 read, segment 2": false
    });
  });

  it("DIV-024: a write-only Layer 2 mapping does not disable them, and 'always' entry points ignore Layer 2", async () => {
    expect({
      "RST $08 (ROM 3 only), no Layer 2 mapping": await throughLayer2(0x0008, 0x00),
      "RST $08, Layer 2 write-only, segment 0": await throughLayer2(0x0008, 0x01),
      "RST $00 (always), Layer 2 read, segment 0": await throughLayer2(0x0000, 0x04),
      "RST $00 (always), Layer 2 read, segment 3": await throughLayer2(0x0000, 0xc4)
    }).toEqual({
      "RST $08 (ROM 3 only), no Layer 2 mapping": true,
      "RST $08, Layer 2 write-only, segment 0": true,
      "RST $00 (always), Layer 2 read, segment 0": true,
      "RST $00 (always), Layer 2 read, segment 3": true
    });
  });

  // --- DIV-025: conmem sweep -------------------------------------------------------------------------------

  it("DIV-025: without conmem no $E3 value pages anything in; with conmem every RAM bank value gives the DivMMC ROM", async () => {
    // --- divmmc.vhd ~131-133: page 0 is the ROM for conmem (or automap) and not mapram, whatever bits 3-0 say
    const s = await createSession(core);
    await s.loadCode(PARK);
    const spectrum = Array.from(s.peekBytes(0x0000, 8));
    const spectrum2000 = Array.from(s.peekBytes(0x2000, 8));
    // --- The DivMMC ROM through config mode ($04 = 4: SRAM $010000), as the firmware loads it
    const divRom = Array.from({ length: 8 }, (_, i) => (i * 41 + 3) & 0xff);
    const type = s.readNextReg(0x03) & 0x07;
    s.setNextReg(0x03, 0x07).setNextReg(0x04, 4).poke(0x0000, divRom).setNextReg(0x03, type);
    const wrongOff: string[] = [];
    for (let v = 0x00; v <= 0x3f; v++) {
      s.out(E3, v);
      if (JSON.stringify(Array.from(s.peekBytes(0x0000, 8))) !== JSON.stringify(spectrum)) wrongOff.push(hex(v));
      if (JSON.stringify(Array.from(s.peekBytes(0x2000, 8))) !== JSON.stringify(spectrum2000)) wrongOff.push(`${hex(v)}@$2000`);
    }
    const wrongOn: string[] = [];
    for (let v = 0x80; v <= 0xbf; v++) {
      s.out(E3, v);
      if (JSON.stringify(Array.from(s.peekBytes(0x0000, 8))) !== JSON.stringify(divRom)) wrongOn.push(hex(v));
    }
    expect({ wrongOff, wrongOn }).toEqual({ wrongOff: [], wrongOn: [] });
  });

  // --- DIV-030 - DIV-035: the NMI entry point and the DivMMC button latch ---------------------------------

  it("DIV-030: without a DivMMC NMI, a fetch at $0066 does not map even with $BB bits 1 and 0", async () => {
    // --- divmmc.vhd ~157-158: the $0066 entry points are ANDed with button_nmi
    const s = await divmmc(core);
    s.setNextReg(0xbb, 0xcf);
    expect(kind(await fetchAt(s, 0x0066))).toBe("none");
  });

  /** Raises a DivMMC NMI through $02 bit 2 ($06 bit 4 set) and executes the instruction at $0066. */
  async function nmiFetch(s: NextTestSession): Promise<Fetch> {
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld sp,$bff0
        ld bc,0
        nextreg $06,$10
        nextreg $02,$04
Wait:   jr Wait
        .org $8100
After:  jr After`,
      { entry: "Start" }
    );
    s.runTo(0x0066, { maxFrames: 2 });
    const before = mapped(s);
    s.step(1);
    const r = s.registers();
    return { before, bc: r.bc, pc: r.pc, after: mapped(s) };
  }

  /** $BB bits 1-0 -> what the $0066 fetch after a DivMMC NMI does (zxnext.vhd ~2863-2864, divmmc.vhd ~157-158, ~166, ~185). */
  async function nmiEntries(rom3: boolean): Promise<Record<string, Kind>> {
    const got: Record<string, Kind> = {};
    for (const bits of [0b10, 0b01, 0b11, 0b00]) {
      const s = await divmmc(core, { rom3 });
      s.setNextReg(0xbb, 0x4c | bits);
      got[`$BB bits 1-0 = ${bits.toString(2).padStart(2, "0")}`] = kind(await nmiFetch(s));
    }
    return got;
  }
  const NMI_ENTRIES = {
    "$BB bits 1-0 = 10": "instant",
    "$BB bits 1-0 = 01": "delayed",
    "$BB bits 1-0 = 11": "instant",
    "$BB bits 1-0 = 00": "none"
  };

  it("DIV-031: after a DivMMC NMI, $0066 maps as $BB bits 1 (instant) / 0 (delayed) say", async () => {
    expect(await nmiEntries(true)).toEqual(NMI_ENTRIES);
  });

  // Parity finding, fixed 2026-09-19: with ROM 0 paged in, the ROM has ED 45 (RETN) at $0066. The WASM core decides "this
  // instruction is RETN" by peeking the bytes at PC through the mapping *before* the fetch
  // (zxnext-cpu.c zxnextCpuExecuteInstruction, isRetnInstruction), so it sees the ROM's RETN although the
  // DivMMC supplied the opcode (instant: ld bc,$1122) or the second byte (delayed: ED 22, an ED NOP), and
  // unmaps the DivMMC at once. VHDL: retn_seen comes from the decoded instruction (t80n / im2_control
  // o_retn_seen, zxnext.vhd ~1866-1882, ~4090); the NMI entry points are i_automap_active terms that
  // need no ROM 3 (divmmc.vhd ~166).
  it("DIV-031: the $0066 entry points need no ROM 3: the same with ROM 0 paged in", async () => {
    expect(await nmiEntries(false)).toEqual(NMI_ENTRIES);
  });

  it("DIV-031: the DRIVE button (F10) arms the $0066 entry point too", async () => {
    // --- zxnext.vhd ~2046: hotkey_drive and $06 bit 4 -> nmi_assert_divmmc -> nmi_divmmc_button (~2126)
    const s = await divmmc(core);
    s.setNextReg(0xbb, 0x4e);
    await s.loadCode(" .org $8000\nStart: di\n ld sp,$bff0\n ld bc,0\nWait: jr Wait\n .org $8100\nAfter: jr After", { entry: "Start" });
    s.setNextReg(0x06, 0x10).runFrames(1);
    await s.pressHotkey("F10");
    s.runTo(0x0066, { maxFrames: 2 });
    const before = mapped(s);
    s.step(1);
    expect(kind({ before, bc: s.registers().bc, pc: s.registers().pc, after: mapped(s) })).toBe("instant");
  });

  /**
   * A DivMMC NMI with no automap at $0066 ($BB bits 1-0 clear) into a RAM handler (MMU0/1 = pages 40/41).
   * The handler turns $06 bit 4 off, then probes the $02 flag (a set flag = the state machine is IDLE/FETCH
   * again, i.e. the DivMMC no longer holds the NMI); `extra` runs before RETN. After RETN, main probes again.
   */
  async function buttonLatch(extra: string): Promise<{ inHold: number; inExtra: number; afterRetn: number }> {
    const s = await divmmc(core);
    s.setNextReg(0xbb, 0x4c);
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld sp,$bff0
        nextreg $06,$10
        nextreg $02,$04            ; DivMMC NMI: latches button_nmi
        nop
        nop
        nextreg $02,$00
        nextreg $02,$04            ; $06 bit 4 is off by now: only the flag
${READ_02_BIT2}
        ld (AfterRetn),a
        nextreg $7f,$a5
Park:   jr Park

NmiEntry:
        nextreg $06,$00
        nextreg $02,$00
        nextreg $02,$04
${READ_02_BIT2}
        ld (InHold),a
${extra}
        retn

InHold:    .defb $ff
InExtra:   .defb $ff
AfterRetn: .defb $ff
`,
      { entry: "Start" }
    );
    s.setNextReg(0x50, 40).setNextReg(0x51, 41);
    const entry = s.symbol("NmiEntry");
    s.poke(0x0066, [0xc3, entry & 0xff, entry >> 8]);
    s.runUntilReady({ maxFrames: 4 });
    return { inHold: s.peek(s.symbol("InHold")), inExtra: s.peek(s.symbol("InExtra")), afterRetn: s.peek(s.symbol("AfterRetn")) };
  }

  it("DIV-032: the DivMMC button latch holds the NMI until RETN", async () => {
    // --- divmmc.vhd ~145-148, ~187: button_nmi -> divmmc_nmi_hold keeps HOLD; RETN clears it -> IDLE
    expect(await buttonLatch("")).toEqual({ inHold: 0x00, inExtra: 0xff, afterRetn: 0x04 });
  });

  it("DIV-032: turning automap off ($0A bit 4) clears the button latch at once", async () => {
    // --- divmmc.vhd ~145: i_automap_reset clears button_nmi (zxnext.vhd ~4092: $0A bit 4 = 0)
    const r = await buttonLatch(`
        ld bc,$243b
        ld a,$0a
        out (c),a
        inc b
        in a,(c)
        and $ef
        out (c),a
        nextreg $02,$00
        nextreg $02,$04
${READ_02_BIT2}
        ld (InExtra),a`);
    expect(r).toEqual({ inHold: 0x00, inExtra: 0x04, afterRetn: 0x04 });
  });

  for (const offAt1ff8 of [true, false]) {
    it(`DIV-033: an automap taken at $0066 clears the button latch: ${offAt1ff8 ? "leaving at $1FF8 releases the NMI" : "while mapped the NMI stays held"}`, async () => {
      // --- divmmc.vhd ~149-150: automap_held clears button_nmi; ~168: $1FF8 ($BB bit 6) drops automap;
      // --- ~187: then nothing holds the NMI, HOLD -> END -> IDLE (zxnext.vhd ~2090-2100) and the $02 flag sets
      const s = await divmmc(core, {
        page3: [
          [0x0066, [0x21, 0x00, 0x81, 0xc3, 0xf8, 0x1f]], // --- ld hl,$8100 / jp $1ff8
          [0x1ff8, [JP_HL]]
        ]
      });
      s.setNextReg(0xbb, (offAt1ff8 ? 0x40 : 0x00) | 0x02); // --- $0066 instant
      await s.loadCode(
        `
        .org $8000
Start:  di
        ld sp,$bff0
        nextreg $06,$10
        nextreg $02,$04
Wait:   jr Wait
        .org $8100
Cont:   nextreg $06,$00
        nextreg $02,$00
        nextreg $02,$04
${READ_02_BIT2}
        ld (Flag),a
        nextreg $7f,$a5
Park:   jr Park
Flag:   .defb $ff`,
        { entry: "Start" }
      );
      s.runUntilReady({ maxFrames: 4 });
      expect({ flag: s.peek(s.symbol("Flag")), mapped: mapped(s) }).toEqual(
        offAt1ff8 ? { flag: 0x04, mapped: false } : { flag: 0x00, mapped: true }
      );
    });
  }

  it("DIV-034: while the DivMMC is automapped a Multiface NMI is refused; after RETN it is taken", async () => {
    // --- zxnext.vhd ~2063: nmi_mf only when divmmc_nmi_hold = 0; divmmc.vhd ~187: automap holds
    const s = await divmmc(core);
    s.setNextReg(0xba, 0x01); // --- RST $00 instant
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld sp,$bff0
        jp $0000                   ; -> DivMMC: ld bc,$1122 / jp $8100
        .org $8100
        nextreg $06,$08            ; M1 (Multiface) NMI enable
        nextreg $02,$08            ; Multiface NMI request
        nop
        nop
        nop
        ld a,1
        ld (NoNmi),a
        nextreg $7f,$a5
W1:     ld a,(Go)
        or a
        jr z,W1
        ld hl,Ph2
        push hl
        retn                       ; unmaps the DivMMC
Ph2:    nextreg $02,$08
        nop
        nop
        ld a,1
        ld (Missed),a
P2:     jr P2
NoNmi:  .defb 0
Missed: .defb 0
Go:     .defb 0`,
      { entry: "Start" }
    );
    s.runUntilReady({ maxFrames: 3 });
    expect({ noNmi: s.peek(s.symbol("NoNmi")), mapped: mapped(s) }, "refused while automapped").toEqual({ noNmi: 1, mapped: true });
    s.poke(s.symbol("Go"), 1);
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.peek(s.symbol("Missed")), "taken after RETN").toBe(0);
  });

  it("DIV-035: a DivMMC NMI is accepted while conmem is set (unlike a Multiface one)", async () => {
    // --- zxnext.vhd ~2065: nmi_divmmc has no port_e3_reg(7) condition; conmem is not part of
    // --- divmmc_nmi_hold (divmmc.vhd ~187). With conmem + mapram, $0066 is page 3: ld bc,$1122.
    const s = await divmmc(core);
    s.setNextReg(0xbb, 0x4c); // --- no $0066 automap: the opcode comes through conmem
    await s.loadCode(
      `
        .org $8000
Start:  di
        ld sp,$bff0
        ld bc,0
        nextreg $06,$10
        nextreg $02,$04
Wait:   jr Wait
        .org $8100
After:  jr After`,
      { entry: "Start" }
    );
    s.out(E3, CONMEM | MAPRAM | 5);
    s.runTo(0x0066, { maxFrames: 2 });
    expect(s.registers().sp, "the NMI pushed its return address").toBe(0xbff0 - 2);
    s.step(1);
    expect(s.registers().bc).toBe(BC_MARK);
  });
});

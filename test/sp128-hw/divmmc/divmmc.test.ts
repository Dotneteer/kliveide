import { describe, expect, it } from "vitest";

import { createSp128Session, type Sp128TestSession } from "../../harness/sp128";
import { DIVMMC_ROM_SIZE } from "@emu/machines/zxSpectrum/divmmc/divMmcCoreBridge";
import { buildDivMmcTestRom, COUNTER, TRAP_3D_CODE } from "./divmmc-test-rom";

/*
 * The DivMMC on the classic machines (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C4), on the real
 * 128K and +2A cores: port $E3, the automap's entry points with the VHDL's reset configuration, the
 * NMI button and RETN, and the SD card over SPI with the host answering its sectors. The interface's
 * ROM is a test ROM (`divmmc-test-rom.ts`) that counts the entries in its RAM bank 0.
 */

type Exports = Record<string, (...args: number[]) => number>;

const CODE = 0x8000;
const BUFFER = 0x9000;

async function withDivMmc(model: "sp128" | "plus2a"): Promise<{ s: Sp128TestSession; x: Exports; p: string }> {
  const s = await createSp128Session(model);
  const p = model === "sp128" ? "sp128" : "spp3e";
  const x = s.machine.wasmV2Runtime!.exports as unknown as Exports;
  s.machine.divMmc.uploadRom(await buildDivMmcTestRom());
  x[`${p}DivMmcSetPresent`](1);
  x[`${p}Reset`]();
  s.machine.pc = 0;
  return { s, x, p };
}

/** The interface's memory: a counter in RAM bank 0 */
function counter(s: Sp128TestSession, at: number): number {
  return s.machine.divMmc.memory![at - 0x2000 + DIVMMC_ROM_SIZE];
}

/** Runs code at $8000 with interrupts off, the 48K BASIC ROM paged in (or not), to its `JR $` */
function run(s: Sp128TestSession, x: Exports, p: string, body: number[], { rom3 = true, maxFrames = 20 } = {}) {
  const plus3 = p === "spp3e";
  const paging = [
    0x01, 0xfd, 0x7f, 0x3e, rom3 ? 0x10 : 0x00, 0xed, 0x79, // LD BC,$7FFD / LD A,$10|$00 / OUT (C),A
    ...(plus3 ? [0x01, 0xfd, 0x1f, 0x3e, rom3 ? 0x04 : 0x00, 0xed, 0x79] : []) // $1FFD bit 2: ROM 2/3
  ];
  const code = [0xf3, 0x31, 0x00, 0x90, ...paging, ...body, 0x18, 0xfe];
  s.poke(CODE, code);
  x[`${p}SetCpuHalted`](0);
  x[`${p}SetCpuIff1`](0);
  x[`${p}SetCpuIff2`](0);
  s.machine.pc = CODE;
  s.runTo(CODE + code.length - 2, { maxFrames });
}

describe("DivMMC on the 128K and the +2A", () => {
  for (const model of ["sp128", "plus2a"] as const) {
    it(`${model}: boots through the RST $00 trap, then runs the machine's own ROM`, async () => {
      const { s, x, p } = await withDivMmc(model);
      s.runFrames(50);
      expect(counter(s, COUNTER.reset)).toBe(1);
      expect(x[`${p}DivMmcGetMapped`]()).toBe(0);
    }, 120_000);

    it(`${model}: RST $08 maps it (delayed) with the 48K BASIC ROM in, and the $1FF8 area unmaps it`, async () => {
      const { s, x, p } = await withDivMmc(model);
      s.runFrames(50);
      run(s, x, p, [0xcf, 0x00]); // RST $08 / a function byte the handler ignores
      expect(counter(s, COUNTER.rst8)).toBe(1);
      expect(x[`${p}DivMmcGetMapped`]()).toBe(0);
      // --- A fetch at $0008 with the 128K editor ROM (+3: ROM 0) in leaves it unmapped; with the
      // --- 48K BASIC ROM in it maps after the fetch
      run(s, x, p, [], { rom3: false });
      s.machine.pc = 0x0008;
      s.step(1);
      expect(x[`${p}DivMmcGetMapped`]()).toBe(0);
      run(s, x, p, []);
      s.machine.pc = 0x0008;
      s.step(1);
      expect(x[`${p}DivMmcGetMapped`]()).toBe(1);
    }, 120_000);

    it(`${model}: $3Dxx maps it instantly, from its RAM`, async () => {
      const { s, x, p } = await withDivMmc(model);
      s.runFrames(50);
      s.machine.divMmc.memory!.set(TRAP_3D_CODE, DIVMMC_ROM_SIZE + 0x1d00);
      run(s, x, p, [0xcd, 0x00, 0x3d]); // CALL $3D00
      expect(counter(s, COUNTER.trap3d)).toBe(1);
      expect(x[`${p}DivMmcGetMapped`]()).toBe(0);
    }, 120_000);

    it(`${model}: the NMI button maps it at $0066, and RETN unmaps it`, async () => {
      const { s, x, p } = await withDivMmc(model);
      s.runFrames(50);
      // --- A loop in RAM, the 48K ROM in (its $0066 is PUSH AF)
      run(s, x, p, []);
      x[`${p}DivMmcPressNmi`]();
      s.step(20);
      expect(counter(s, COUNTER.nmi)).toBe(1);
      expect(x[`${p}DivMmcGetMapped`]()).toBe(0);
      expect(s.cpu().pc).toBeGreaterThanOrEqual(CODE);
    }, 120_000);

    it(`${model}: port $E3 - conmem, the banks, MAPRAM's read-only bank 3`, async () => {
      const { s, x, p } = await withDivMmc(model);
      s.runFrames(50);
      run(s, x, p, [
        0x3e, 0x81, 0xd3, 0xe3, //       LD A,$81 / OUT ($E3),A  (conmem, bank 1)
        0x3a, 0x00, 0x00, 0x32, 0x00, 0x91, // LD A,($0000) / LD ($9100),A
        0x3e, 0x55, 0x32, 0x00, 0x20, // LD A,$55 / LD ($2000),A
        0x3e, 0x99, 0x32, 0x00, 0x00, // LD A,$99 / LD ($0000),A  (the ROM ignores it)
        0xdb, 0xe3, 0x32, 0x01, 0x91, // IN A,($E3) / LD ($9101),A
        0x3e, 0x00, 0xd3, 0xe3, //       LD A,0 / OUT ($E3),A
        0x3a, 0x00, 0x00, 0x32, 0x02, 0x91 // LD A,($0000) / LD ($9102),A
      ]);
      const memory = s.machine.divMmc.memory!;
      expect(s.peek(0x9100)).toBe(0xa5);
      expect(memory[DIVMMC_ROM_SIZE + 0x2000]).toBe(0x55); // --- bank 1
      expect(memory[0]).toBe(0xa5);
      expect(s.peek(0x9101)).toBe(0x81);
      expect(s.peek(0x9102)).toBe(0xf3); // --- the Spectrum ROM's DI
      // --- MAPRAM: bank 3 at $0000, read-only; bank 3 at $2000 read-only too
      memory[DIVMMC_ROM_SIZE + 3 * 0x2000] = 0x3c;
      run(s, x, p, [
        0x3e, 0xc3, 0xd3, 0xe3, //       LD A,$C3 / OUT ($E3),A  (conmem, mapram, bank 3)
        0x3a, 0x00, 0x00, 0x32, 0x00, 0x91, // LD A,($0000) / LD ($9100),A
        0x3e, 0x77, 0x32, 0x00, 0x20, // LD A,$77 / LD ($2000),A
        0x3e, 0x40, 0xd3, 0xe3 //        LD A,$40 / OUT ($E3),A  (MAPRAM stays set)
      ]);
      expect(s.peek(0x9100)).toBe(0x3c);
      expect(memory[DIVMMC_ROM_SIZE + 3 * 0x2000]).toBe(0x3c);
      expect(x[`${p}DivMmcGetPortE3`]() & 0x40).toBe(0x40);
    }, 120_000);

    it(`${model}: the SD card reads and writes sectors through the host`, async () => {
      const { s, x, p } = await withDivMmc(model);
      s.runFrames(50);
      const divMmc = s.machine.divMmc;
      // --- CMD17 sector 5: R1, the data token, 512 bytes to $9000
      const read = [
        0x3e, 0xfe, 0xd3, 0xe7, //               LD A,$FE / OUT ($E7),A  (card 0)
        0x3e, 0x51, 0xd3, 0xeb, 0xaf, 0xd3, 0xeb, 0xd3, 0xeb, 0xd3, 0xeb, 0x3e, 0x05, 0xd3, 0xeb, 0x3e, 0xff, 0xd3, 0xeb,
        0xdb, 0xeb, 0xfe, 0xff, 0x28, 0xfa, //   r1: IN A,($EB) / CP $FF / JR Z,r1
        0xdb, 0xeb, 0xfe, 0xfe, 0x20, 0xfa, //   tok: IN A,($EB) / CP $FE / JR NZ,tok
        0x21, 0x00, 0x90, 0x01, 0x00, 0x02, //   LD HL,$9000 / LD BC,512
        0xdb, 0xeb, 0x77, 0x23, 0x0b, 0x78, 0xb1, 0x20, 0xf7 // rd: IN / LD (HL),A / INC HL / DEC BC / LD A,B / OR C / JR NZ,rd
      ];
      const code = [0xf3, 0x31, 0x00, 0x90, ...read, 0x18, 0xfe];
      s.poke(CODE, code);
      s.machine.pc = CODE;
      // --- The frame stops for the host: the card waits for sector 5
      x[`${p}ExecuteFrame`]();
      expect(divMmc.hostWaiting).toBe(true);
      expect(x[`${p}GetFrameCompleted`]()).toBe(0);
      expect(divMmc.syncFrameCommand()).toEqual({ command: "divmmc-sd-read", sector: 5 });
      const sector = Uint8Array.from({ length: 512 }, (_, i) => (i * 7) & 0xff);
      divMmc.answerRead(sector);
      divMmc.setFrameCommand(undefined);
      s.runTo(CODE + code.length - 2, { maxFrames: 5 });
      expect(Array.from({ length: 512 }, (_, i) => s.peek(BUFFER + i))).toEqual(Array.from(sector));

      // --- CMD24 sector 9: R1, the token, 512 bytes from $9000, the CRC; then the data response
      const write = [
        0x3e, 0x58, 0xd3, 0xeb, 0xaf, 0xd3, 0xeb, 0xd3, 0xeb, 0xd3, 0xeb, 0x3e, 0x09, 0xd3, 0xeb, 0x3e, 0xff, 0xd3, 0xeb,
        0xdb, 0xeb, 0xfe, 0xff, 0x28, 0xfa, //   r1: IN A,($EB) / CP $FF / JR Z,r1
        0x3e, 0xfe, 0xd3, 0xeb, //               LD A,$FE / OUT ($EB),A  (the token)
        0x21, 0x00, 0x90, 0x01, 0x00, 0x02, //   LD HL,$9000 / LD BC,512
        0x7e, 0xd3, 0xeb, 0x23, 0x0b, 0x78, 0xb1, 0x20, 0xf7, // wr: LD A,(HL) / OUT ($EB),A / INC HL / DEC BC / ...
        0x3e, 0xff, 0xd3, 0xeb, 0xd3, 0xeb, //   two CRC bytes
        0xdb, 0xeb, 0xfe, 0xff, 0x28, 0xfa, //   resp: IN A,($EB) / CP $FF / JR Z,resp
        0x32, 0x00, 0x92 //                      LD ($9200),A
      ];
      const code2 = [...write, 0x18, 0xfe];
      s.poke(CODE + 0x200, code2);
      s.machine.pc = CODE + 0x200;
      x[`${p}ExecuteFrame`]();
      const command = divMmc.syncFrameCommand();
      expect(command?.command).toBe("divmmc-sd-write");
      expect(command?.sector).toBe(9);
      expect(Array.from((command as { data: Uint8Array }).data)).toEqual(Array.from(sector));
      divMmc.answerWrite(true);
      divMmc.setFrameCommand(undefined);
      s.runTo(CODE + 0x200 + code2.length - 2, { maxFrames: 5 });
      expect(s.peek(0x9200) & 0x1f).toBe(0x05); // --- data accepted
    }, 120_000);
  }

  it("absent, it answers no port and maps nothing", async () => {
    const s = await createSp128Session("sp128");
    const x = s.machine.wasmV2Runtime!.exports as unknown as Exports;
    s.runFrames(50);
    run(s, x, "sp128", [
      0x3e, 0x80, 0xd3, 0xe3, //             LD A,$80 / OUT ($E3),A
      0x3a, 0x00, 0x00, 0x32, 0x00, 0x91 //  LD A,($0000) / LD ($9100),A
    ]);
    s.machine.pc = 0x0008;
    s.step(1);
    expect(s.peek(0x9100)).toBe(0xf3);
    expect(x.sp128DivMmcGetMapped()).toBe(0);
    expect(x.sp128DivMmcGetPresent()).toBe(0);
  }, 120_000);
});

import { mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { it, expect } from "vitest";

import { createSession } from "../../harness/zxnext";

/*
 * F3, the Klive side (.plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md §8): replays captured catalogue programs
 * on Klive's Next core. For each program it writes the simulated core's inputs - the memory right
 * after `loadCode` (SRAM image, banks 5 and 7), the entry point, a clock limit - and Klive's own
 * result: the state right after the instruction that writes the ready marker ($A5 to NextReg $7F),
 * reached with `runToNextRegWrite`.
 *
 * Environment: F3_PROGRAMS (a JSON-lines shard of programs, each with an `id`), F3_OUT (the run
 * folder; program n goes to F3_OUT/progs/n), F3_PROGRESS (a file rewritten with the done count),
 * F3_MAX_FRAMES (how long Klive waits for the marker). With F3_PREP=1 it writes only the files every
 * program shares (F3_OUT/shared): the ROM area of the SRAM image and the firmware stand-in.
 */

const PROGRAMS = process.env.F3_PROGRAMS ?? "";
const OUT = process.env.F3_OUT ?? "";
const PROGRESS = process.env.F3_PROGRESS ?? "";
const MAX_FRAMES = Number(process.env.F3_MAX_FRAMES ?? "8");
const CLOCKS_PER_FRAME = 560_000; // 28 MHz clocks in a 50 Hz frame, for the testbench's limit
const RAM = 0x40000;
const BANK5 = 0x54000; // pages $0A-$0B: the core keeps them in block RAM, not SRAM
const BANK7 = 0x5c000; // page $0E: the first 8K of bank 7, also block RAM
const MEM_TOP = 0x200000;
/** Registers Klive starts with as NextZXOS's firmware leaves them, not at the core's reset values */
const FIRMWARE_REGS = [0x05, 0x06, 0x08];

type Program = { id: number; source: string; entry?: number | string; sp?: number };

/** Non-zero 64-byte blocks of [from, to) as "addr b0 .. b63" lines */
function blocks(mem: Uint8Array, from: number, to: number, patch?: (addr: number, b: number[]) => void): string {
  const out: string[] = [];
  for (let a = from; a < to; a += 64) {
    const b = Array.from(mem.subarray(a, a + 64));
    patch?.(a, b);
    if (b.some((x) => x !== 0)) out.push(`${a} ${b.join(" ")}`);
  }
  return out.join("\n") + "\n";
}

function sparse(mem: Uint8Array, from: number, length: number): string {
  const out: string[] = [];
  for (let i = 0; i < length; i++) if (mem[from + i]) out.push(`${i} ${mem[from + i]}`);
  return out.join("\n") + "\n";
}

it("F3: replays the captured programs on Klive's Next core", async () => {
  if (process.env.F3_PREP === "1") {
    // --- Shared by every program: the ROMs etc. below $40000 as Klive loads them (block 0 and 1
    // --- come per program), and the firmware stand-in: JP $003C / NEXTREG $03,v (Klive's machine
    // --- type and timing; leaves config mode and switches the boot ROM off, so the next fetch,
    // --- $0040, comes from ROM 0's patched copy).
    const s = await createSession();
    const shared = join(OUT, "shared");
    mkdirSync(shared, { recursive: true });
    writeFileSync(join(shared, "sram-base.txt"), blocks(s.physicalMemory(), 128, RAM));
    const nr03 = s.nextRegValue(0x03);
    const rom = new Array(8192).fill(0);
    rom.splice(0, 3, 0xc3, 0x3c, 0x00);
    rom.splice(0x3c, 4, 0xed, 0x91, 0x03, 0x80 | (nr03 & 0x77));
    writeFileSync(join(shared, "bootrom.txt"), rom.join("\n") + "\n");
    writeFileSync(join(shared, "none.bin.txt"), "");
    writeFileSync(join(shared, "klive-nr03.txt"), `${nr03}\n`);
    return;
  }
  expect(PROGRAMS, "F3_PROGRAMS").not.toBe("");
  const programs: Program[] = readFileSync(PROGRAMS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const shared = join(OUT, "shared");
  let done = 0;
  for (const p of programs) {
    const dir = join(OUT, "progs", String(p.id));
    const init = join(dir, "init");
    mkdirSync(join(dir, "out"), { recursive: true });
    mkdirSync(init, { recursive: true });
    const result: string[] = [];
    try {
      const s = await createSession();
      // --- Klive's start state that the firmware (not the core's reset) sets
      const firmwareRegs = FIRMWARE_REGS.map((r) => [r, s.nextRegValue(r)]);
      const program = await s.loadCode(p.source, { entry: p.entry, sp: p.sp });
      const mem = s.physicalMemory();
      const sp = p.sp ?? 0xbff0;
      // --- The simulated core's start: after the firmware stand-in's soft reset (whose own
      // --- NEXTREG $02,$01 sits at $0040), ROM 0's first bytes set the firmware's registers as Klive
      // --- has them, clear the ULA/line and CTC interrupt status a fresh Klive has clear ($C8, $C9:
      // --- writing 1 clears; $CA's UART "transmitter empty" bits are set on both),
      // --- then DI / LD SP,sp / JP entry. Only the testbench's copy of ROM 0 is patched.
      const start = [
        ...firmwareRegs.flatMap(([r, v]) => [0xed, 0x91, r, v]),
        ...[0xc8, 0xc9].flatMap((r) => [0xed, 0x91, r, 0xff]),
        0xf3, 0x31, sp & 0xff, sp >> 8, 0xc3, program.entry & 0xff, program.entry >> 8
      ];
      if (start.length > 0x40) throw new Error("the start sequence overlaps $0040");
      const patchRom = (addr: number, b: number[]) => {
        if (addr === 0) b.splice(0, start.length, ...start);
        if (addr === 0x40) b.splice(0, 4, 0xed, 0x91, 0x02, 0x01);
      };
      writeFileSync(join(init, "sram.txt"), blocks(mem, 0, 128, patchRom) + blocks(mem, RAM, MEM_TOP));
      // --- ROM 0's real first 128 bytes, which the testbench puts back once the program has started
      writeFileSync(join(init, "rom-restore.txt"), blocks(mem, 0, 128));
      writeFileSync(join(init, "bank5.txt"), sparse(mem, BANK5, 0x4000));
      writeFileSync(join(init, "bank7.txt"), sparse(mem, BANK7, 0x2000));
      writeFileSync(join(init, "entry.txt"), `${program.entry}\n`);
      for (const f of ["sram-base.txt", "bootrom.txt", "none.bin.txt", "release.txt"]) {
        if (!existsSync(join(init, f))) symlinkSync(join(shared, f), join(init, f));
      }

      // --- Klive: run to the marker, stopping right after the instruction that wrote it
      const t0 = s.tacts;
      const f0 = s.frames;
      s.runToNextRegWrite(0x7f, 0xa5, { maxFrames: MAX_FRAMES });
      const frames = s.frames - f0 + 1;
      writeFileSync(join(init, "limit.txt"), `${(frames + 2) * CLOCKS_PER_FRAME}\n`);
      const r = s.registers();
      const beam = s.beamPosition();
      // --- Real time from the first fetch, in 7 MHz HC: whole frames plus the beam's place in this
      // --- one. (Klive's tacts count CPU T-states at the current speed, so they are not time.)
      const elapsedHc = (s.frames - f0) * beam.tactsPerLine * beam.linesPerFrame + beam.frameTact;
      result.push("status marker", `frames ${frames}`, `tacts ${s.tacts - t0}`, `elapsed_hc ${elapsedHc}`,
        `stop_frame ${s.frames - f0}`, `stop_beam ${beam.line} ${beam.lineTact}`,
        `pc ${r.pc}`, `a ${r.a}`, `f ${r.f}`, `sp ${r.sp}`);
      const ram = blocks(mem, RAM, MEM_TOP);
      for (let reg = 0; reg < 256; reg++) result.push(`nr ${reg} ${s.readNextReg(reg)}`);
      writeFileSync(join(dir, "klive-ram.txt"), ram);
    } catch (e) {
      const msg = String((e as Error).message ?? e).split("\n")[0];
      result.length = 0;
      result.push(/No breakpoint hit/.test(msg) ? "status no-marker" : `status error ${msg}`);
    }
    writeFileSync(join(dir, "klive.txt"), result.join("\n") + "\n");
    done++;
    if (PROGRESS && done % 10 === 0) writeFileSync(PROGRESS, String(done));
  }
  if (PROGRESS) writeFileSync(PROGRESS, `${done} DONE`);
});

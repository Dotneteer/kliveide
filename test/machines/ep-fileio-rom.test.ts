import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

/*
 * Klive's FILE: ROM (`.plans/ENTERPRISE_PLAN.md` §9.2): the shipped image is exactly what Klive's
 * assembler makes of its source, padded to 16K with FFh. `EP_FILEIO_ROM_WRITE=1` writes the image.
 */

const REPO = join(__dirname, "../..");
const SOURCE = join(REPO, "src/emu/machines/enterprise/fileio/ep-klive-fileio.asm");
const IMAGE = join(REPO, "src/public/roms/ep-klive-fileio.rom");

async function assemble(): Promise<Uint8Array> {
  const output = await new Z80Assembler().compile(readFileSync(SOURCE, "utf8"), new AssemblerOptions());
  if (output.errorCount) {
    throw new Error(output.errors.map((e) => `${e.line}: ${e.message}`).join("\n"));
  }
  const rom = new Uint8Array(0x4000).fill(0xff);
  for (const segment of output.segments) {
    rom.set(segment.emittedCode.slice(0, segment.currentOffset), segment.startAddress - 0xc000);
  }
  return rom;
}

describe("Klive's FILE: ROM", () => {
  it("is its source, assembled", async () => {
    const rom = await assemble();
    if (process.env.EP_FILEIO_ROM_WRITE) writeFileSync(IMAGE, rom);
    expect(Buffer.from(readFileSync(IMAGE)).equals(Buffer.from(rom))).toBe(true);
  });

  it("starts with an EXOS extension ROM header whose device chain names FILE", async () => {
    const rom = await assemble();
    expect(Buffer.from(rom.subarray(0, 8)).toString("latin1")).toBe("EXOS_ROM");
    // --- The chain pointer (page 1) points at XX_SIZE, which is the distance back to DD_TYPE
    const chain = (rom[8] | (rom[9] << 8)) - 0x4000;
    const size = rom[chain];
    const type = chain - size;
    expect(rom[type + 7]).toBe(4);
    expect(Buffer.from(rom.subarray(type + 8, type + 12)).toString("latin1")).toBe("FILE");
    // --- XX_RAM: no device RAM
    expect(rom[type - 2] | (rom[type - 1] << 8)).toBe(0xfffe);
  });
});

import type { Ht1080zSegment } from "./codePlacement";

/*
 * An HT-1080Z (TRS-80 Model I) `/CMD` load module (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D6):
 *
 *   05 len name           the module header: the program's name
 *   01 len lo hi data...  a load block; `len` counts the address and the data, so a block of n data
 *                         bytes has len n + 2, written modulo 256 (0, 1 and 2 stand for 256-258)
 *   02 02 lo hi           the transfer address, which ends the module
 *
 * Blocks hold at most 256 data bytes, as the ROM's SYSTEM tapes do. `cmdToSystemTape` reads the same
 * format back, so an exported `.cmd` loads through the tape flow.
 */

const LOAD_BLOCK = 0x01;
const TRANSFER = 0x02;
const MODULE_HEADER = 0x05;
const MAX_BLOCK_DATA = 256;

/** The module name: letters and digits, upper case, at most 6 characters */
export function ht1080zModuleName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "");
  return base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "KLIVE";
}

/**
 * The bytes of a `.cmd` file
 * @param segments The code, in any order
 * @param entry The transfer address
 * @param name The module name (`ht1080zModuleName` cleans it)
 */
export function buildHt1080zCmd(segments: readonly Ht1080zSegment[], entry: number, name: string): Uint8Array {
  const moduleName = ht1080zModuleName(name);
  const bytes: number[] = [MODULE_HEADER, moduleName.length, ...Array.from(moduleName, (c) => c.charCodeAt(0))];
  for (const segment of [...segments].sort((a, b) => a.startAddress - b.startAddress)) {
    const data = Array.from(segment.emittedCode);
    for (let offset = 0; offset < data.length; offset += MAX_BLOCK_DATA) {
      const chunk = data.slice(offset, offset + MAX_BLOCK_DATA);
      const address = (segment.startAddress + offset) & 0xffff;
      bytes.push(LOAD_BLOCK, (chunk.length + 2) & 0xff, address & 0xff, address >> 8, ...chunk);
    }
  }
  bytes.push(TRANSFER, 2, entry & 0xff, (entry >> 8) & 0xff);
  return new Uint8Array(bytes);
}

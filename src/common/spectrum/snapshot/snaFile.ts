/*
 * `.sna` snapshots (https://worldofspectrum.org/faq/reference/formats.htm).
 *
 * The 27-byte header:
 *   0 I · 1 HL' · 3 DE' · 5 BC' · 7 AF' · 9 HL · 11 DE · 13 BC · 15 IY · 17 IX
 *   19 interrupt status (bit 2 = IFF2) · 20 R · 21 AF · 23 SP · 25 IM · 26 border
 * then the 48K RAM ($4000-$FFFF): 49,179 bytes in all.
 *
 * A 48K file keeps PC on the stack (as if a RETN would restart the program), so the parser pops it.
 * A 128K file keeps the first 49,179 bytes (with the paged bank at $C000) and adds PC, the last
 * $7FFD, the TR-DOS flag, then the remaining banks in ascending order. When the paged bank is 2 or
 * 5 it is stored twice, which makes the 147,487-byte variant; the first copy is used.
 */

import {
  SPECTRUM_BANK_SIZE,
  hex,
  readWord,
  type SpectrumSnapshot
} from "./spectrumSnapshot";

/** The size of a 48K `.sna` */
export const SNA_48K_SIZE = 27 + 3 * SPECTRUM_BANK_SIZE;
/** The size of a 128K `.sna` whose paged bank is not 2 or 5 */
export const SNA_128K_SIZE = SNA_48K_SIZE + 4 + 5 * SPECTRUM_BANK_SIZE;
/** The size of a 128K `.sna` whose paged bank is 2 or 5 (stored twice) */
export const SNA_128K_LONG_SIZE = SNA_48K_SIZE + 4 + 6 * SPECTRUM_BANK_SIZE;

/** Is this one of the three `.sna` sizes? */
export function isSnaSize(length: number): boolean {
  return length === SNA_48K_SIZE || length === SNA_128K_SIZE || length === SNA_128K_LONG_SIZE;
}

/**
 * Parses a `.sna` file
 * @throws When the file is not one of the three `.sna` sizes, or its bank layout is inconsistent
 */
export function parseSnaFile(bytes: Uint8Array): SpectrumSnapshot {
  if (!isSnaSize(bytes.length)) {
    throw new Error(
      `A .sna file is ${SNA_48K_SIZE}, ${SNA_128K_SIZE} or ${SNA_128K_LONG_SIZE} bytes long; this one is ${bytes.length}`
    );
  }
  const is128 = bytes.length !== SNA_48K_SIZE;
  const warnings: string[] = [];
  const iff2 = (bytes[19] & 0x04) !== 0;
  const cpu = {
    i: bytes[0],
    hl_: readWord(bytes, 1),
    de_: readWord(bytes, 3),
    bc_: readWord(bytes, 5),
    af_: readWord(bytes, 7),
    hl: readWord(bytes, 9),
    de: readWord(bytes, 11),
    bc: readWord(bytes, 13),
    iy: readWord(bytes, 15),
    ix: readWord(bytes, 17),
    r: bytes[20],
    af: readWord(bytes, 21),
    sp: readWord(bytes, 23),
    im: bytes[25] & 0x03,
    // --- The file implies a RETN: IFF1 gets IFF2
    iff1: iff2,
    iff2,
    pc: 0
  };
  if (bytes[25] > 2) {
    warnings.push(`Interrupt mode byte is ${bytes[25]}; IM ${bytes[25] & 0x03} is used`);
  }
  const border = bytes[26] & 0x07;
  const header = [
    { label: "Layout", value: is128 ? "128K" : "48K" },
    { label: "Interrupt status", value: hex(bytes[19]) },
    { label: "Border", value: `${bytes[26]}` }
  ];

  // --- The banks of the first 48K: 5 at $4000, 2 at $8000, the paged (or 0) at $C000
  const block = (index: number) =>
    bytes.slice(27 + index * SPECTRUM_BANK_SIZE, 27 + (index + 1) * SPECTRUM_BANK_SIZE);
  const ram = new Map<number, Uint8Array>();
  ram.set(5, block(0));
  ram.set(2, block(1));

  if (!is128) {
    ram.set(0, block(2));
    // --- Pop PC off the stack (the two stack bytes stay as stored)
    const read = (address: number) => {
      const a = address & 0xffff;
      if (a < 0x4000) return 0xff;
      const bank = a < 0x8000 ? 5 : a < 0xc000 ? 2 : 0;
      return ram.get(bank)![a & 0x3fff];
    };
    cpu.pc = read(cpu.sp) | (read(cpu.sp + 1) << 8);
    if (cpu.sp < 0x4000 || cpu.sp > 0xfffe) {
      warnings.push(`SP is ${hex(cpu.sp, 4)}, so PC could not be read from RAM`);
    }
    cpu.sp = (cpu.sp + 2) & 0xffff;
    header.push({ label: "PC (from the stack)", value: hex(cpu.pc, 4) });
    return {
      format: "sna",
      formatVersion: "48K",
      machine: "48k",
      cpu,
      ula: { border },
      ram,
      peripherals: {},
      header,
      warnings
    };
  }

  // --- The 128K extension
  const ext = SNA_48K_SIZE;
  cpu.pc = readWord(bytes, ext);
  const port7ffd = bytes[ext + 2];
  const trdos = bytes[ext + 3];
  const paged = port7ffd & 0x07;
  if (!ram.has(paged)) {
    // --- Bank 2 or 5 paged in is stored twice; the first copy stands
    ram.set(paged, block(2));
  }
  header.push(
    { label: "PC", value: hex(cpu.pc, 4) },
    { label: "Port $7FFD", value: hex(port7ffd) },
    { label: "TR-DOS ROM paged", value: trdos ? "yes" : "no" }
  );

  const expectedLong = paged === 2 || paged === 5;
  if (expectedLong !== (bytes.length === SNA_128K_LONG_SIZE)) {
    throw new Error(
      `A 128K .sna with bank ${paged} paged is ${expectedLong ? SNA_128K_LONG_SIZE : SNA_128K_SIZE} bytes long; this one is ${bytes.length}`
    );
  }
  let offset = ext + 4;
  for (let bank = 0; bank < 8; bank++) {
    if (bank === 2 || bank === 5 || (bank === paged && !expectedLong)) continue;
    ram.set(bank, bytes.slice(offset, offset + SPECTRUM_BANK_SIZE));
    offset += SPECTRUM_BANK_SIZE;
  }
  const peripherals = trdos ? { trdosPaged: true } : {};
  return {
    format: "sna",
    formatVersion: "128K",
    machine: "128k",
    cpu,
    ula: { border },
    paging: { port7ffd },
    ram,
    peripherals,
    header,
    warnings
  };
}

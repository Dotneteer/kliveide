/*
 * `.z80` snapshots, versions 1-3 (https://worldofspectrum.org/faq/reference/z80format.htm).
 *
 * Version 1 is a 30-byte header with a non-zero PC at offset 6, followed by the 48K RAM, which byte
 * 12 bit 5 says is compressed (and then ends with `00 ED ED 00`). Versions 2 and 3 have PC = 0 at
 * offset 6 and an extra header whose length (offset 30) is 23 (v2) or 54/55 (v3), followed by 16K
 * memory blocks `{ length: u16, page: u8, data }` (`length = $FFFF`: 16384 raw bytes).
 *
 * The hardware mode (byte 34) differs between v2 and v3 for 3 and 4; bit 7 of byte 37 "modifies" the
 * hardware: 48K becomes 16K, 128K becomes +2, +3 becomes +2A.
 */

import { decompressZ80DataBlock } from "./z80Compression";
import {
  SPECTRUM_BANK_SIZE,
  hex,
  readWord,
  type SnapshotMachine,
  type SpectrumSnapshot,
  type SpectrumSnapshotPeripherals,
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine
} from "./spectrumSnapshot";

/** What the hardware-mode byte means in v2 files (before the "modify hardware" bit) */
const HW_MODE_V2: Record<number, string> = {
  0: "48K",
  1: "48K + Interface 1",
  2: "SamRam",
  3: "128K",
  4: "128K + Interface 1"
};

/** What the hardware-mode byte means in v3 files */
const HW_MODE_V3: Record<number, string> = {
  0: "48K",
  1: "48K + Interface 1",
  2: "SamRam",
  3: "48K + M.G.T.",
  4: "128K",
  5: "128K + Interface 1",
  6: "128K + M.G.T."
};

/** Modes other emulators added, the same in v2 and v3 */
const HW_MODE_EXTENDED: Record<number, string> = {
  7: "+3",
  8: "+3 (XZX-Pro)",
  9: "Pentagon 128",
  10: "Scorpion 256",
  11: "Didaktik Kompakt",
  12: "+2",
  13: "+2A",
  14: "Timex TC2048",
  15: "Timex TC2068",
  128: "Timex TS2068"
};

/** The joystick in byte 29 bits 6-7 */
const Z80_JOYSTICKS = ["Cursor/Protek/AGF", "Kempston", "Sinclair 2 Left", "Sinclair 2 Right"];

/** The video synchronisation in byte 29 bits 4-5 */
const Z80_VIDEO_SYNC = ["Normal", "High", "Normal", "Low"];

/** The name of a hardware mode, as the viewer shows it */
export function z80HardwareModeName(version: number, mode: number, modified: boolean): string {
  const base =
    HW_MODE_EXTENDED[mode] ?? (version === 2 ? HW_MODE_V2[mode] : HW_MODE_V3[mode]) ?? `unknown (${mode})`;
  return modified ? `${base} (modified)` : base;
}

/** The machine (and add-ons) a hardware mode names */
function machineOf(
  version: number,
  mode: number,
  modified: boolean
): { machine: SnapshotMachine; interface1?: boolean; mgt?: boolean } {
  let machine: SnapshotMachine;
  let interface1: boolean | undefined;
  let mgt: boolean | undefined;
  const v2 = version === 2;
  switch (mode) {
    case 0:
      machine = "48k";
      break;
    case 1:
      machine = "48k";
      interface1 = true;
      break;
    case 2:
      machine = { unsupported: "SamRam" };
      break;
    case 3:
      if (v2) {
        machine = "128k";
      } else {
        machine = "48k";
        mgt = true;
      }
      break;
    case 4:
      machine = "128k";
      interface1 = v2 ? true : undefined;
      break;
    case 5:
    case 6:
      if (v2) {
        machine = { unsupported: `unknown hardware mode ${mode}` };
      } else {
        machine = "128k";
        interface1 = mode === 5 ? true : undefined;
        mgt = mode === 6 ? true : undefined;
      }
      break;
    case 7:
    case 8:
      machine = "plus3";
      break;
    case 9:
      machine = "pentagon";
      break;
    case 12:
      machine = "plus2";
      break;
    case 13:
      machine = "plus2a";
      break;
    default:
      machine = { unsupported: HW_MODE_EXTENDED[mode] ?? `unknown hardware mode ${mode}` };
  }
  if (modified) {
    if (machine === "48k") machine = "16k";
    else if (machine === "128k") machine = "plus2";
    else if (machine === "plus3") machine = "plus2a";
  }
  return { machine, interface1, mgt };
}

/** The bank a `.z80` page number holds, or undefined for a ROM / unknown page */
function bankOfPage(page: number, paged: boolean): number | undefined {
  if (paged) {
    return page >= 3 && page <= 10 ? page - 3 : undefined;
  }
  switch (page) {
    case 4:
      return 2;
    case 5:
      return 0;
    case 8:
      return 5;
    default:
      return undefined;
  }
}

/** The banks a machine's snapshot must hold */
function requiredBanks(machine: SnapshotMachine): number[] {
  if (machine === "16k") return [5];
  if (isPagedSnapshotMachine(machine)) return [0, 1, 2, 3, 4, 5, 6, 7];
  return [5, 2, 0];
}

/**
 * Parses a `.z80` file
 * @throws When the file is too short, a block is truncated or decompresses to the wrong size, or a
 * bank the machine needs is missing
 */
export function parseZ80File(bytes: Uint8Array): SpectrumSnapshot {
  if (bytes.length < 30) {
    throw new Error(`A .z80 file has a 30-byte header; this file is ${bytes.length} bytes long`);
  }
  const warnings: string[] = [];
  const flags1 = bytes[12] === 0xff ? 1 : bytes[12];
  const flags2 = bytes[29];
  const cpu = {
    af: (bytes[0] << 8) | bytes[1],
    bc: readWord(bytes, 2),
    hl: readWord(bytes, 4),
    pc: readWord(bytes, 6),
    sp: readWord(bytes, 8),
    i: bytes[10],
    r: (bytes[11] & 0x7f) | ((flags1 & 0x01) << 7),
    de: readWord(bytes, 13),
    bc_: readWord(bytes, 15),
    de_: readWord(bytes, 17),
    hl_: readWord(bytes, 19),
    af_: (bytes[21] << 8) | bytes[22],
    iy: readWord(bytes, 23),
    ix: readWord(bytes, 25),
    iff1: bytes[27] !== 0,
    iff2: bytes[28] !== 0,
    im: flags2 & 0x03
  };
  if (cpu.im === 3) {
    warnings.push("Interrupt mode 3 does not exist; IM 1 is used");
    cpu.im = 1;
  }
  const border = (flags1 >> 1) & 0x07;
  const peripherals: SpectrumSnapshotPeripherals = {
    joystick: Z80_JOYSTICKS[(flags2 >> 6) & 0x03]
  };
  if (flags2 & 0x04) peripherals.issue2 = true;
  if (flags1 & 0x10) {
    warnings.push("The file asks for the SamRom BASIC switch, which Klive ignores");
  }
  const header = [
    { label: "Compressed (v1)", value: flags1 & 0x20 ? "yes" : "no" },
    { label: "Issue 2 keyboard", value: flags2 & 0x04 ? "yes" : "no" },
    { label: "Double interrupt frequency", value: flags2 & 0x08 ? "yes" : "no" },
    { label: "Video sync", value: Z80_VIDEO_SYNC[(flags2 >> 4) & 0x03] },
    { label: "Joystick", value: peripherals.joystick! }
  ];

  // --- Version 1: the 48K RAM follows the header
  if (cpu.pc !== 0) {
    const data = bytes.subarray(30);
    const ramBytes = flags1 & 0x20 ? decompressZ80DataBlock(data, true) : data;
    if (ramBytes.length !== 3 * SPECTRUM_BANK_SIZE) {
      throw new Error(
        `A version 1 .z80 file holds 48K of RAM; this one holds ${ramBytes.length} bytes`
      );
    }
    const ram = new Map<number, Uint8Array>();
    ram.set(5, ramBytes.slice(0, SPECTRUM_BANK_SIZE));
    ram.set(2, ramBytes.slice(SPECTRUM_BANK_SIZE, 2 * SPECTRUM_BANK_SIZE));
    ram.set(0, ramBytes.slice(2 * SPECTRUM_BANK_SIZE));
    return {
      format: "z80",
      formatVersion: "v1",
      machine: "48k",
      cpu,
      ula: { border },
      ram,
      peripherals,
      header: [{ label: "Version", value: "1" }, ...header],
      warnings
    };
  }

  // --- Versions 2 and 3
  if (bytes.length < 34) {
    throw new Error("The .z80 extra header is missing");
  }
  const extraLength = readWord(bytes, 30);
  const version = extraLength === 23 ? 2 : extraLength === 54 || extraLength === 55 ? 3 : 0;
  if (!version) {
    throw new Error(`The .z80 extra header length is ${extraLength}; it should be 23, 54 or 55`);
  }
  const dataStart = 32 + extraLength;
  if (bytes.length < dataStart) {
    throw new Error(`The .z80 extra header is truncated (${bytes.length} bytes)`);
  }
  cpu.pc = readWord(bytes, 32);
  const hwMode = bytes[34];
  const flags3 = bytes[37];
  const modified = (flags3 & 0x80) !== 0;
  const { machine, interface1, mgt } = machineOf(version, hwMode, modified);
  const paged = isPagedSnapshotMachine(machine);
  if (interface1 || bytes[36] === 0xff) peripherals.interface1 = true;
  if (mgt) peripherals.mgt = true;

  header.unshift(
    { label: "Version", value: `${version}` },
    { label: "Hardware mode", value: `${hwMode}: ${z80HardwareModeName(version, hwMode, modified)}` }
  );
  header.push(
    { label: "Port $7FFD", value: hex(bytes[35]) },
    { label: "Interface 1 ROM paged", value: bytes[36] === 0xff ? "yes" : "no" },
    { label: "R emulation", value: flags3 & 0x01 ? "on" : "off" },
    { label: "LDIR emulation", value: flags3 & 0x02 ? "on" : "off" },
    { label: "AY sound in use", value: flags3 & 0x04 ? "yes" : "no" },
    { label: "Fuller Audio Box", value: flags3 & 0x40 ? "yes" : "no" }
  );

  const result: SpectrumSnapshot = {
    format: "z80",
    formatVersion: `v${version}`,
    machine,
    cpu,
    ula: { border },
    ram: new Map(),
    peripherals,
    header,
    warnings
  };

  // --- Paging
  if (paged) {
    result.paging = { port7ffd: bytes[35] };
    if (isPlus3SnapshotMachine(machine) && extraLength === 55) {
      result.paging.port1ffd = bytes[86];
    }
  }
  if (extraLength === 55) {
    header.push({ label: "Port $1FFD", value: hex(bytes[86]) });
  }

  // --- The AY chip: built into the 128K models, an add-on of a 48K when byte 37 bit 2 says so
  const hasAy = paged || (flags3 & 0x04) !== 0;
  if (hasAy) {
    result.ay = {
      selected: bytes[38] & 0x0f,
      regs: bytes.slice(39, 55),
      on48k: paged ? undefined : true
    };
  }

  // --- Version 3: the frame position, M.G.T. and Multiface state
  if (version === 3) {
    const low = readWord(bytes, 55);
    const high = bytes[57];
    const quarter = paged ? 17727 : 17472;
    header.push({ label: "T-state counter", value: `${hex(high)} / ${hex(low, 4)}` });
    if (low < quarter) {
      // --- The high counter is 3 just after the interrupt and counts up every quarter frame;
      // --- the low counter counts down through each quarter
      result.ula.frameTact = ((high + 1) & 0x03) * quarter + (quarter - 1 - low);
    } else {
      warnings.push(`The T-state counter (${low}) is out of range; the frame position is not used`);
    }
    if (bytes[59] === 0xff) peripherals.mgt = true;
    if (bytes[60] === 0xff) {
      peripherals.multiface = true;
      warnings.push("The Multiface ROM was paged in; the program will probably crash");
    }
  }

  // --- Memory blocks
  let offset = dataStart;
  while (offset < bytes.length) {
    if (offset + 3 > bytes.length) {
      throw new Error(`A .z80 memory block header at ${offset} is truncated`);
    }
    const length = readWord(bytes, offset);
    const page = bytes[offset + 2];
    offset += 3;
    const stored = length === 0xffff ? SPECTRUM_BANK_SIZE : length;
    if (offset + stored > bytes.length) {
      throw new Error(`The .z80 memory block of page ${page} is truncated`);
    }
    const raw = bytes.subarray(offset, offset + stored);
    offset += stored;
    const data = length === 0xffff ? raw.slice() : decompressZ80DataBlock(raw);
    if (data.length !== SPECTRUM_BANK_SIZE) {
      throw new Error(
        `The .z80 memory block of page ${page} holds ${data.length} bytes instead of 16384`
      );
    }
    const bank = bankOfPage(page, paged);
    if (bank === undefined) {
      warnings.push(`Memory page ${page} is not RAM of this machine; it is ignored`);
      continue;
    }
    if (result.ram.has(bank)) {
      warnings.push(`Memory page ${page} is stored twice; the first copy is used`);
      continue;
    }
    result.ram.set(bank, data);
  }

  if (typeof machine === "string") {
    const missing = requiredBanks(machine).filter((b) => !result.ram.has(b));
    if (missing.length) {
      throw new Error(`The .z80 file lacks RAM bank(s) ${missing.join(", ")}`);
    }
  }
  return result;
}

/*
 * `.szx` (zx-state) snapshots, Spectaculator's chunked format
 * (https://www.spectaculator.com/docs/zx-state/intro.html, spec 1.5).
 *
 * An 8-byte header ("ZXST", major, minor, machine id, flags) is followed by blocks of
 * `{ id: 4 chars, size: u32, data }`. Unknown blocks are skipped. All values are little-endian and
 * RAM pages, tapes and custom ROMs may be zlib-compressed.
 *
 * The blocks Klive reads: CRTR, Z80R, SPCR, RAMP, AY, KEYB, JOY, +3, DSK, TAPE and ROM (the last
 * only to warn that a custom ROM is not installed). Everything else is listed and warned about.
 */

import { unzlibSync } from "fflate";
import {
  SPECTRUM_BANK_SIZE,
  hex,
  readDword,
  readWord,
  type SnapshotChunkInfo,
  type SnapshotMachine,
  type SpectrumSnapshot,
  type SpectrumSnapshotPeripherals,
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine
} from "./spectrumSnapshot";

/** The magic at the start of every `.szx` file */
export const SZX_MAGIC = "ZXST";

/** The `chMachineId` values (spec, "zx-state header") */
const SZX_MACHINES: Record<number, SnapshotMachine> = {
  0: "16k",
  1: "48k",
  2: "128k",
  3: "plus2",
  4: "plus2a",
  5: "plus3",
  6: "plus3e",
  7: { unsupported: "Pentagon 128" },
  8: { unsupported: "Timex TC2048" },
  9: { unsupported: "Timex TC2068" },
  10: { unsupported: "Scorpion ZS-256" },
  11: { unsupported: "ZX Spectrum SE" },
  12: { unsupported: "Timex TS2068" },
  13: { unsupported: "Pentagon 512" },
  14: { unsupported: "Pentagon 1024" },
  15: "48k-ntsc",
  16: { unsupported: "ZX Spectrum 128Ke" }
};

/** Keyboard-joystick (KEYB) and JOY joystick types; they share the numbering but for 5 */
const SZX_KEYB_JOYSTICKS = [
  "Kempston",
  "Fuller",
  "Cursor (AGF/Protek)",
  "Sinclair 1",
  "Sinclair 2",
  "Spectrum+ cursor keys",
  "Timex 1",
  "Timex 2",
  "None"
];
const SZX_JOYSTICKS = [
  "Kempston",
  "Fuller",
  "Cursor (AGF/Protek)",
  "Sinclair 1",
  "Sinclair 2",
  "Comcon",
  "Timex 1",
  "Timex 2",
  "Disabled"
];

/** Block ids Klive reads */
const KNOWN_BLOCKS = new Set([
  "CRTR",
  "Z80R",
  "SPCR",
  "RAMP",
  "AY",
  "KEYB",
  "JOY",
  "+3",
  "DSK",
  "TAPE",
  "ROM"
]);

/** Readable names of the blocks Klive skips, for the warnings */
const SKIPPED_BLOCK_NAMES: Record<string, string> = {
  IF1: "Interface 1",
  IF2R: "Interface 2 ROM cartridge",
  MDRV: "Microdrive",
  MFCE: "Multiface",
  ZXPR: "ZX Printer",
  B128: "Beta 128",
  BDSK: "Beta disk",
  PLSD: "Plus D",
  PDSK: "Plus D disk",
  OPUS: "Opus Discovery",
  ODSK: "Opus disk",
  AMXM: "AMX mouse",
  COVX: "Covox",
  DIDE: "DivIDE",
  DOCK: "Timex dock",
  EXCT: "Timex dock",
  SCLD: "Timex SCLD",
  SIDE: "Simple IDE",
  SPCD: "SpecDrum",
  USPE: "Currah µSpeech",
  ZMMC: "ZXMMC",
  GS: "General Sound",
  GSRP: "General Sound RAM",
  LEC: "LEC memory",
  LCRP: "LEC memory page",
  ZXAT: "ZXATASP",
  ATRP: "ZXATASP RAM",
  ZXCF: "ZXCF",
  CFRP: "ZXCF RAM",
  SNET: "Spectranet",
  SNEF: "Spectranet flash",
  SNER: "Spectranet RAM"
};

/** Turns a 4-byte block id into text, dropping the NUL padding ("AY\0\0" -> "AY") */
function blockId(bytes: Uint8Array, offset: number): string {
  let id = "";
  for (let i = 0; i < 4; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    id += String.fromCharCode(c);
  }
  return id;
}

/** Reads a NUL-terminated (or length-limited) Latin-1 string */
function readString(bytes: Uint8Array, offset: number, maxLength: number): string {
  let s = "";
  for (let i = 0; i < maxLength && offset + i < bytes.length; i++) {
    const c = bytes[offset + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Inflates a zlib stream, naming the block on failure */
function inflate(data: Uint8Array, what: string): Uint8Array {
  try {
    return unzlibSync(data);
  } catch (err) {
    throw new Error(`The ${what} cannot be decompressed (${(err as Error).message})`);
  }
}

/** Does this look like a `.szx` file? */
export function hasSzxMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x5a && // Z
    bytes[1] === 0x58 && // X
    bytes[2] === 0x53 && // S
    bytes[3] === 0x54 // T
  );
}

/**
 * Parses a `.szx` file
 * @throws When the magic is missing, a block is truncated, a compressed block does not inflate, or
 * the registers or a RAM page the machine needs are missing
 */
export function parseSzxFile(bytes: Uint8Array): SpectrumSnapshot {
  if (bytes.length < 8 || !hasSzxMagic(bytes)) {
    throw new Error("Not a zx-state (.szx) file: the ZXST header is missing");
  }
  const major = bytes[4];
  const minor = bytes[5];
  const machineId = bytes[6];
  const machine: SnapshotMachine = SZX_MACHINES[machineId] ?? {
    unsupported: `unknown machine id ${machineId}`
  };
  const warnings: string[] = [];
  if (major !== 1) {
    warnings.push(`zx-state major version ${major} is newer than Klive knows (1)`);
  }
  const header = [
    { label: "Version", value: `${major}.${minor}` },
    { label: "Machine id", value: `${machineId}` },
    { label: "Alternate timings", value: bytes[7] & 0x01 ? "yes" : "no" }
  ];
  const chunks: SnapshotChunkInfo[] = [];
  const peripherals: SpectrumSnapshotPeripherals = {};
  const ram = new Map<number, Uint8Array>();
  let cpu: SpectrumSnapshot["cpu"] | undefined;
  const ula: SpectrumSnapshot["ula"] = { border: 0 };
  if (bytes[7] & 0x01) ula.alternateTimings = true;
  let paging: SpectrumSnapshot["paging"];
  let ay: SpectrumSnapshot["ay"];
  let creator: string | undefined;
  let specRegsSeen = false;

  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      throw new Error(`The block header at offset ${offset} is truncated`);
    }
    const id = blockId(bytes, offset);
    const size = readDword(bytes, offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) {
      throw new Error(`The ${id || "unnamed"} block at offset ${offset} is truncated`);
    }
    const data = bytes.subarray(start, start + size);
    offset = start + size;
    const known = KNOWN_BLOCKS.has(id);
    chunks.push({ id, size, known });
    const need = (min: number) => {
      if (size < min) {
        throw new Error(`The ${id} block is ${size} bytes; it needs at least ${min}`);
      }
    };

    switch (id) {
      case "CRTR": {
        need(36);
        const name = readString(data, 0, 32);
        creator = `${name} ${readWord(data, 32)}.${readWord(data, 34)}`.trim();
        break;
      }
      case "Z80R": {
        need(37);
        const flags = data[34];
        cpu = {
          af: readWord(data, 0),
          bc: readWord(data, 2),
          de: readWord(data, 4),
          hl: readWord(data, 6),
          af_: readWord(data, 8),
          bc_: readWord(data, 10),
          de_: readWord(data, 12),
          hl_: readWord(data, 14),
          ix: readWord(data, 16),
          iy: readWord(data, 18),
          sp: readWord(data, 20),
          pc: readWord(data, 22),
          i: data[24],
          r: data[25],
          iff1: data[26] !== 0,
          iff2: data[27] !== 0,
          im: data[28] > 2 ? 1 : data[28],
          halted: (flags & 0x02) !== 0,
          suppressInterrupt: (flags & 0x01) !== 0
        };
        if (data[28] > 2) warnings.push(`Interrupt mode ${data[28]} does not exist; IM 1 is used`);
        ula.frameTact = readDword(data, 29);
        header.push(
          { label: "T-states at start", value: `${ula.frameTact}` },
          { label: "Held interrupt T-states", value: `${data[33]}` },
          { label: "CPU flags", value: hex(flags) }
        );
        // --- MEMPTR arrived in 1.4; before that the bytes were chBitReg/chReserved
        if (size >= 37 && (major > 1 || minor >= 4)) {
          cpu.memptr = readWord(data, 35);
        }
        break;
      }
      case "SPCR": {
        need(4);
        specRegsSeen = true;
        ula.border = data[0] & 0x07;
        ula.lastFe = data[3];
        paging = { port7ffd: data[1] };
        if (isPlus3SnapshotMachine(machine)) paging.port1ffd = data[2];
        header.push(
          { label: "Border", value: `${data[0]}` },
          { label: "Port $7FFD", value: hex(data[1]) },
          { label: "Port $1FFD", value: hex(data[2]) },
          { label: "Last port $FE", value: hex(data[3]) }
        );
        break;
      }
      case "RAMP": {
        need(3);
        const compressed = (readWord(data, 0) & 0x01) !== 0;
        const page = data[2];
        const content = compressed
          ? inflate(data.subarray(3), `RAM page ${page}`)
          : data.slice(3);
        if (content.length !== SPECTRUM_BANK_SIZE) {
          throw new Error(`RAM page ${page} holds ${content.length} bytes instead of 16384`);
        }
        if (page > 7) {
          warnings.push(`RAM page ${page} does not exist on a Klive machine; it is ignored`);
        } else if (ram.has(page)) {
          warnings.push(`RAM page ${page} is stored twice; the first copy is used`);
        } else {
          ram.set(page, content);
        }
        break;
      }
      case "AY": {
        need(18);
        const flags = data[0];
        ay = { selected: data[1] & 0x0f, regs: data.slice(2, 18) };
        if (flags & 0x03) ay.on48k = true;
        if (flags & 0x01) warnings.push("The AY chip is a Fuller Box, which Klive does not emulate");
        break;
      }
      case "KEYB": {
        need(4);
        if (readDword(data, 0) & 0x01) peripherals.issue2 = true;
        if (size >= 5) {
          peripherals.joystick = SZX_KEYB_JOYSTICKS[data[4]] ?? `type ${data[4]}`;
        }
        break;
      }
      case "JOY": {
        need(6);
        const p1 = SZX_JOYSTICKS[data[4]] ?? `type ${data[4]}`;
        const p2 = SZX_JOYSTICKS[data[5]] ?? `type ${data[5]}`;
        header.push({ label: "Joysticks", value: `${p1} / ${p2}` });
        if (!peripherals.joystick) peripherals.joystick = p1;
        break;
      }
      case "+3": {
        need(2);
        peripherals.plus3 = {
          drives: data[0],
          motorOn: data[1] !== 0,
          disks: peripherals.plus3?.disks ?? []
        };
        break;
      }
      case "DSK": {
        need(7);
        const flags = readWord(data, 0);
        const drive = data[2];
        const length = readDword(data, 3);
        const payload = data.subarray(7);
        const disk: { drive: number; fileName?: string; embedded?: Uint8Array; sideB?: boolean } =
          { drive };
        if (flags & 0x04) disk.sideB = true;
        if (flags & 0x02) {
          // --- Reserved by the spec ("not implemented"); read it anyway if a writer uses it
          disk.embedded = flags & 0x01 ? inflate(payload, `disk in drive ${drive}`) : payload.slice();
        } else {
          disk.fileName = readString(payload, 0, Math.min(length, payload.length));
        }
        peripherals.plus3 ??= { drives: 1, motorOn: false, disks: [] };
        peripherals.plus3.disks.push(disk);
        break;
      }
      case "TAPE": {
        need(28);
        const currentBlock = readWord(data, 0);
        const flags = readWord(data, 2);
        const uncompressedSize = readDword(data, 4);
        const compressedSize = readDword(data, 8);
        const extension = readString(data, 12, 16).toLowerCase();
        const payload = data.subarray(28, 28 + compressedSize);
        if (flags & 0x01) {
          const embedded = flags & 0x02 ? inflate(payload, "embedded tape") : payload.slice();
          if (embedded.length !== uncompressedSize) {
            warnings.push(
              `The embedded tape is ${embedded.length} bytes, not the ${uncompressedSize} its block says`
            );
          }
          peripherals.tape = { currentBlock, embedded, extension };
        } else {
          peripherals.tape = { currentBlock, fileName: readString(payload, 0, compressedSize) };
        }
        break;
      }
      case "ROM": {
        need(6);
        peripherals.customRomSize = readDword(data, 2);
        break;
      }
      default: {
        const name = SKIPPED_BLOCK_NAMES[id];
        warnings.push(
          name ? `The ${name} state (${id}) is not restored` : `Unknown block "${id}" is skipped`
        );
      }
    }
  }

  if (!cpu) {
    throw new Error("The .szx file has no Z80 registers (Z80R) block");
  }
  if (!specRegsSeen) {
    warnings.push("The .szx file has no SPCR block; border and paging default to 0");
  }
  if (isPagedSnapshotMachine(machine) && !paging) {
    paging = { port7ffd: 0, port1ffd: isPlus3SnapshotMachine(machine) ? 0 : undefined };
  }
  if (typeof machine === "string") {
    const required =
      machine === "16k" ? [5] : isPagedSnapshotMachine(machine) ? [0, 1, 2, 3, 4, 5, 6, 7] : [5, 2, 0];
    const missing = required.filter((b) => !ram.has(b));
    if (missing.length) {
      throw new Error(`The .szx file lacks RAM page(s) ${missing.join(", ")}`);
    }
  }
  if (creator) header.unshift({ label: "Creator", value: creator });

  return {
    format: "szx",
    formatVersion: `${major}.${minor}`,
    machine,
    cpu,
    ula,
    paging,
    ram,
    ay,
    peripherals,
    header,
    chunks,
    creator,
    warnings
  };
}

/*
 * A Xilinx bitstream's configuration packets (`dev/plans/TBBLUE_TBU_VIEWER_PLAN.md` D8): the short
 * program of register writes a TBBLUE.TBU image is made of, for the TBU viewer's Bitstream section. The
 * frame data is not decoded: it means nothing without a per-device database, so a frame-data block is
 * one packet with its size. Never throws: a word that is no packet ends the list with a reason.
 *
 * Written from Xilinx's documentation:
 * - Spartan-6 (Issue 2 and 3): UG380 v2.5, "Configuration Packets" (Tables 5-23 to 5-29: 16-bit
 *   words, Type 1 header [15:13] = 001, op [12:11], register [10:5], word count [4:0]; Type 2 header
 *   [15:13] = 010 followed by a 32-bit word count in two 16-bit words), registers Table 5-30, commands
 *   Table 5-33.
 * - 7-series (Issue 4 and 5): UG470 v1.10, Tables 5-20 to 5-25 (32-bit words, Type 1 header
 *   [31:29] = 001, op [28:27], register [26:13] of which 5 bits are used, word count [10:0]; Type 2
 *   [31:29] = 010, word count [26:0]). Commands `$12` and `$13` are missing from UG470 v1.10 but are
 *   written by the Next's bitstreams; they are named as UG570 (UltraScale) names the same codes.
 */

import { fpgaPartName } from "./tbuFile";

export type BitstreamFamily = "spartan6" | "series7";

export type BitstreamOp = "nop" | "read" | "write" | "reserved";

export type BitstreamPacket = {
  /** Offset of the packet header from the start of the image */
  offset: number;
  type: 1 | 2;
  op: BitstreamOp;
  /** The register (a Type 2 packet writes the register of the Type 1 packet before it) */
  register: number;
  /** The register's name, when the family's table names it */
  registerName?: string;
  /** Payload words (16-bit for Spartan-6, 32-bit for 7-series) */
  words: number;
  /** Payload size in bytes */
  bytes: number;
  /** The payload as a number when it is one or two words (Spartan-6's two 16-bit words are one value) */
  value?: number;
  /** The command a CMD write gives */
  command?: string;
  /** The part an IDCODE write names */
  part?: string;
  /** Consecutive NOP headers folded into this one packet */
  repeat?: number;
  /** The AUTO CRC word that follows a Spartan-6 frame-data block (UG380 Table 5-50), counted in `bytes` */
  autoCrc?: number;
};

export type BitstreamStop = "end" | "padding" | "unknownWord" | "truncated" | "limit" | "noSync";

export type BitstreamPackets = {
  family: BitstreamFamily;
  /** Offset of the sync word `AA 99 55 66` from the start of the image */
  syncOffset?: number;
  packets: BitstreamPacket[];
  /** Offset just past the last packet */
  end: number;
  /** Why the list ends: at the image's end, at `$FF` padding, or at a problem */
  stop: BitstreamStop;
  /** Bytes written to the frame data register */
  frameDataBytes: number;
};

/** UG380 Table 5-30 */
const SPARTAN6_REGISTERS: Record<number, string> = {
  0x00: "CRC",
  0x01: "FAR_MAJ",
  0x02: "FAR_MIN",
  0x03: "FDRI",
  0x04: "FDRO",
  0x05: "CMD",
  0x06: "CTL",
  0x07: "MASK",
  0x08: "STAT",
  0x09: "LOUT",
  0x0a: "COR1",
  0x0b: "COR2",
  0x0c: "PWRDN_REG",
  0x0d: "FLR",
  0x0e: "IDCODE",
  0x0f: "CWDT",
  0x10: "HC_OPT_REG",
  0x12: "CSBO",
  0x13: "GENERAL1",
  0x14: "GENERAL2",
  0x15: "GENERAL3",
  0x16: "GENERAL4",
  0x17: "GENERAL5",
  0x18: "MODE_REG",
  0x19: "PU_GWE",
  0x1a: "PU_GTS",
  0x1b: "MFWR",
  0x1c: "CCLK_FREQ",
  0x1d: "SEU_OPT",
  0x1e: "EXP_SIGN",
  0x1f: "RDBK_SIGN",
  0x20: "BOOTSTS",
  0x21: "EYE_MASK",
  0x22: "CBC_REG"
};

/** UG470 Table 5-23 */
const SERIES7_REGISTERS: Record<number, string> = {
  0x00: "CRC",
  0x01: "FAR",
  0x02: "FDRI",
  0x03: "FDRO",
  0x04: "CMD",
  0x05: "CTL0",
  0x06: "MASK",
  0x07: "STAT",
  0x08: "LOUT",
  0x09: "COR0",
  0x0a: "MFWR",
  0x0b: "CBC",
  0x0c: "IDCODE",
  0x0d: "AXSS",
  0x0e: "COR1",
  0x10: "WBSTAR",
  0x11: "TIMER",
  0x16: "BOOTSTS",
  0x18: "CTL1",
  0x1f: "BSPI"
};

/** UG380 Table 5-33 */
const SPARTAN6_COMMANDS: Record<number, string> = {
  0x00: "NULL",
  0x01: "WCFG",
  0x02: "MFW",
  0x03: "LFRM",
  0x04: "RCFG",
  0x05: "START",
  0x07: "RCRC",
  0x08: "AGHIGH",
  0x0a: "GRESTORE",
  0x0b: "SHUTDOWN",
  0x0d: "DESYNC",
  0x0e: "IPROG"
};

/** UG470 Table 5-25, and UG570 for `$12` and `$13` */
const SERIES7_COMMANDS: Record<number, string> = {
  0x00: "NULL",
  0x01: "WCFG",
  0x02: "MFW",
  0x03: "DGHIGH/LFRM",
  0x04: "RCFG",
  0x05: "START",
  0x06: "RCAP",
  0x07: "RCRC",
  0x08: "AGHIGH",
  0x09: "SWITCH",
  0x0a: "GRESTORE",
  0x0b: "SHUTDOWN",
  0x0c: "GCAPTURE",
  0x0d: "DESYNC",
  0x0f: "IPROG",
  0x10: "CRCC",
  0x11: "LTIMER",
  0x12: "BSPI_READ",
  0x13: "FALL_EDGE"
};

type FamilyRules = {
  wordBytes: 2 | 4;
  registers: Record<number, string>;
  commands: Record<number, string>;
  cmdRegister: number;
  idcodeRegister: number;
  fdriRegister: number;
};

const RULES: Record<BitstreamFamily, FamilyRules> = {
  spartan6: {
    wordBytes: 2,
    registers: SPARTAN6_REGISTERS,
    commands: SPARTAN6_COMMANDS,
    cmdRegister: 0x05,
    idcodeRegister: 0x0e,
    fdriRegister: 0x03
  },
  series7: {
    wordBytes: 4,
    registers: SERIES7_REGISTERS,
    commands: SERIES7_COMMANDS,
    cmdRegister: 0x04,
    idcodeRegister: 0x0c,
    fdriRegister: 0x02
  }
};

const OPS: BitstreamOp[] = ["nop", "read", "write", "reserved"];

/** The name of a register in a family's table */
export function bitstreamRegisterName(family: BitstreamFamily, register: number): string | undefined {
  return RULES[family].registers[register];
}

/** At most this many packets are listed (a real Next bitstream has a few dozen) */
export const BITSTREAM_PACKET_LIMIT = 5000;

/** Find the sync word between `start` and `end` (searched in the first 4K, as the TBU probe does) */
function findSync(data: Uint8Array, start: number, end: number): number | undefined {
  const searchEnd = Math.min(end, start + 4096);
  for (let i = start; i + 4 <= searchEnd; i++) {
    if (data[i] === 0xaa && data[i + 1] === 0x99 && data[i + 2] === 0x55 && data[i + 3] === 0x66) return i;
  }
  return undefined;
}

/** The configuration packets of the bitstream between `start` and `end` of `data` */
export function decodeBitstreamPackets(
  data: Uint8Array,
  start: number,
  end: number,
  family: BitstreamFamily
): BitstreamPackets {
  const rules = RULES[family];
  const result: BitstreamPackets = { family, packets: [], end: start, stop: "end", frameDataBytes: 0 };
  end = Math.min(end, data.length);
  const sync = findSync(data, start, end);
  if (sync === undefined) {
    result.stop = "noSync";
    return result;
  }
  result.syncOffset = sync - start;

  const w = rules.wordBytes;
  const read = (at: number): number =>
    w === 2 ? (data[at] << 8) | data[at + 1] : ((data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8) | data[at + 3]) >>> 0;

  let pos = sync + 4;
  let lastRegister = -1;
  const packets = result.packets;
  while (pos + w <= end) {
    if (packets.length >= BITSTREAM_PACKET_LIMIT) {
      result.stop = "limit";
      break;
    }
    const header = read(pos);
    const type = w === 2 ? header >>> 13 : header >>> 29;
    const op = OPS[w === 2 ? (header >> 11) & 3 : (header >> 27) & 3];

    if (type === 1) {
      const register = w === 2 ? (header >> 5) & 0x3f : (header >> 13) & 0x3fff;
      const words = w === 2 ? header & 0x1f : header & 0x7ff;
      const bytes = words * w;
      if (pos + w + bytes > end) {
        result.stop = "truncated";
        break;
      }
      lastRegister = register;
      // --- Fold runs of NOPs (a Spartan-6 bitstream has many) into one packet
      const prev = packets[packets.length - 1];
      if (op === "nop" && words === 0 && prev?.type === 1 && prev.op === "nop" && prev.words === 0) {
        prev.repeat = (prev.repeat ?? 1) + 1;
        pos += w;
        continue;
      }
      const packet: BitstreamPacket = { offset: pos - start, type: 1, op, register, words, bytes };
      // --- A NOP addresses no register (its address field is 0, which would read as CRC)
      const name = op === "nop" ? undefined : rules.registers[register];
      if (name) packet.registerName = name;
      if (op !== "nop" && words > 0 && words * w <= 4) {
        let value = 0;
        for (let i = 0; i < words; i++) value = value * (w === 2 ? 0x10000 : 1) + read(pos + w + i * w);
        packet.value = value >>> 0;
        if (op === "write" && register === rules.cmdRegister) packet.command = rules.commands[packet.value];
        if (op === "write" && register === rules.idcodeRegister) packet.part = fpgaPartName(packet.value);
      }
      if (op === "write" && register === rules.fdriRegister) result.frameDataBytes += bytes;
      packets.push(packet);
      pos += w + bytes;
    } else if (type === 2 && (w === 2 || lastRegister >= 0)) {
      let words: number;
      let headerBytes: number;
      // --- A Spartan-6 Type 2 header names its register ([10:5], UG380 Table 5-26); a 7-series one
      // --- writes the register of the Type 1 packet before it
      if (w === 2) lastRegister = (header >> 5) & 0x3f;
      if (w === 2) {
        // --- The word count follows the header, high word first
        if (pos + 6 > end) {
          result.stop = "truncated";
          break;
        }
        words = read(pos + 2) * 0x10000 + read(pos + 4);
        headerBytes = 6;
      } else {
        words = header & 0x7ffffff;
        headerBytes = 4;
      }
      const bytes = words * w;
      if (pos + headerBytes + bytes > end) {
        result.stop = "truncated";
        break;
      }
      const packet: BitstreamPacket = { offset: pos - start, type: 2, op, register: lastRegister, words, bytes };
      const name = rules.registers[lastRegister];
      if (name) packet.registerName = name;
      const frameData = op === "write" && lastRegister === rules.fdriRegister;
      if (frameData) result.frameDataBytes += bytes;
      pos += headerBytes + bytes;
      // --- Spartan-6 follows frame data with a 32-bit AUTO CRC word
      if (frameData && w === 2 && pos + 4 <= end) {
        packet.autoCrc = (read(pos) * 0x10000 + read(pos + 2)) >>> 0;
        packet.bytes += 4;
        pos += 4;
      }
      packets.push(packet);
    } else {
      // --- No packet: padding after the bitstream (`$FF` in the TBU images, `$00` in the 2019 legacy
      // --- file), or something that is no bitstream
      const fill = data[pos];
      let rest = pos;
      if (fill === 0xff || fill === 0x00) while (rest < end && data[rest] === fill) rest++;
      result.stop = rest === end ? "padding" : "unknownWord";
      break;
    }
  }
  result.end = pos - start;
  return result;
}

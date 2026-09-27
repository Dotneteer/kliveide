import type { SourceReturnRegisters, SourceValueType } from "@abstractions/SourceDebugInfo";
import { toNumber, type Float40 } from "@main/kbasic/semantics/float40";

/**
 * Decoding a Klive BASIC value from emulator memory or registers (plan §10.7), in the
 * representations of `.ai/kbasic/runtime-abi.md` §2: the Variables panel, returned values and
 * watch expressions all read values through here.
 */

/** Reads the machine's memory: the 64K the CPU sees. */
export type MemoryView = {
  byte(address: number): number;
  word(address: number): number;
};

export function memoryView(memory: Uint8Array): MemoryView {
  const byte = (a: number) => memory[a & 0xffff] ?? 0;
  return { byte, word: (a) => byte(a) | (byte(a + 1) << 8) };
}

/** A decoded value: its text for display, and the number or string behind it. */
export type DecodedValue = { text: string; number?: number; string?: string };

const SIZES: Record<SourceValueType, number> = {
  byte: 1,
  ubyte: 1,
  boolean: 1,
  integer: 2,
  uinteger: 2,
  string: 2,
  long: 4,
  ulong: 4,
  fixed: 4,
  float: 5
};

export function valueSize(type: SourceValueType): number {
  return SIZES[type];
}

const TYPE_NAMES: Record<SourceValueType, string> = {
  byte: "Byte",
  ubyte: "UByte",
  boolean: "Boolean",
  integer: "Integer",
  uinteger: "UInteger",
  string: "String",
  long: "Long",
  ulong: "ULong",
  fixed: "Fixed",
  float: "Float"
};

/** The type as the source writes it. */
export function typeName(type: SourceValueType): string {
  return TYPE_NAMES[type];
}

/** The longest String shown in full; a longer one is cut with an ellipsis. */
export const MAX_STRING_SHOWN = 256;

/**
 * A String's characters as source text, in double quotes: the Spectrum's character set (`£` for
 * 96, `©` for 127), and every other code in the escape form the compiler reads (`\A` for a UDG,
 * `\#013` for the rest).
 */
export function spectrumText(codes: number[], truncated = false): string {
  let out = "";
  for (const c of codes) {
    if (c === 34) out += '""';
    else if (c === 92) out += "\\\\";
    else if (c === 96) out += "£";
    else if (c === 127) out += "©";
    else if (c >= 32 && c < 127) out += String.fromCharCode(c);
    else if (c >= 144 && c <= 164) out += "\\" + String.fromCharCode(65 + c - 144);
    else out += `\\#${c.toString().padStart(3, "0")}`;
  }
  return `"${out}${truncated ? "…" : ""}"`;
}

/** The String a heap pointer points at (0 is the empty string). */
export function decodeStringAt(mem: MemoryView, pointer: number): DecodedValue {
  if (!pointer) return { text: '""', string: "" };
  const length = mem.word(pointer);
  const shown = Math.min(length, MAX_STRING_SHOWN);
  const codes: number[] = [];
  for (let i = 0; i < shown; i++) codes.push(mem.byte(pointer + 2 + i));
  return { text: spectrumText(codes, length > shown), string: String.fromCharCode(...codes) };
}

/** A Float as the ROM would print it: at most ten significant digits. */
export function formatFloat(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return String(Number(x.toPrecision(10)));
}

function fromBytes(type: SourceValueType, b: number[], mem: MemoryView): DecodedValue {
  const num = (n: number, text = String(n)) => ({ text, number: n });
  const u16 = b[0] | (b[1] << 8);
  const u32 = (u16 + (b[2] | (b[3] << 8)) * 0x10000) >>> 0;
  switch (type) {
    case "ubyte":
      return num(b[0]);
    case "byte":
      return num(b[0] >= 0x80 ? b[0] - 0x100 : b[0]);
    case "boolean":
      return { text: b[0] ? "TRUE" : "FALSE", number: b[0] ? 1 : 0 };
    case "uinteger":
      return num(u16);
    case "integer":
      return num(u16 >= 0x8000 ? u16 - 0x10000 : u16);
    case "ulong":
      return num(u32);
    case "long":
      return num(u32 | 0);
    case "fixed": {
      const x = (u32 | 0) / 0x10000;
      return num(x, formatFloat(x));
    }
    case "float": {
      const x = toNumber(b.slice(0, 5) as unknown as Float40);
      return num(x, formatFloat(x));
    }
    case "string":
      return decodeStringAt(mem, u16);
  }
}

/** The value of `type` stored at `address`. */
export function decodeValue(type: SourceValueType, mem: MemoryView, address: number): DecodedValue {
  const bytes: number[] = [];
  for (let i = 0; i < valueSize(type); i++) bytes.push(mem.byte(address + i));
  return fromBytes(type, bytes, mem);
}

/**
 * A FUNCTION's result from the registers it returns in (runtime ABI §3.1): A for 8 bits, HL for
 * 16 bits and a String's pointer, DE:HL for 32 bits and Fixed, A-E-D-C-B for a Float.
 */
export function decodeRegisters(type: SourceValueType, r: SourceReturnRegisters, mem: MemoryView): DecodedValue {
  const a = (r.af >> 8) & 0xff;
  const lo = (w: number) => w & 0xff;
  const hi = (w: number) => (w >> 8) & 0xff;
  switch (type) {
    case "byte":
    case "ubyte":
    case "boolean":
      return fromBytes(type, [a], mem);
    case "float":
      return fromBytes(type, [a, lo(r.de), hi(r.de), lo(r.bc), hi(r.bc)], mem);
    default:
      return fromBytes(type, [lo(r.hl), hi(r.hl), lo(r.de), hi(r.de)], mem);
  }
}

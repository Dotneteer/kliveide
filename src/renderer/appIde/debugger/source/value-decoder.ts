import type { CodebankDebugInfo, SourceReturnRegisters, SourceValueType, VariableDebugInfo } from "@abstractions/SourceDebugInfo";
import { fromNumber, toNumber, type Float40 } from "@main/kbasic/semantics/float40";

/**
 * Decoding a Klive BASIC value from emulator memory or registers (plan §10.7), in the
 * representations of `.ai/kbasic/runtime-abi.md` §2: the Variables panel, returned values and
 * watch expressions all read values through here.
 */

/** Reads the machine's memory: the 64K the CPU sees. */
export type MemoryView = {
  byte(address: number): number;
  word(address: number): number;
  /**
   * CODEBANK (plan §10.7): the memory as a logical bank sees it — the window's addresses read from
   * the bank's own pages, whatever the window holds now. Absent without banked data.
   */
  inBank?(bank: number): MemoryView;
};

export function memoryView(memory: Uint8Array): MemoryView {
  const byte = (a: number) => memory[a & 0xffff] ?? 0;
  return { byte, word: (a) => byte(a) | (byte(a + 1) << 8) };
}

/**
 * A memory view that can also read through a CODEBANK bank: `pages` holds the 8K pages fetched by
 * partition (`getMemoryContents(page)`). Outside the window, and for a page not fetched, a bank's
 * view reads what the CPU sees.
 */
export function bankedMemoryView(base: MemoryView, codebank: CodebankDebugInfo, pages: ReadonlyMap<number, Uint8Array>): MemoryView {
  const views = new Map<number, MemoryView>();
  const inBank = (bank: number): MemoryView => {
    let view = views.get(bank);
    if (view) return view;
    const bankPages = codebank.banks.find((b) => b.bank === bank)?.pages ?? [];
    const byte = (address: number) => {
      const a = address & 0xffff;
      const offset = a - codebank.window;
      if (offset < 0 || offset >= codebank.windowSize) return base.byte(a);
      const page = pages.get(bankPages[offset >> 13]);
      return page ? (page[offset & 0x1fff] ?? 0) : base.byte(a);
    };
    view = { byte, word: (a) => byte(a) | (byte(a + 1) << 8), inBank };
    views.set(bank, view);
    return view;
  };
  return { ...base, inBank };
}

/** The memory a variable is read through: its bank's for bank-local data, what the CPU sees otherwise. */
export function memoryFor(mem: MemoryView, v: Pick<VariableDebugInfo, "bank">): MemoryView {
  return v.bank && mem.inBank ? mem.inBank(v.bank) : mem;
}

/** The 8K pages the bank-local variables live in: what a view needs fetched (`bankedMemoryView`). */
export function bankPagesOf(variables: readonly VariableDebugInfo[], codebank: CodebankDebugInfo | undefined): number[] {
  if (!codebank) return [];
  const banks = new Set(variables.flatMap((v) => (v.bank ? [v.bank] : [])));
  return [...new Set(codebank.banks.filter((b) => banks.has(b.bank)).flatMap((b) => b.pages))];
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

const RANGES: Partial<Record<SourceValueType, [number, number]>> = {
  byte: [-128, 127],
  ubyte: [0, 255],
  integer: [-32768, 32767],
  uinteger: [0, 65535],
  long: [-2147483648, 2147483647],
  ulong: [0, 4294967295]
};

/**
 * The bytes a new value of `type` is stored as (plan §10.7: editing a value writes memory), or an
 * error for text that is not a number of the type. Numbers only: a String is a heap pointer, and
 * writing one would need the program's heap.
 */
export function encodeValue(type: SourceValueType, text: string): { bytes: number[] } | { error: string } {
  const t = text.trim();
  if (type === "string") return { error: "Strings cannot be edited" };
  if (type === "boolean") {
    const upper = t.toUpperCase();
    if (upper === "TRUE" || upper === "FALSE") return { bytes: [upper === "TRUE" ? 1 : 0] };
  }
  const hex = /^\$([0-9a-f]+)$/i.exec(t);
  const x = hex ? parseInt(hex[1], 16) : t === "" ? NaN : Number(t);
  if (!Number.isFinite(x)) return { error: `'${text}' is not a number` };
  const le = (value: number, size: number) => Array.from({ length: size }, (_, i) => Math.floor(value / 2 ** (8 * i)) & 0xff);
  switch (type) {
    case "boolean":
      return { bytes: [x ? 1 : 0] };
    case "fixed": {
      const raw = Math.round(x * 0x10000);
      if (raw < -0x80000000 || raw > 0x7fffffff) return { error: "Out of the Fixed range" };
      return { bytes: le(raw >>> 0, 4) };
    }
    case "float":
      try {
        return { bytes: [...fromNumber(x)] };
      } catch {
        return { error: "Out of the Float range" };
      }
    default: {
      const [lo, hi] = RANGES[type]!;
      if (!Number.isInteger(x)) return { error: `${typeName(type)} takes whole numbers` };
      if (x < lo || x > hi) return { error: `${typeName(type)} holds ${lo} to ${hi}` };
      const size = valueSize(type);
      return { bytes: le(x < 0 ? x + 2 ** (8 * size) : x, size) };
    }
  }
}

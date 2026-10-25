import type {
  CallableFrameInfo,
  CodebankDebugInfo,
  SourceReturnRegisters,
  SourceValueType,
  VariableDebugInfo
} from "@abstractions/SourceDebugInfo";
import { fromNumber, toNumber, type Float40 } from "@main/kbasic/semantics/float40";
// --- `t` is a local name in this file (the trimmed text): the translator is `translate`
import { t as translate } from "@common/i18n/i18n";

import { formatRaw, NEUTRAL_LANGUAGE, type DebugLanguageSupport, type RawValue, type ValueDecoder } from "./language-support";

/**
 * Decoding values from emulator memory or registers by their **representation**
 * (`@abstractions/SourceDebugInfo` `SourceValueType`, plan §10.7, `.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §12.3): the Variables panel, returned values and watch expressions all read values through here.
 * A decoder knows bytes only; how a value is written is the language's (`formatRaw`).
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
export type DecodedValue = { text: string; number?: number; string?: string; raw?: RawValue };

/** The longest string shown in full; a longer one is cut with an ellipsis. */
export const MAX_STRING_SHOWN = 256;

// =================================================================================================
// The built-in decoders

const le = (value: number, size: number) => Array.from({ length: size }, (_, i) => Math.floor(value / 2 ** (8 * i)) & 0xff);
const u16Of = (b: number[]) => b[0] | (b[1] << 8);
const u32Of = (b: number[]) => (u16Of(b) + (b[2] | (b[3] << 8)) * 0x10000) >>> 0;

function integer(size: number, signed: boolean): ValueDecoder {
  const bits = 8 * size;
  const range: [number, number] = signed ? [-(2 ** (bits - 1)), 2 ** (bits - 1) - 1] : [0, 2 ** bits - 1];
  return {
    size,
    range,
    decode: (b) => {
      const u = size === 1 ? b[0] : size === 2 ? u16Of(b) : u32Of(b);
      return { kind: "int", value: signed && u >= 2 ** (bits - 1) ? u - 2 ** bits : u };
    },
    encode: (x) => {
      const n = Number(x);
      if (!Number.isInteger(n)) return "whole";
      if (n < range[0] || n > range[1]) return "range";
      return le(n < 0 ? n + 2 ** bits : n, size);
    }
  };
}

/** The characters at `address`: `count` of them, or up to a NUL when `count` is undefined. */
function textAt(mem: MemoryView, address: number, count: number | undefined): RawValue {
  const codes: number[] = [];
  if (count === undefined) {
    for (let i = 0; i < MAX_STRING_SHOWN; i++) {
      const c = mem.byte(address + i);
      if (c === 0) return { kind: "text", codes, truncated: false };
      codes.push(c);
    }
    return { kind: "text", codes, truncated: true };
  }
  const shown = Math.min(count, MAX_STRING_SHOWN);
  for (let i = 0; i < shown; i++) codes.push(mem.byte(address + i));
  return { kind: "text", codes, truncated: count > shown };
}

const bool = (trueByte: number): ValueDecoder => ({
  size: 1,
  decode: (b) => ({ kind: "bool", value: b[0] !== 0 }),
  encode: (x) => [x === true || (typeof x === "number" && x !== 0) ? trueByte : 0]
});

const BUILTIN: Record<string, ValueDecoder> = {
  i8: integer(1, true),
  u8: integer(1, false),
  i16: integer(2, true),
  u16: integer(2, false),
  i32: integer(4, true),
  u32: integer(4, false),
  bool: bool(1),
  "bool/ff": bool(0xff),
  char8: { ...integer(1, true), decode: (b) => ({ kind: "char", value: b[0] >= 0x80 ? b[0] - 0x100 : b[0] }) },
  ptr16: { ...integer(2, false), decode: (b) => ({ kind: "address", value: u16Of(b) }) },
  "fix16.16": {
    size: 4,
    decode: (b) => ({ kind: "real", value: (u32Of(b) | 0) / 0x10000 }),
    encode: (x) => {
      const raw = Math.round(Number(x) * 0x10000);
      return raw < -0x80000000 || raw > 0x7fffffff ? "range" : le(raw >>> 0, 4);
    }
  },
  float40: {
    size: 5,
    decode: (b) => ({ kind: "real", value: toNumber(b.slice(0, 5) as unknown as Float40) }),
    encode: (x) => {
      try {
        return [...fromNumber(Number(x))];
      } catch {
        return "range";
      }
    }
  },
  "str.heap": {
    size: 2,
    decode: (b, mem) => {
      const pointer = u16Of(b);
      return pointer ? textAt(mem, pointer + 2, mem.word(pointer)) : { kind: "text", codes: [], truncated: false };
    }
  },
  "str.c": {
    size: 2,
    decode: (b, mem) => {
      const pointer = u16Of(b);
      return pointer ? textAt(mem, pointer, undefined) : { kind: "address", value: 0 };
    }
  }
};

/** The decoder of a representation: the language's own, a built-in, `str.short:<n>`, or undefined. */
export function decoderOf(type: SourceValueType, lang: DebugLanguageSupport = NEUTRAL_LANGUAGE): ValueDecoder | undefined {
  const own = lang.decoders?.[type] ?? BUILTIN[type];
  if (own) return own;
  const short = /^str\.short:(\d+)$/.exec(type);
  if (short) {
    const capacity = Number(short[1]);
    // --- The bytes are read by the caller (size), so the text comes from them, not from memory
    return { size: capacity + 1, decode: (b) => ({ kind: "text", codes: b.slice(1, 1 + Math.min(b[0], capacity)), truncated: false }) };
  }
  return undefined;
}

/** Bytes a value of the representation occupies where it is stored (1 for an unknown one). */
export function valueSize(type: SourceValueType, lang: DebugLanguageSupport = NEUTRAL_LANGUAGE): number {
  return decoderOf(type, lang)?.size ?? 1;
}

function decoded(raw: RawValue, lang: DebugLanguageSupport): DecodedValue {
  const text = formatRaw(lang, raw);
  switch (raw.kind) {
    case "int":
    case "real":
    case "char":
    case "address":
      return { text, number: raw.value, raw };
    case "bool":
      return { text, number: raw.value ? 1 : 0, raw };
    case "text":
      return { text, string: String.fromCharCode(...raw.codes), raw };
    case "bytes":
      return { text, raw };
  }
}

function fromBytes(type: SourceValueType, bytes: number[], mem: MemoryView, lang: DebugLanguageSupport): DecodedValue {
  const decoder = decoderOf(type, lang);
  return decoded(decoder ? decoder.decode(bytes, mem) : { kind: "bytes", bytes }, lang);
}

/** The value of `type` stored at `address`. */
export function decodeValue(type: SourceValueType, mem: MemoryView, address: number, lang: DebugLanguageSupport = NEUTRAL_LANGUAGE): DecodedValue {
  const bytes: number[] = [];
  for (let i = 0; i < valueSize(type, lang); i++) bytes.push(mem.byte(address + i));
  return fromBytes(type, bytes, mem, lang);
}

/** A result from the registers its callable returns it in (`CallableFrameInfo.returns.in`). */
export function decodeRegisters(
  returns: NonNullable<CallableFrameInfo["returns"]>,
  r: SourceReturnRegisters,
  mem: MemoryView,
  lang: DebugLanguageSupport = NEUTRAL_LANGUAGE
): DecodedValue {
  const a = (r.af >> 8) & 0xff;
  const lo = (w: number) => w & 0xff;
  const hi = (w: number) => (w >> 8) & 0xff;
  const bytes =
    returns.in === "a" ? [a] : returns.in === "aedcb" ? [a, lo(r.de), hi(r.de), lo(r.bc), hi(r.bc)] : returns.in === "hl" ? [lo(r.hl), hi(r.hl)] : [lo(r.hl), hi(r.hl), lo(r.de), hi(r.de)];
  return fromBytes(returns.type, bytes, mem, lang);
}

/**
 * The bytes a new value of `type` is stored as (plan §10.7: editing a value writes memory), or an
 * error for text that is not a value of the type. Numbers and booleans only: a string may live on
 * the program's heap, and writing one would need it. `typeLabel` names the type in the messages.
 */
export function encodeValue(type: SourceValueType, typeLabel: string, text: string): { bytes: number[] } | { error: string } {
  const t = text.trim();
  const decoder = decoderOf(type);
  if (!decoder?.encode) return { error: translate("panels.side.variables.edit.stringsReadOnly") };
  const isBool = type === "bool" || type === "bool/ff";
  if (isBool && /^(true|false)$/i.test(t)) return { bytes: decoder.encode(/^true$/i.test(t)) as number[] };
  const hex = /^(?:\$|0x)([0-9a-f]+)$/i.exec(t);
  const x = hex ? parseInt(hex[1], 16) : t === "" ? NaN : Number(t);
  if (!Number.isFinite(x)) return { error: translate("panels.side.variables.edit.notANumber", { text }) };
  const bytes = decoder.encode(x);
  if (bytes === "whole") return { error: translate("panels.side.variables.edit.wholeNumbers", { type: typeLabel }) };
  if (bytes === "range") {
    if (type === "fix16.16") return { error: translate("panels.side.variables.edit.outOfFixed") };
    if (type === "float40") return { error: translate("panels.side.variables.edit.outOfFloat") };
    const [lo, hi] = decoder.range ?? [0, 0];
    return { error: translate("panels.side.variables.edit.range", { type: typeLabel, lo, hi }) };
  }
  return { bytes };
}

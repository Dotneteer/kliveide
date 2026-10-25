import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type {
  CallSiteDebugInfo,
  CodebankDebugInfo,
  FarCallRecordLayout,
  ReturnRegisters,
  SourceActivationInfo,
  SourceValueType,
  VariableDebugInfo
} from "@abstractions/SourceDebugInfo";

/**
 * Version 1 of the source-level debug model, read into version 2 (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §12.1, "Compatibility"): NEX debug sidecars written by older Klive versions, and the `.dbg` files
 * of zxbc, whose vocabulary is version 1's. Every function here passes version-2 data through, so a
 * reader need not know which version it holds.
 */

/** Version 1's value types: the representation each stands for, and the type name it implied. */
const V1_VALUE_TYPES: Record<string, { type: SourceValueType; typeLabel: string }> = {
  byte: { type: "i8", typeLabel: "Byte" },
  ubyte: { type: "u8", typeLabel: "UByte" },
  integer: { type: "i16", typeLabel: "Integer" },
  uinteger: { type: "u16", typeLabel: "UInteger" },
  long: { type: "i32", typeLabel: "Long" },
  ulong: { type: "u32", typeLabel: "ULong" },
  fixed: { type: "fix16.16", typeLabel: "Fixed" },
  float: { type: "float40", typeLabel: "Float" },
  string: { type: "str.heap", typeLabel: "String" },
  boolean: { type: "bool", typeLabel: "Boolean" },
  bool: { type: "bool", typeLabel: "Boolean" },
  char: { type: "char8", typeLabel: "char" },
  pointer: { type: "ptr16", typeLabel: "pointer" }
};

/** A version-1 value type as a representation and its type name; a version-2 representation passes through. */
export function upgradeValueType(type: string, typeLabel?: string): { type: SourceValueType; typeLabel: string } {
  const v1 = V1_VALUE_TYPES[type];
  return v1 ? { type: v1.type, typeLabel: typeLabel ?? v1.typeLabel } : { type, typeLabel: typeLabel ?? type };
}

/**
 * The registers a result of a representation is returned in by the conventions every producer of
 * version 1 followed (Klive runtime ABI §3.1): A for one byte, HL for two bytes and pointers, DE:HL
 * for four bytes, A-E-D-C-B for the ROM's float.
 */
export function defaultReturnRegisters(type: SourceValueType): ReturnRegisters {
  switch (type) {
    case "i8":
    case "u8":
    case "bool":
    case "bool/ff":
    case "char8":
      return "a";
    case "float40":
      return "aedcb";
    case "i32":
    case "u32":
    case "fix16.16":
      return "dehl";
    default:
      return "hl";
  }
}

/** A version-1 call-site kind in version 2's terms (a version-2 kind passes through). */
export function upgradeCallSiteKind(kind: string): Pick<CallSiteDebugInfo, "kind" | "dispatch" | "returnsValue"> {
  switch (kind) {
    case "gosub":
    case "local":
      return { kind: "local" };
    case "on-gosub":
      return { kind: "local", dispatch: true };
    case "function":
      return { kind: "routine", returnsValue: true };
    default:
      return { kind: "routine" };
  }
}

/** Klive BASIC's far-call records (`banking.kz80.asm`): `[bank, return]`, growing up, word-aligned slots. */
export const KLIVE_FAR_RECORDS: FarCallRecordLayout = { size: 3, grows: "up", bankOffset: 0, returnOffset: 1, slotStride: 2 };

/** zxbc's far-call records: `[return, flags, paging]` pushed downwards, slots at any byte. */
export function zxbcFarRecords(bankMask: number): FarCallRecordLayout {
  return { size: 4, grows: "down", bankOffset: 3, returnOffset: 0, bankMask, slotStride: 1 };
}

function upgradeVariable(v: any): VariableDebugInfo {
  const { type, typeLabel } = upgradeValueType(v.type, v.typeLabel);
  const out: VariableDebugInfo = { ...v, type, typeLabel };
  if (v.array) {
    const element = upgradeValueType(v.array.elementType, v.array.elementLabel);
    out.array = {
      ...v.array,
      elementType: element.type,
      elementLabel: element.typeLabel,
      // --- Every version-1 producer's arrays were runtime descriptors (Klive and Boriel BASIC)
      layout: v.array.layout ?? "descriptor"
    };
  }
  return out;
}

function upgradeCodebank(cb: any): CodebankDebugInfo {
  if (cb.records) return cb;
  const { shadowStackKind, bankMask, ...rest } = cb;
  return { ...rest, records: shadowStackKind === "zxbc" ? zxbcFarRecords(bankMask ?? 0xff) : KLIVE_FAR_RECORDS };
}

/** Source-level debug information of version 1 or 2, as version 2. */
export function upgradeSourceLevelDebug(info: SourceLevelDebugInfo): SourceLevelDebugInfo {
  const ext = info.extensions as any;
  if (!ext) return info;
  const { errorEntry, ...rest } = ext;
  return {
    ...info,
    extensions: {
      ...rest,
      variables: (ext.variables ?? []).map(upgradeVariable),
      callSites: (ext.callSites ?? []).map((site: any) => {
        const { kind, ...siteRest } = site;
        return { ...siteRest, ...upgradeCallSiteKind(kind), ...(site.dispatch ? { dispatch: true } : {}), ...(site.returnsValue ? { returnsValue: true } : {}) };
      }),
      frames: (ext.frames ?? []).map((f: any) => {
        if (!f.returnType) return f;
        const { returnType, ...frameRest } = f;
        const { type, typeLabel } = upgradeValueType(returnType);
        return { ...frameRest, returns: { type, typeLabel, in: defaultReturnRegisters(type) } };
      }),
      ...(ext.errorStop ? {} : errorEntry !== undefined ? { errorStop: { entry: errorEntry, code: { register: "a" }, reports: "zx-rom" } } : {}),
      ...(ext.codebank ? { codebank: upgradeCodebank(ext.codebank) } : {})
    }
  } as SourceLevelDebugInfo;
}

/** An activation kind of version 1 (`main`, `gosub`) in version 2's terms. */
export function upgradeActivationKind(kind: string): SourceActivationInfo["kind"] {
  return kind === "main" ? "entry" : kind === "gosub" ? "local" : (kind as SourceActivationInfo["kind"]);
}

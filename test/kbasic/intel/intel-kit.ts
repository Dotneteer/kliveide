import type { BasicIntelData, BasicOccurrence, BasicSymbolInfo } from "@abstractions/BasicIntel";
import { runFrontEnd } from "@main/kbasic/KBasicCompiler";
import { extractBasicIntel } from "@main/kbasic/intel/extract";
import { defaultOptions, type KBasicOptions } from "@main/kbasic/options/options";

/** Front end + extractor over in-memory files; the root is `/p/main.zxbas`. */
export function intelOf(source: string, files: Record<string, string> = {}, options: Partial<KBasicOptions> = {}): BasicIntelData {
  const front = runFrontEnd("/p/main.zxbas", source, { read: (p) => files[p] }, { ...defaultOptions(), ...options }, undefined, { collectDefines: true });
  const errors = front.diagnostics.items.filter((d) => d.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => `${e.code} ${e.message}`).join("; "));
  const intel = extractBasicIntel(front);
  if (!intel) throw new Error("no intel");
  return intel;
}

export function symbolsNamed(intel: BasicIntelData, name: string): BasicSymbolInfo[] {
  return intel.symbols.filter((s) => s.name === name);
}

export function occurrencesOf(intel: BasicIntelData, symbol: BasicSymbolInfo): BasicOccurrence[] {
  return intel.occurrences.filter((o) => o.symbolId === symbol.id);
}

/** `line:column` (1-based line, 0-based column) of each occurrence. */
export function where(occurrences: BasicOccurrence[]): string[] {
  return occurrences.map((o) => `${o.line}:${o.startColumn}-${o.endColumn}${o.editable ? "" : "!"}`);
}

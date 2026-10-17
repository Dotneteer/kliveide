/*
 * zxbc's `-M` memory map (`.ai/boriel/dbg-observed.md`, "The -M memory map"): one `HHHH: .name` per
 * line, or `BB::HHHH: .name` in a banked build (BB the physical bank). Klive takes from it what the
 * `.dbg` does not carry: the runtime's entry points, the user's line labels and the error routine.
 */

export type MapEntry = { name: string; address: number; bank?: number };

const LINE = /^(?:([0-9A-Fa-f]+)::)?([0-9A-Fa-f]{4}):\s*\.(\S+)\s*$/;

export function parseMemoryMap(text: string): MapEntry[] {
  const entries: MapEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const match = LINE.exec(raw.trim());
    if (!match) continue;
    const [, bank, address, name] = match;
    entries.push({ name, address: parseInt(address, 16), ...(bank !== undefined ? { bank: parseInt(bank, 16) } : {}) });
  }
  return entries;
}

export type MapSymbols = {
  /** The runtime's labels (`core.*`), for disassembly labels and the call stack's runtime rows. */
  runtimeSymbols: { name: string; address: number }[];
  /** The user's line numbers and labels (`.LABEL._1000` → "1000"), for naming GOSUB rows. */
  labels: { name: string; address: number }[];
  /** The runtime's error routine (`core.__ERROR`): entered with the error code in A on every arch. */
  errorEntry?: number;
};

export function mapSymbols(entries: MapEntry[]): MapSymbols {
  const runtimeSymbols = entries
    .filter((e) => e.name.startsWith("core."))
    .map((e) => ({ name: e.name, address: e.address }))
    .sort((a, b) => a.address - b.address);
  // --- `.LABEL._name` is the user's; `.LABEL.__LABELn` (two underscores) is the compiler's
  const labels = entries
    .filter((e) => /^LABEL\._(?!_)/.test(e.name))
    .map((e) => ({ name: e.name.slice("LABEL._".length), address: e.address }))
    .sort((a, b) => a.address - b.address);
  const errorEntry = entries.find((e) => e.name === "core.__ERROR")?.address;
  return { runtimeSymbols, labels, ...(errorEntry !== undefined ? { errorEntry } : {}) };
}

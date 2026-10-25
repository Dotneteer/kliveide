import type { CompiledModule } from "../z80-backend/link/compile-module";
import { mirText } from "../z80-backend/mir/print";

/**
 * The build artefacts a source may ask for (Klive BASIC's `emit-*` header options, plan §5.3, §9.3),
 * written beside the source by a foreground build — the same for every language the shared Z80 back
 * end compiles. Contents only: the compiler decides the names (`<name>.<tag>.<ext>`, the tag being
 * the language's: `kbasic`), `Z80LanguageCompiler` writes them.
 *
 * | Request | Files |
 * | --- | --- |
 * | `asm` | `<name>.<tag>.asm` — the generated program as assembler text (the runtime is not included) |
 * | `ir` | `<name>.<tag>.ir` — the MIR of every routine |
 * | `map` | `<name>.<tag>.map` — every label with its address (and `B<n>:` for a bank's); with banked code also `<name>.banks.json` and `<name>.bank<n>.bin` |
 *
 * The banks manifest follows the shape NextBuild's tools read (`.ai/kbasic/codebank-contract.md` §5):
 * `{window, window_size, banks: [{bank, file, org, size, page, pages}]}` sorted by bank, each bank's
 * code and data in its `.bin`, assembled at the window.
 */
export type EmittedFile = { suffix: string; content: string | Uint8Array };

/** What a build asks to have written. */
export type EmitRequest = { asm?: boolean; ir?: boolean; map?: boolean };

export function emittedFiles(compiled: CompiledModule, request: EmitRequest, programName: string, tag: string): EmittedFile[] {
  const files: EmittedFile[] = [];
  if (request.asm) files.push({ suffix: `.${tag}.asm`, content: compiled.emitted.text + "\n" });
  if (request.ir) files.push({ suffix: `.${tag}.ir`, content: mirText(compiled.mir) });
  if (request.map) {
    files.push({ suffix: `.${tag}.map`, content: labelMap(compiled) });
    files.push(...banksManifest(compiled, programName));
  }
  return files;
}

// =================================================================================================
// The label map

/** Each label of the generated program and the runtime, by address; a banked label is prefixed `B<n>:`. */
export function labelMap(generated: CompiledModule): string {
  const bankOf = labelBanks(generated.emitted.text);
  const rows: { address: number; name: string }[] = [];
  const add = (prefix: string, symbols: Record<string, { value?: { value?: unknown } }>) => {
    for (const [name, info] of Object.entries(symbols)) {
      const value = info.value?.value;
      if (typeof value !== "number") continue;
      const full = prefix + name;
      const bank = bankOf.get(full);
      rows.push({ address: value & 0xffff, name: bank ? `B${bank}:${full}` : full });
    }
  };
  add("", generated.output.symbols as Record<string, { value?: { value?: unknown } }>);
  const core = generated.output.getNestedModule("core");
  if (core) add("core.", core.symbols as Record<string, { value?: { value?: unknown } }>);
  rows.sort((a, b) => a.address - b.address || a.name.localeCompare(b.name));
  return rows.map((r) => `$${r.address.toString(16).toUpperCase().padStart(4, "0")} ${r.name}`).join("\n") + "\n";
}

/** The bank of every label defined in a bank section of the generated text. */
function labelBanks(text: string): Map<string, number> {
  const out = new Map<string, number>();
  let bank: number | undefined;
  for (const line of text.split("\n")) {
    const section = /^__kbBank(\d+):/.exec(line);
    if (section) {
      bank = Number(section[1]);
      continue;
    }
    if (/^\s+\.org\s+__kbResidentEnd\b/.test(line)) bank = undefined;
    const label = /^([A-Za-z_][\w.]*):/.exec(line);
    if (label && bank !== undefined) out.set(label[1], bank);
  }
  return out;
}

// =================================================================================================
// The banks manifest

function banksManifest(generated: CompiledModule, programName: string): EmittedFile[] {
  const codebank = generated.debug.sourceLevel.extensions?.codebank;
  if (!codebank) return [];
  const files: EmittedFile[] = [];
  const banks = [...codebank.banks].sort((a, b) => a.bank - b.bank).map(({ bank, pages }) => {
    // --- The bank's segment: assembled at the window, placed in its first page's 16K bank
    const segment = generated.output.segments.find(
      (s) => s.startAddress === codebank.window && s.bank === pages[0] >> 1 && (s.bankOffset ?? 0) === (pages[0] & 1) * 0x2000
    );
    const code = Uint8Array.from(segment?.emittedCode ?? []);
    const file = `${programName}.bank${bank}.bin`;
    files.push({ suffix: `.bank${bank}.bin`, content: code });
    return { bank, file, org: codebank.window, size: code.length, page: pages[0], pages };
  });
  const manifest = { window: codebank.window, window_size: codebank.windowSize, banks };
  return [{ suffix: ".banks.json", content: JSON.stringify(manifest, null, 2) + "\n" }, ...files];
}

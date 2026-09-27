import type { GeneratedProgram } from "./codegen";
import type { Block, Instr, MFunction, MModule, Slot, Terminator } from "./ir/mir";
import { symText, vregText } from "./ir/mir";
import type { KBasicOptions } from "./options/options";

/**
 * The files the `emit-*` header options ask for (plan §5.3, §9.3), written beside the source by a
 * foreground build. Contents only: the compiler decides the names, `KBasicCompiler` writes them.
 *
 * | Option | Files |
 * | --- | --- |
 * | `emit-asm` | `<name>.kbasic.asm` — the generated program as assembler text (the runtime is not included) |
 * | `emit-ir` | `<name>.kbasic.ir` — the MIR of every routine |
 * | `emit-map` | `<name>.kbasic.map` — every label with its address (and `B<n>:` for a CODEBANK bank's); with CODEBANK also `<name>.banks.json` and `<name>.bank<n>.bin` |
 *
 * The banks manifest follows the shape NextBuild's tools read (`.ai/kbasic/codebank-contract.md` §5):
 * `{window, window_size, banks: [{bank, file, org, size, page, pages}]}` sorted by bank, each bank's
 * code and data in its `.bin`, assembled at the window.
 */
export type EmittedFile = { suffix: string; content: string | Uint8Array };

export function emittedFiles(generated: GeneratedProgram, options: KBasicOptions, programName: string): EmittedFile[] {
  const files: EmittedFile[] = [];
  if (options.emitAsm) files.push({ suffix: ".kbasic.asm", content: generated.emitted.text + "\n" });
  if (options.emitIr) files.push({ suffix: ".kbasic.ir", content: mirText(generated.mir) });
  if (options.emitMap) {
    files.push({ suffix: ".kbasic.map", content: labelMap(generated) });
    files.push(...banksManifest(generated, programName));
  }
  return files;
}

// =================================================================================================
// The label map

/** Each label of the generated program and the runtime, by address; a banked label is prefixed `B<n>:`. */
export function labelMap(generated: GeneratedProgram): string {
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

/** The CODEBANK bank of every label defined in a bank section of the generated text. */
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
// The CODEBANK manifest

function banksManifest(generated: GeneratedProgram, programName: string): EmittedFile[] {
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

// =================================================================================================
// The MIR dump

export function mirText(mir: MModule): string {
  const out: string[] = [];
  for (const fn of mir.functions) out.push(...functionText(fn), "");
  return out.join("\n");
}

function functionText(fn: MFunction): string[] {
  const params = fn.params.map((p) => `${p.name}: ${p.type} @ix${p.offset >= 0 ? "+" : ""}${p.offset}`).join(", ");
  const lines = [
    `${fn.kind} ${fn.label}(${params})${fn.returnType ? `: ${fn.returnType}` : ""}  ; ${fn.convention}, frame ${fn.frameSize}, args ${fn.argBytes}${fn.bank ? `, CODEBANK ${fn.bank}` : ""}`
  ];
  for (const l of fn.locals) lines.push(`  local ${l.name}: ${l.type} @ix${l.offset}`);
  for (const b of fn.blocks) lines.push(...blockText(b));
  return lines;
}

function blockText(b: Block): string[] {
  const lines = [`${b.label}:`];
  for (const i of b.instrs) lines.push(`    ${instrText(i)}`);
  if (b.term) lines.push(`    ${termText(b.term)}`);
  return lines;
}

function slotText(s: Slot): string {
  switch (s.kind) {
    case "global":
      return `[${s.name}]`;
    case "frame":
      return `[ix${s.offset >= 0 ? "+" : ""}${s.offset}]`;
    case "deref":
      return `[${vregText(s.ptr)}]`;
  }
}

function instrText(i: Instr): string {
  const at = `  ; s${i.sid}`;
  switch (i.op) {
    case "stmt":
      return `; --- statement ${i.sid}`;
    case "prologue.end":
    case "epilogue.begin":
      return `; ${i.op}`;
    case "const":
      return `${vregText(i.dst)}:${i.dst.type} = ${i.value.kind === "sym" ? `@${symText(i.value)}` : i.value.value}${at}`;
    case "load":
      return `${vregText(i.dst)}:${i.dst.type} = load ${slotText(i.slot)}${at}`;
    case "store":
      return `store.${i.type} ${slotText(i.slot)}, ${vregText(i.src)}${at}`;
    case "addr":
      return `${vregText(i.dst)} = addr ${slotText(i.slot)}${at}`;
    case "bin":
      return `${vregText(i.dst)}:${i.dst.type} = ${i.bop} ${vregText(i.a)}, ${vregText(i.b)}${at}`;
    case "neg":
    case "not":
    case "lnot":
    case "conv":
      return `${vregText(i.dst)}:${i.dst.type} = ${i.op} ${vregText(i.a)}${at}`;
    case "call":
      return `${i.dst ? `${vregText(i.dst)}:${i.dst.type} = ` : ""}call.${i.convention} ${i.target}(${i.args.map(vregText).join(", ")})${at}`;
    case "rtcall":
      return `${i.dst ? `${vregText(i.dst)}:${i.dst.type} = ` : ""}rtcall ${i.name}(${i.args.map(vregText).join(", ")})${at}`;
    case "asm":
      return `asm {${i.lines.length} lines}${at}`;
  }
}

function termText(t: Terminator): string {
  const at = `  ; s${t.sid}`;
  switch (t.op) {
    case "jmp":
      return `jmp ${t.target}${at}`;
    case "br":
      return `br ${vregText(t.cond)}, ${t.ifTrue}, ${t.ifFalse}${at}`;
    case "switch":
      return `switch ${vregText(t.sel)}, [${t.targets.join(", ")}], ${t.otherwise}${at}`;
    case "gosub":
      return `gosub ${t.target}, ${t.next}${at}`;
    case "ongosub":
      return `ongosub ${vregText(t.sel)}, [${t.targets.join(", ")}], ${t.next}${at}`;
    case "ret":
      return `ret${t.value ? ` ${vregText(t.value)}` : ""}${at}`;
    case "end":
      return `end ${vregText(t.code)}${at}`;
    case "raise":
      return `raise ${vregText(t.code)}${at}`;
  }
}

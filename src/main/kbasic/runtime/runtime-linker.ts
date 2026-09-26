import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import type { ParsedSourceUnit } from "@main/compiler-common/common-assembler";
import type { Z80Node } from "@main/z80-compiler/assembler-tree-nodes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { runtimeBundle } from "./generated/runtime-bundle";
import type { RuntimeModule } from "./runtime-types";

/** The virtual folder the runtime units' file names live in. */
export const RUNTIME_FOLDER = "<kbasic-runtime>";

/** The default heap size, as upstream's (runtime-abi.md §5). */
export const DEFAULT_HEAP_SIZE = 4768;

/** Where the heap goes: after the program (the default) or at a fixed address. */
export type RuntimeLayout = {
  heapSize?: number;
  heapAddress?: number;
};

const modulesByName = new Map(runtimeBundle.modules.map((m) => [m.name, m]));
const moduleByLabel = new Map<string, RuntimeModule>();
for (const m of runtimeBundle.modules) {
  for (const label of m.exports) moduleByLabel.set(label.toLowerCase(), m);
}

/** A runtime module by name; throws for an unknown one. */
export function getRuntimeModule(name: string): RuntimeModule {
  const module = modulesByName.get(name);
  if (!module) throw new Error(`Unknown Klive BASIC runtime module '${name}'.`);
  return module;
}

/**
 * The modules a program needs: those exporting the given labels (with or without `core.`) and
 * everything they require, in link order - a module after the modules it requires, otherwise in
 * name order. Throws for a label no module exports: that is a compiler bug, not a user error.
 */
export function resolveRuntimeModules(labels: Iterable<string>, moduleNames: Iterable<string> = []): RuntimeModule[] {
  const wanted = new Set<string>(moduleNames);
  for (const label of labels) {
    const bare = label.replace(/^core\./i, "");
    const module = moduleByLabel.get(bare.toLowerCase());
    if (!module) throw new Error(`No Klive BASIC runtime module exports '${label}'.`);
    wanted.add(module.name);
  }

  const ordered: RuntimeModule[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (name: string) => {
    if (state.get(name)) return; // the generator rejects @requires cycles
    state.set(name, "visiting");
    const module = getRuntimeModule(name);
    for (const r of [...module.requires].sort()) visit(r);
    state.set(name, "done");
    ordered.push(module);
  };
  for (const name of [...wanted].sort()) visit(name);
  return ordered;
}

/** The initialisers of the modules, in link order (so an initialiser runs after those it relies on). */
export function runtimeInitialisers(modules: RuntimeModule[]): string[] {
  return modules.filter((m) => m.init).map((m) => `core.${m.init}`);
}

/**
 * The start of a program: saves what END restores and what the debugger reads (plan §6.2, §10.2.2),
 * sets IY for the ROM, and calls the initialisers. The main program follows it directly.
 */
export function prologueSource(initialisers: string[]): string {
  return [
    "    ld (core.SavedIY),iy",
    "    ld (core.SavedIX),ix",
    "    exx",
    "    ld (core.SavedHL2),hl",
    "    exx",
    "    ld (core.ProgramSP),sp",
    "    ld iy,$5c3a",
    ...initialisers.map((label) => `    call ${label}`)
  ].join("\n");
}

/** `END n`: n in BC, back to the program's caller. */
export function endSource(value = 0): string {
  return [`    ld bc,${value & 0xffff}`, "    jp core.End"].join("\n");
}

function coreOpenSource(layout: RuntimeLayout): string {
  const lines = ["    .module core", `HeapSize .equ ${layout.heapSize ?? DEFAULT_HEAP_SIZE}`];
  if (layout.heapAddress !== undefined) lines.push(`HeapStart .equ ${layout.heapAddress}`);
  return lines.join("\n");
}

function coreCloseSource(layout: RuntimeLayout): string {
  const lines: string[] = [];
  if (layout.heapAddress === undefined) lines.push("HeapStart:", "    .defs HeapSize");
  lines.push("    .moduleend");
  return lines.join("\n");
}

/**
 * Parses runtime modules once and hands out the parsed units, per target model and defines (plan
 * §4.1: re-parsing the runtime on every background build would dominate build time).
 */
export class RuntimeUnitCache {
  private readonly units = new Map<string, Promise<ParsedSourceUnit<Z80Node>>>();

  async unit(module: RuntimeModule, options: AssemblerOptions): Promise<ParsedSourceUnit<Z80Node>> {
    const defines = Object.keys(options.predefinedSymbols ?? {}).sort().join(",");
    const key = `${module.name}|${options.currentModel}|${defines}|${options.useCaseSensitiveSymbols}`;
    let unit = this.units.get(key);
    if (!unit) {
      unit = new Z80Assembler().parseSourceUnit(`${RUNTIME_FOLDER}/${module.name}.kz80.asm`, module.text, options);
      this.units.set(key, unit);
    }
    return await unit;
  }
}

const defaultCache = new RuntimeUnitCache();

/**
 * The units that follow a program: `core` opened with the layout's equates, the modules, the heap
 * area (unless it is at a fixed address), `core` closed.
 */
export async function runtimeUnits(
  modules: RuntimeModule[],
  options: AssemblerOptions,
  layout: RuntimeLayout = {},
  cache: RuntimeUnitCache = defaultCache
): Promise<ParsedSourceUnit<Z80Node>[]> {
  const assembler = new Z80Assembler();
  const open = await assembler.parseSourceUnit(`${RUNTIME_FOLDER}/core-open.kz80.asm`, coreOpenSource(layout), options);
  const close = await assembler.parseSourceUnit(`${RUNTIME_FOLDER}/core-close.kz80.asm`, coreCloseSource(layout), options);
  const moduleUnits = await Promise.all(modules.map((m) => cache.unit(m, options)));
  return [open, ...moduleUnits, close];
}

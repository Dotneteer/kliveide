import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import type { ParsedSourceUnit } from "@main/compiler-common/common-assembler";
import type { Z80Node } from "@main/z80-compiler/assembler-tree-nodes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";

import { corePackage } from "./generated/core-package";
import { zxPackage } from "./generated/zx-package";
import type { RuntimeModule, RuntimePackage } from "./runtime-types";

/**
 * The virtual folder the runtime units' file names live in. Its historical name is kept: it is in
 * every build's listing, and changing it would change the debug information of every program.
 */
export const RUNTIME_FOLDER = "<kbasic-runtime>";

/** The default heap size, as upstream's (runtime-abi.md §5). */
export const DEFAULT_HEAP_SIZE = 4768;

/** Where the heap goes: after the program (the default) or at a fixed address. */
export type RuntimeLayout = {
  heapSize?: number;
  heapAddress?: number;
  /** The heap is the program's (after its variables, at this label), not the runtime's own block. */
  heapLabel?: string;
  /**
   * CODEBANK (plan §9): the far-call runtime's parameters — the window's first MMU slot and its
   * size in 8K slots, the nesting depth, and each logical bank's first 8K page (index 0 is the
   * resident "bank", whose page(s) `FarInit` reads at start-up).
   */
  codebank?: { slot: number; slots: number; depth: number; pages: number[] };
};

/** The back end's own packages (`.plans/SHARED_Z80_BACKEND_PLAN.md` §3.2): every program may link them. */
export const BACKEND_PACKAGES: readonly RuntimePackage[] = [corePackage, zxPackage];

/**
 * The runtime a program links from: the back end's packages and its language's. Every module
 * links into the one assembler module `core` (labels `core.<label>`), so names and labels are
 * unique across all of them (`scripts/runtime-index.cjs` checks it).
 */
export class RuntimeLibrary {
  private readonly modulesByName = new Map<string, RuntimeModule>();
  private readonly moduleByLabel = new Map<string, RuntimeModule>();
  private readonly contract = new Map<string, string[]>();

  constructor(readonly packages: readonly RuntimePackage[]) {
    for (const pkg of packages) {
      for (const m of pkg.modules) {
        this.modulesByName.set(m.name, m);
        for (const label of m.exports) this.moduleByLabel.set(label.toLowerCase(), m);
        for (const [routine, regs] of Object.entries(m.abi)) this.contract.set(`core.${routine}`, regs);
      }
    }
  }

  /** A runtime module by name; throws for an unknown one. */
  module(name: string): RuntimeModule {
    const module = this.modulesByName.get(name);
    if (!module) throw new Error(`Unknown runtime module '${name}'.`);
    return module;
  }

  /** Whether a label (without `core.`) is a module's export. */
  exports(label: string): boolean {
    return this.moduleByLabel.has(label.toLowerCase());
  }

  /**
   * The register contract of a runtime routine (`core.X`, or `core.X!variant`): which register each
   * argument arrives in, from the modules' `@abi` lines; undefined when no module declares one.
   */
  argumentsOf(routine: string): string[] | undefined {
    return this.contract.get(routine);
  }

  /**
   * The modules a program needs: those exporting the given labels (with or without `core.`) and
   * everything they require, in link order - a module after the modules it requires, otherwise in
   * name order. Throws for a label no module exports: that is a compiler bug, not a user error.
   */
  resolve(labels: Iterable<string>, moduleNames: Iterable<string> = []): RuntimeModule[] {
    const wanted = new Set<string>(moduleNames);
    for (const label of labels) {
      const bare = label.replace(/^core\./i, "");
      const module = this.moduleByLabel.get(bare.toLowerCase());
      if (!module) throw new Error(`No runtime module exports '${label}'.`);
      wanted.add(module.name);
    }

    const ordered: RuntimeModule[] = [];
    const state = new Map<string, "visiting" | "done">();
    const visit = (name: string) => {
      if (state.get(name)) return; // the generator rejects @requires cycles
      state.set(name, "visiting");
      const module = this.module(name);
      for (const r of [...module.requires].sort()) visit(r);
      state.set(name, "done");
      ordered.push(module);
    };
    for (const name of [...wanted].sort()) visit(name);
    return ordered;
  }
}

const libraries = new Map<string, RuntimeLibrary>();

/** The library of the back end's packages and a language's (one instance per set of packages). */
export function runtimeLibrary(languagePackages: readonly RuntimePackage[] = []): RuntimeLibrary {
  const key = languagePackages.map((p) => p.name).join(",");
  let library = libraries.get(key);
  if (!library) {
    library = new RuntimeLibrary([...BACKEND_PACKAGES, ...languagePackages]);
    libraries.set(key, library);
  }
  return library;
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
  else if (layout.heapLabel) lines.push(`HeapStart .equ ${layout.heapLabel}`);
  const cb = layout.codebank;
  if (cb) lines.push(`FarReg .equ ${0x50 + cb.slot}`, `FarSlots .equ ${cb.slots}`, `FarDepth .equ ${cb.depth}`);
  return lines.join("\n");
}

function coreCloseSource(layout: RuntimeLayout): string {
  const lines: string[] = [];
  const cb = layout.codebank;
  if (cb) {
    // --- The page table: a row per logical bank (one byte, two for a 16K window), then the shadow stack
    const rows = cb.pages.flatMap((page) => (cb.slots === 2 ? [page, page + 1] : [page]));
    lines.push("FarPages:", `    .defb ${rows.join(",")}`, "FarStack:", `    .defs ${3 * cb.depth}`);
  }
  if (layout.heapAddress === undefined && !layout.heapLabel) lines.push("HeapStart:", "    .defs HeapSize");
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

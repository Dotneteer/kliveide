/**
 * One runtime module, as `scripts/runtime-index.cjs` reads it from the header of a
 * `<package folder>/<name>.kz80.asm` (see `README.md` next to this file).
 */
export type RuntimeModule = {
  /** The module name: the file name without `.kz80.asm`. */
  name: string;
  /** The package it belongs to: `core`, `zx`, or a language's (`kbasic`). */
  package: string;
  /** One line: what the module is for. */
  summary: string;
  /** The labels other code may call or read, as `core.<label>`. */
  exports: string[];
  /** The modules whose labels this module uses. */
  requires: string[];
  /** The label the program start-up calls once, before the main program, if any. */
  init?: string;
  /** The compiler-defined symbols the module tests with `#ifdef`/`#ifndef`. */
  symbols: string[];
  /**
   * The register contract (`; @abi Name(regs)`): which register each argument of a routine arrives
   * in, by routine (`Name`, or `Name!variant` for the same routine with its arguments evaluated in
   * another order). `stack`: the argument stays on the Z80 stack (the routine removes it).
   */
  abi: Record<string, string[]>;
  /** The module's source text, LF line ends. */
  text: string;
};

/** A runtime package: the modules one folder holds (`core`, `zx`, a language's own). */
export type RuntimePackage = {
  name: string;
  modules: RuntimeModule[];
};

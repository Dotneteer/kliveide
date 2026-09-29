/**
 * One Klive BASIC runtime module, as `scripts/kbasic-runtime-index.cjs` reads it from the header of
 * `src/main/kbasic/runtime/<name>.kz80.asm` (see the README next to this file).
 */
export type RuntimeModule = {
  /** The module name: the file name without `.kz80.asm`. */
  name: string;
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
  /** The module's source text, LF line ends. */
  text: string;
};

/** One Klive BASIC standard-library file (`src/main/kbasic/stdlib/<name>.bas`). */
export type StdlibFile = {
  /** The file name, as `#include <name>` names it. */
  name: string;
  /** The file's text, LF line ends. */
  text: string;
};

/** Everything the compiler needs from the runtime and library folders, embedded in the build. */
export type RuntimeBundle = {
  modules: RuntimeModule[];
  stdlib: StdlibFile[];
  /** The library files upstream documents (`.ai/kbasic/stdlib-api.json`), written or not. */
  documented: string[];
};

/**
 * What a front end tells the shared Z80 back end about a build (`.plans/SHARED_Z80_BACKEND_PLAN.md`
 * §3.1). A language translates its own option syntax (Klive BASIC's header comments, a Pascal
 * compiler's directives) into this.
 */

/** The machines the back end generates code for. */
export type BackendTarget = "zx48k" | "zx128k" | "zxplus3" | "next";

export type BackendOptions = {
  target: BackendTarget;
  /** The optimisation level asked for (0-3 are generated; a higher one is generated at 3). */
  optimize: number;
  /** Where the program starts. */
  origin: number;
  /** No start-up code (no saved registers, no runtime initialisers). */
  headerless?: boolean;
  /** The heap's size, and its fixed address (absent: it follows the program's variables). */
  heapSize: number;
  heapAddress?: number;
  /** The runtime checks the heap's integrity on every call (`KB_CHECK_MEMORY`). */
  checkMemory?: boolean;
  /** Z80N instructions are allowed in inline assembly and the runtime. */
  z80n?: boolean;
  /** Banked code (CODEBANK in Klive BASIC): the window, its size, the pages and the far-call depth. */
  codebank: { window: number; windowSize: "8k" | "16k"; firstPage: number; pages?: number[]; depth: number };
  /** The Next's NEX file: its core version, stack and entry (an address, or a label's text). */
  nex: { core: string; stack?: number; entry?: number | string };
};

/** The optimisation level code is generated at (0-3). */
export function effectiveLevel(requested: number): number {
  return Math.min(requested, 3);
}

/** The highest optimisation level a debug build uses when the source does not ask for one (Klive BASIC plan §8.6). */
export const DEBUG_PROFILE_LEVEL = 1;

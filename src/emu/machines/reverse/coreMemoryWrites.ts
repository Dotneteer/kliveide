/*
 * The journaled way to write straight into a core's linear memory (`.plans/REVERSE_DEBUGGING_PLAN.md`
 * D7, Phase 1).
 *
 * Most host input reaches a core through its exports, which the journal wraps. Some arrives as bytes
 * the TypeScript side writes into the core's memory itself: tape and ROM uploads, Z88 cards, the
 * Timex DOCK, the Next's SD sector data. Those writes go through `writeCoreBytes` / `fillCoreBytes`,
 * which do the write and, while a journal is attached to the runtime, record it with its position -
 * or, while the journal is muted for a replay, drop it like any other live input (D8).
 *
 * Writes into *volatile* statics (breakpoint flags, NextReg and Copper watches) are debugging state
 * and stay plain `set` calls.
 */

/** Where an attached journal hangs on a runtime object */
const CORE_WRITE_HOOK = Symbol.for("klive.reverse.coreWriteHook");

/** What a journal attaches to a runtime to see its memory writes */
export interface CoreWriteHook {
  /**
   * Called before a write of `length` bytes at `address`, `bytes` holding them (or `fill`, a value
   * repeated `length` times)
   * @returns false when the write must be dropped (a muted journal)
   */
  beforeWrite(address: number, length: number, bytes?: Uint8Array, fill?: number): boolean;
}

/** Attaches (or with undefined, detaches) a journal's hook */
export function setCoreWriteHook(runtime: object, hook: CoreWriteHook | undefined): void {
  if (hook) (runtime as Record<symbol, unknown>)[CORE_WRITE_HOOK] = hook;
  else delete (runtime as Record<symbol, unknown>)[CORE_WRITE_HOOK];
}

function hookOf(runtime: object): CoreWriteHook | undefined {
  return (runtime as Record<symbol, CoreWriteHook | undefined>)[CORE_WRITE_HOOK];
}

type CoreView = Uint8Array | Uint16Array | Uint32Array | Int16Array | Int32Array;

/**
 * `view.set(data, offset)` on a view of a core's memory, journaled
 * @param runtime The core runtime the view belongs to
 */
export function writeCoreBytes(runtime: object, view: CoreView, data: ArrayLike<number>, offset = 0): void {
  const hook = hookOf(runtime);
  if (hook) {
    const unit = view.BYTES_PER_ELEMENT;
    const address = view.byteOffset + offset * unit;
    const length = data.length * unit;
    // --- The bytes as they will land, whatever the view's element type
    const staged = new (view.constructor as new (n: number) => CoreView)(data.length);
    staged.set(data as never);
    const bytes = new Uint8Array(staged.buffer, 0, length).slice();
    if (!hook.beforeWrite(address, length, bytes)) return;
  }
  view.set(data as never, offset);
}

/** `view.fill(value, start, end)` on a byte view of a core's memory, journaled */
export function fillCoreBytes(runtime: object, view: Uint8Array, value: number, start = 0, end = view.length): void {
  const hook = hookOf(runtime);
  if (hook) {
    const from = Math.max(0, Math.min(view.length, start));
    const to = Math.max(from, Math.min(view.length, end));
    if (!hook.beforeWrite(view.byteOffset + from, to - from, undefined, value & 0xff)) return;
  }
  view.fill(value, start, end);
}

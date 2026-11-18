import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { MainApi } from "@common/messaging/MainApi";
import { incEmuViewVersionAction } from "@common/state/actions";
import { takeOverBeforeEdit } from "@renderer/appIde/commands/reverseDebugFork";

/*
 * The Memory view's write path for type-over and the inspector's Set
 * (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §5.3, risk "History"): the one `setmem` takes - an
 * edit in the past takes over there first, after asking (REVERSE_DEBUGGING_PLAN D12) - but able to
 * write into a partition shown on its own, which `setmem`'s 64K address cannot name.
 */

export type MemoryEditDeps = {
  store: Store<AppState>;
  emuApi: EmuApi;
  mainApi: MainApi;
};

/**
 * Write bytes at a CPU address, or at an offset of a partition.
 * @returns false when the user declined to take over in the past (nothing was written)
 */
export async function writeMemoryEdit(
  deps: MemoryEditDeps,
  address: number,
  bytes: readonly number[],
  partition?: number
): Promise<boolean> {
  if (!(await takeOverBeforeEdit(deps, { kind: "editMemory" }))) return false;
  await deps.emuApi.setMemoryBytes(address, Uint8Array.from(bytes, (b) => b & 0xff), partition);
  deps.store.dispatch(incEmuViewVersionAction(), "ide");
  return true;
}

/** A value's bytes: 1, 2 or 4 of them, little-endian unless `bigEndian` */
export function valueBytes(value: number, size: 1 | 2 | 4, bigEndian = false): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < size; i++) bytes.push((value >>> (8 * i)) & 0xff);
  return bigEndian ? bytes.reverse() : bytes;
}

/** Type-over (§5.3): the digits typed so far over the cursor byte */
export type TypeOver = { text: string };

/**
 * One key of type-over. A hex digit (decimal in Decimal) adds to the byte being typed; the byte is
 * written when it is complete (two hex digits, or three decimal ones, or a decimal value another
 * digit would push past 255). Enter writes a partial value; Escape drops it.
 * @returns The new state, and the value to write when the byte is complete or Enter commits it;
 * undefined when the key is not type-over's
 */
export function typeOverKey(
  state: TypeOver | undefined,
  key: string,
  decimal: boolean
): { state: TypeOver | undefined; commit?: number } | undefined {
  if (key === "Escape") return state ? { state: undefined } : undefined;
  if (key === "Enter") {
    if (!state?.text) return undefined;
    return { state: undefined, commit: parseInt(state.text, decimal ? 10 : 16) & 0xff };
  }
  if (key === "Backspace") {
    if (!state?.text) return undefined;
    const text = state.text.slice(0, -1);
    return { state: text ? { text } : undefined };
  }
  const digit = decimal ? /^[0-9]$/.test(key) : /^[0-9a-fA-F]$/.test(key);
  if (!digit) return undefined;
  const text = (state?.text ?? "") + key.toUpperCase();
  if (decimal) {
    const value = parseInt(text, 10);
    if (value > 255) return { state: { text: key }, commit: parseInt(state!.text, 10) };
    if (text.length === 3 || value * 10 > 255) return { state: undefined, commit: value };
    return { state: { text } };
  }
  if (text.length === 2) return { state: undefined, commit: parseInt(text, 16) };
  return { state: { text } };
}

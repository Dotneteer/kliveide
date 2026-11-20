import type { EmuApi, PaletteDeviceInfo } from "@common/messaging/EmuApi";

/*
 * Reading the Next's palettes only when they changed (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §5).
 *
 * `getPalettedDeviceInfo` is 2048 entries; `getPaletteVersion` is one number that changes with every
 * entry write, live-bank flip, reset, state restore and "written since the last stop" reset. The
 * Next Palettes panel and `useNextDevicePalette` poll on the state listener's cadence, so a palette
 * that did not change costs one number instead of 2048.
 */

/**
 * The palettes, or `previous` itself (the same object, so a React state setter skips the render) when
 * the machine reports the version `previous` was read at.
 *
 * Without a version - no previous read, an older reader, or a machine that cannot say - it reads.
 * Errors of the full read propagate (no machine, not a Next); a failed version query only means
 * "read".
 */
export async function readNextPalette(
  emuApi: Pick<EmuApi, "getPaletteVersion" | "getPalettedDeviceInfo">,
  previous?: PaletteDeviceInfo
): Promise<PaletteDeviceInfo> {
  if (previous?.version !== undefined) {
    let version: number | undefined;
    try {
      version = await emuApi.getPaletteVersion();
    } catch {
      version = undefined;
    }
    if (version === previous.version) return previous;
  }
  return emuApi.getPalettedDeviceInfo();
}

/**
 * How many entries of a palette slot (`0..7`, the `$43` order) were written since the last stop,
 * from `PaletteDeviceInfo.written`.
 */
export function writtenEntryCount(info: PaletteDeviceInfo | undefined, slot: number): number {
  const written = info?.written;
  if (!written) return 0;
  let count = 0;
  for (let i = slot * 32; i < slot * 32 + 32; i++) {
    let byte = written[i] ?? 0;
    while (byte) {
      count += byte & 1;
      byte >>= 1;
    }
  }
  return count;
}

/** Whether entry `index` of slot `slot` was written since the last stop. */
export function isEntryWritten(info: PaletteDeviceInfo | undefined, slot: number, index: number): boolean {
  const byte = info?.written?.[slot * 32 + (index >> 3)] ?? 0;
  return (byte & (1 << (index & 7))) !== 0;
}

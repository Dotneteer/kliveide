import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaletteDeviceInfo } from "@common/messaging/EmuApi";
import { paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { nextPaletteDevice, type NextPaletteDeviceId } from "./nextPaletteDevices";

/*
 * The live palette of one Next device (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.6, D6): the bank the
 * device draws with, or a pinned one, read at the state panels' cadence. `useSpritePalette` is this
 * hook for the sprites plus the sprite editor's visible fallback; the Tilemap Inspector uses it for
 * the tilemap.
 *
 * With no machine, or one that is not a Next, `palette` is undefined: a caller decides whether to
 * show an empty state (the inspectors) or a labelled fallback (the sprite editor). It never invents
 * colours.
 */

export type NextDevicePalette = {
  /** 256 palette codes in the **register** layout, or undefined with no Next */
  palette: number[] | undefined;
  /** The same 256 entries as the device stores them (9-bit RRRGGGBBB), for RGB compares ($14) */
  deviceValues: number[] | undefined;
  /** The device's transparency index, where it has one */
  transparencyIndex: number | undefined;
  /** The bank on screen */
  shownBank: 0 | 1;
  /** The bank the device draws with, or undefined with no machine */
  liveBank: 0 | 1 | undefined;
  /** Pins the view to a bank (the hook's own pin; `bank` overrides it) */
  pinBank: (bank: 0 | 1 | null) => void;
};

export type UseNextDevicePaletteOptions = {
  /** Show this bank whatever the machine selects or was pinned (a caller that keeps the choice) */
  bank?: 0 | 1;
  /** Whether to read the machine at all (default `true`); enabling it reads at once */
  enabled?: boolean;
  /**
   * The live bank when the caller knows it better than `PaletteDeviceInfo` (the Tilemap Inspector's
   * snapshot has `$6B` bit 4 from the core's palette module)
   */
  liveBank?: 0 | 1;
};

const sameValues = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function useNextDevicePalette(
  device: NextPaletteDeviceId,
  options: UseNextDevicePaletteOptions = {}
): NextDevicePalette {
  const emuApi = useEmuApi();
  const [info, setInfo] = useState<PaletteDeviceInfo | undefined>(undefined);
  const [pinnedBank, setPinnedBank] = useState<0 | 1 | null>(null);
  const def = nextPaletteDevice(device);

  const enabled = options.enabled ?? true;
  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setInfo(await emuApi.getPalettedDeviceInfo());
    } catch {
      // --- No machine controller, or not a Next: the caller shows its own empty state or fallback
      setInfo(undefined);
    }
  }, [emuApi, enabled]);

  useEmuStateListener(emuApi, refresh, enabled);
  const wasEnabled = useRef(enabled);
  useEffect(() => {
    if (enabled && !wasEnabled.current) void refresh();
    wasEnabled.current = enabled;
  }, [enabled, refresh]);

  const liveBank = info ? (options.liveBank ?? def.liveBank(info)) : undefined;
  const shownBank: 0 | 1 = options.bank ?? pinnedBank ?? liveBank ?? 0;

  // --- Identity stability: the arrays are props of memoized canvases, so keep the previous array
  // --- unless the values differ
  const cachedValues = useRef<number[]>();
  const cachedCodes = useRef<number[]>();
  const { deviceValues, palette } = useMemo(() => {
    const raw = info ? def.banks[shownBank](info) : undefined;
    if (!raw?.length) return { deviceValues: undefined, palette: undefined };
    if (!cachedValues.current || !sameValues(raw, cachedValues.current)) {
      cachedValues.current = raw.slice();
      cachedCodes.current = raw.map(paletteCodeFromDeviceValue);
    }
    return { deviceValues: cachedValues.current, palette: cachedCodes.current };
  }, [def, info, shownBank]);

  return {
    palette,
    deviceValues,
    transparencyIndex: info && def.transparencyIndex ? def.transparencyIndex(info) : undefined,
    shownBank,
    liveBank,
    pinBank: setPinnedBank
  };
}

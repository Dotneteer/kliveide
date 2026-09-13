import { useCallback, useMemo, useRef, useState } from "react";
import { PaletteDeviceInfo } from "@common/messaging/EmuApi";
import { paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { DEFAULT_SPRITE_TRANSPARENCY } from "./sprite-file";

/**
 * The sprite palette the editor draws with.
 *
 * The editor used to build its own identity ramp - `palette[i] = i` for 0..255 - and hand that to
 * the grid, the thumbnails and the 256-swatch viewer. That is not a placeholder, it is a lie about
 * what the artist is drawing: the machine has a *real* sprite palette, and the one the editor
 * substituted could not even express half of the hardware's colours. Bit 8 of the register layout
 * is the low blue bit, and an index never sets it, so four of the Next's eight blue levels are
 * unreachable and the ramp contains no pure white and no pure blue at all.
 *
 * The real values were already reaching the renderer - `PalettePanel` has consumed them for a
 * while - so this is a wiring job, not a new capability.
 *
 * **The fallback is deliberately visible.** With no machine (or a machine that is not a Next) the
 * ramp comes back, but `source` says so and the editor labels it. A silently-wrong palette is
 * exactly the failure the sidebar's own colour bug was: wrong colours still look like colours.
 */

export const DEFAULT_SPRITE_PALETTE: number[] = Array.from({ length: 256 }, (_, i) => i);

export type SpritePaletteSource = "machine" | "default";

export type SpritePalette = {
  /** 256 entries, in the **register** layout every palette helper in the app expects. */
  palette: number[];
  transparencyIndex: number;
  source: SpritePaletteSource;
  /** The bank on screen. */
  shownBank: 0 | 1;
  /** The bank the sprite engine is drawing with, or `undefined` when there is no machine. */
  liveBank: 0 | 1 | undefined;
  /** Pin the view to a bank. Nothing resets it: the pin belongs to the user. */
  pinBank: (bank: 0 | 1) => void;
};

/** Next Reg $43, bit 3 selects which sprite palette the engine reads. */
const liveBankOf = (info: PaletteDeviceInfo): 0 | 1 => ((info.reg43Value ?? 0) & 0x08 ? 1 : 0);

const sameValues = (a: number[], b: number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function useSpritePalette(): SpritePalette {
  const emuApi = useEmuApi();
  const [info, setInfo] = useState<PaletteDeviceInfo | undefined>(undefined);
  const [pinnedBank, setPinnedBank] = useState<0 | 1 | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInfo(await emuApi.getPalettedDeviceInfo());
    } catch {
      // No machine controller, or a machine that is not a Next. Neither is an error here: a `.spr`
      // is perfectly editable with the emulator stopped, it just cannot show the live palette.
      setInfo(undefined);
    }
  }, [emuApi]);

  useEmuStateListener(emuApi, refresh);

  const liveBank = info ? liveBankOf(info) : undefined;
  const shownBank: 0 | 1 = pinnedBank ?? liveBank ?? 0;

  /*
   * Identity stability is load-bearing, not a micro-optimisation.
   *
   * This hook re-runs on every emulator state change, and the palette array is a prop of the
   * memoized grid, of all ten thumbnails and of the 256-swatch viewer. Returning a fresh array each
   * time would undo Phase 3 entirely - so the previous array is kept unless the *values* differ.
   */
  const cached = useRef<number[]>(DEFAULT_SPRITE_PALETTE);
  const palette = useMemo(() => {
    const raw = info ? (shownBank === 0 ? info.spriteFirst : info.spriteSecond) : undefined;
    // The device stores straight 9-bit RGB333; everything else in the app speaks the register
    // layout. This is the boundary that converts, once per rendered bank.
    const next = raw?.length ? raw.map(paletteCodeFromDeviceValue) : DEFAULT_SPRITE_PALETTE;
    if (sameValues(next, cached.current)) return cached.current;
    cached.current = next;
    return next;
  }, [info, shownBank]);

  const source: SpritePaletteSource = palette === DEFAULT_SPRITE_PALETTE ? "default" : "machine";

  return {
    palette,
    transparencyIndex:
      info?.spriteTransparencyIndex ?? DEFAULT_SPRITE_TRANSPARENCY,
    source,
    shownBank,
    liveBank,
    pinBank: setPinnedBank
  };
}

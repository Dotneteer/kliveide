import { useNextDevicePalette } from "@renderer/features/next-palette/useNextDevicePalette";
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

export type UseSpritePaletteOptions = {
  /**
   * Show this bank, whatever the machine selects and whatever was pinned.
   *
   * For a caller that keeps the choice itself — the NEX bank Sprites view remembers it in its
   * document's view state — so the choice survives the view being unmounted. Absent, the hook keeps
   * its own pin, which is how the sprite editor uses it.
   */
  bank?: 0 | 1;
  /**
   * Whether to read the machine at all. `true` by default.
   *
   * A popped-out bank calls this hook whether or not its Sprites view is showing — hooks cannot be
   * conditional — and a Memory or Disassembly view has no use for an IPC round trip on every
   * emulator state change. Disabled, it reads nothing; enabling it reads once straight away.
   */
  enabled?: boolean;
};

export function useSpritePalette(options: UseSpritePaletteOptions = {}): SpritePalette {
  // --- The sprite device's live palette (`useNextDevicePalette`); this hook adds only the visible
  // --- fallback the editor labels
  const device = useNextDevicePalette("sprites", { bank: options.bank, enabled: options.enabled });
  const palette = device.palette ?? DEFAULT_SPRITE_PALETTE;
  const source: SpritePaletteSource = device.palette ? "machine" : "default";
  return {
    palette,
    transparencyIndex: device.transparencyIndex ?? DEFAULT_SPRITE_TRANSPARENCY,
    source,
    shownBank: device.shownBank,
    liveBank: device.liveBank,
    pinBank: device.pinBank
  };
}

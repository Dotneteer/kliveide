import type {
  CopperState,
  NextSpriteState,
  NextTilemapState,
  NextLayer2State,
  NextLayerState,
  NextMemoryMapping,
  NextRegDescriptors,
  NextRegState,
  PaletteDeviceInfo,
  UlaState
} from "@common/messaging/EmuApi";
import type { NextLayerDebug, NextPixelProbe, RecomposeStatus } from "@common/zxnext/layers/layerMix";

/**
 * What the IDE reads from a ZX Spectrum Next.
 *
 * The Next panels (Next Registers, Memory Mapping, Palettes, ULA & I/O, the sprite editor's
 * palette) used to cast the running machine to the TypeScript `ZxNextMachine` and read its device
 * objects. The WASM machine inherited those objects without ever updating them, so on the
 * production backend the panels showed power-on state. This interface is what replaced the casts:
 * the machine answers each question from its own state, and `MainToEmuProcessor` reaches no
 * further into it than these methods.
 */
export interface IZxNextIdeMachine {
  readonly machineId: "zxnext";

  /** The static NextReg documentation: names, read/write-only flags, bit slices. */
  getNextRegDescriptors(): NextRegDescriptors["descriptors"];

  /** Every documented NextReg: the value a read returns now, and the last value written to it. */
  getNextRegState(): NextRegState;

  /** The memory paging state behind the Next Memory Mapping panel. */
  getNextMemoryMapping(): NextMemoryMapping;

  /** The eight palettes and the palette-related registers. */
  getPaletteDeviceInfo(): PaletteDeviceInfo;

  /**
   * The ULA & I/O panel's state. Must not have side effects: it is polled while the machine runs,
   * so it must not perform a port read (the floating-bus value is not sampled here).
   */
  getNextUlaState(): UlaState;

  /** The Copper: list RAM, mode, pointers, beam and the last Copper breakpoint hit. */
  getCopperState(): CopperState;

  /** The sprites, for the Sprite Inspector: one side-effect-free snapshot (SPRITE_INSPECTOR_PLAN D2, D8). */
  getNextSpriteState(): NextSpriteState;

  /** The tilemap, for the Tilemap Inspector: registers and banks 5 and 7 in one read (TILEMAP_INSPECTOR_PLAN D2, D8). */
  getNextTilemapState(): NextTilemapState;

  /** Layer 2, for the Layer 2 Inspector: registers and the displayed (and shadow) banks in one read (LAYER2_INSPECTOR_PLAN D2, D8). */
  getNextLayer2State(options?: { shadow?: boolean }): NextLayer2State;

  /** Arms (or cancels) "Step Copper": the next debug run stops when the Copper completes any instruction. */
  requestCopperStep(armed?: boolean): void;

  /**
   * The layer debug view (LAYER_COMPOSITION_PLAN D1, D2): hides, solos and flags layers in the
   * mixer only. Debugging state: never saved in a state file, never changes what the program reads.
   */
  setLayerDebug(debug: NextLayerDebug): void;
  getLayerDebug(): NextLayerDebug;

  /** Records every span's layer pixels and mixer inputs while on, for an exact paused recompose (§4.3). */
  setLayerCapture(on: boolean): void;

  /**
   * Recomposes the paused picture with the debug view into the preview the screen then shows, until
   * the machine runs again (§4.2, §4.3).
   */
  recomposeForDebug(): RecomposeStatus;

  /** The screen shows the machine's own picture again (running does this too). */
  dropLayerPreview(): void;

  /** Which layer produced screen pixel (x, y) - the coordinates of the displayed picture - and why (D7). */
  probePixel(x: number, y: number): NextPixelProbe;

  /** The mixer registers, clip windows and debug view; with `thumbnails`, one picture per layer (D9). */
  getNextLayerState(options?: { thumbnails?: boolean }): NextLayerState;
}

/**
 * Tells a Next machine (either core) from any other machine.
 * @param machine The running machine
 */
export function isZxNextIdeMachine(machine: unknown): machine is IZxNextIdeMachine {
  const m = machine as Partial<IZxNextIdeMachine> | undefined;
  return (
    m?.machineId === "zxnext" &&
    typeof m.getNextRegDescriptors === "function" &&
    typeof m.getNextRegState === "function" &&
    typeof m.getNextMemoryMapping === "function" &&
    typeof m.getPaletteDeviceInfo === "function" &&
    typeof m.getNextUlaState === "function" &&
    typeof m.getCopperState === "function" &&
    typeof m.getNextSpriteState === "function" &&
    typeof m.getNextTilemapState === "function" &&
    typeof m.getNextLayer2State === "function" &&
    typeof m.getNextLayerState === "function"
  );
}

/**
 * The raster position of a frame tact, in the unit both cores count it in: `vc * totalHc + hc`
 * (7 MHz pixel-pair clocks).
 * @param frameTact The current frame tact
 * @param totalHc HCs per line of the raster in effect
 */
export function nextRasterPosition(frameTact: number, totalHc: number): { line: number; hc: number } {
  if (!(totalHc > 0)) return { line: 0, hc: 0 };
  return { line: Math.floor(frameTact / totalHc), hc: frameTact % totalHc };
}

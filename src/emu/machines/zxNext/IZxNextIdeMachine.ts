import type {
  NextMemoryMapping,
  NextRegDescriptors,
  NextRegState,
  PaletteDeviceInfo,
  UlaState
} from "@common/messaging/EmuApi";

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
    typeof m.getNextUlaState === "function"
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

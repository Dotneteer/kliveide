import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { ScreenConfiguration } from "@emu/abstractions/ScreenConfiguration";
import { MC_DISK_SUPPORT, MC_SP128_TIMING } from "@common/machines/constants";

/*
 * The two timings the `sp128` core runs (`.plans/PENTAGON_128_PLAN.md`, P2-P3): the ZX Spectrum 128K
 * and the Pentagon 128. To software the two are the same machine - `$7FFD` paging, the 128K ROMs, the
 * AY - and differ only in timing. This table is the TypeScript side of the core's
 * `sp128ApplyTiming` (sp128.c); `test/machines/sp128-timings.test.ts` keeps the two equal.
 *
 * The Pentagon numbers come from the ZX Spectrum Next's own Pentagon mode in the FPGA sources
 * (`_input/next-fpga/src/video/zxula_timing.vhd`, `zxnext.vhd`), the reference the Next core already
 * follows; sp128.c's comments carry the derivation.
 */

/** The timing ids, the values of `MC_SP128_TIMING` */
export type Sp128TimingId = "sp128" | "pentagon";

/** The model ids of the `sp128` machine (the same as the timing ids) */
export type Sp128ModelId = Sp128TimingId;

/** What one timing decides */
export type Sp128Timing = {
  id: Sp128TimingId;
  /** The argument of the core's `sp128HardReset` */
  coreTiming: number;
  /** The CPU clock in Hz */
  clockHz: number;
  /** T-states per raster line */
  tactsPerLine: number;
  /** Raster lines per frame */
  linesPerFrame: number;
  /** T-states per frame */
  tactsPerFrame: number;
  /** The INT pulse length in T-states */
  interruptTacts: number;
  /**
   * The frame tact at which the first paper pixel is drawn: the first display line's start in the
   * core's timing tables (its first two bytes were fetched 2 and 1 T earlier)
   */
  paperStartTact: number;
  /** Memory and I/O contention */
  contention: boolean;
  /** Unattached ports read the byte the ULA is fetching; without it they read $FF */
  floatingBus: boolean;
  /** The screen geometry the screen device uses (the core's `Sp128ScreenConfig`) */
  screen: ScreenConfiguration;
  /** The machine `.szx` / `.z80` files call this one */
  snapshotKind: "128k" | "pentagon";
};

export const SP128_TIMINGS: Record<Sp128TimingId, Sp128Timing> = {
  sp128: {
    id: "sp128",
    coreTiming: 0,
    clockHz: 3_546_900,
    tactsPerLine: 228,
    linesPerFrame: 311,
    tactsPerFrame: 70_908,
    interruptTacts: 32,
    paperStartTact: 63 * 228,
    contention: true,
    floatingBus: true,
    screen: {
      verticalSyncLines: 8,
      nonVisibleBorderTopLines: 7,
      borderTopLines: 48,
      borderBottomLines: 48,
      nonVisibleBorderBottomLines: 8,
      displayLines: 192,
      borderLeftTime: 24,
      borderRightTime: 24,
      displayLineTime: 128,
      horizontalBlankingTime: 40,
      nonVisibleBorderRightTime: 12,
      pixelDataPrefetchTime: 2,
      attributeDataPrefetchTime: 1,
      contentionValues: [4, 3, 2, 1, 0, 0, 6, 5]
    },
    snapshotKind: "128k"
  },
  pentagon: {
    id: "pentagon",
    coreTiming: 1,
    clockHz: 3_500_000,
    // --- zxula_timing.vhd: 448 7 MHz clocks by 320 lines
    tactsPerLine: 224,
    linesPerFrame: 320,
    tactsPerFrame: 71_680,
    // --- zxnext.vhd ~1989: 36 CPU cycles for the 128K and Pentagon timings (plan Q4)
    interruptTacts: 36,
    // --- The interrupt at (vc 319, hc 439), the display of line 80 at hc 116: 17 982.5 T, read the
    // --- way that gives the 48K's 14 336 (sp128.c, SP128_PENTAGON_RASTER_SHIFT)
    paperStartTact: 80 * 224 + 62,
    contention: false,
    floatingBus: false,
    screen: {
      verticalSyncLines: 16,
      nonVisibleBorderTopLines: 16,
      borderTopLines: 48,
      borderBottomLines: 48,
      nonVisibleBorderBottomLines: 0,
      displayLines: 192,
      borderLeftTime: 24,
      borderRightTime: 24,
      displayLineTime: 128,
      horizontalBlankingTime: 32,
      nonVisibleBorderRightTime: 16,
      pixelDataPrefetchTime: 2,
      attributeDataPrefetchTime: 1,
      contentionValues: [0, 0, 0, 0, 0, 0, 0, 0]
    },
    snapshotKind: "pentagon"
  }
};

/** The default: no `MC_SP128_TIMING` means the 128K, so projects from before the Pentagon keep it */
export const SP128_DEFAULT_TIMING: Sp128TimingId = "sp128";

/** The timing a machine configuration selects; an unknown or missing value is the 128K's */
export function getSp128Timing(config: MachineConfigSet | undefined): Sp128Timing {
  const id = config?.[MC_SP128_TIMING];
  return (typeof id === "string" && SP128_TIMINGS[id as Sp128TimingId]) || SP128_TIMINGS[SP128_DEFAULT_TIMING];
}

/**
 * The registry models of the `sp128` machine. Their ids never change: projects refer to them. Both
 * state their timing, so a config merge cannot carry the Pentagon's onto the 128K.
 */
export const SP128_MODELS: MachineModel[] = [
  { modelId: "sp128", displayName: "ZX Spectrum 128K", config: { [MC_SP128_TIMING]: "sp128" } },
  // --- The Pentagon's Beta 128 disk interface has two drives (`.plans/BETA128_TRDOS_PLAN.md` B1, Q3)
  {
    modelId: "pentagon",
    displayName: "Pentagon 128",
    config: { [MC_SP128_TIMING]: "pentagon", [MC_DISK_SUPPORT]: 2 }
  }
];

/** The model of the `sp128` machine, by id (`undefined` - a project from before the models - is none) */
export function getSp128Model(modelId: string | undefined): MachineModel | undefined {
  return modelId === undefined ? undefined : SP128_MODELS.find((m) => m.modelId === modelId);
}

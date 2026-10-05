import type { MachineModel } from "@common/machines/info-types";
import { MC_TIMEX_MODEL } from "@common/machines/constants";

/*
 * The models of the Timex core (`.plans/TIMEX_SCORPION_PLAN.md`, P2): the TC2048 now (G9.4a); the
 * TC2068 and TS2068 join in G9.4b. This is the TypeScript side of `timexHardReset` (timex.c);
 * `test/timex-hw/timex-core.test.ts` keeps the two equal.
 *
 * Must stay free of emulator imports: the machine registry and the hardware sheet read it.
 */

/** The model ids, the values of `MC_TIMEX_MODEL` */
export type TimexModelId = "tc2048";

export type TimexModel = {
  id: TimexModelId;
  /** The argument of the core's `timexHardReset` */
  coreModel: number;
  /** The CPU clock in Hz: the SCLD's 14.112 MHz / 4 */
  clockHz: number;
  tactsPerLine: number;
  linesPerFrame: number;
  tactsPerFrame: number;
  /** Whether the 64-column mode's colours (and its border) are BRIGHT (plan §8) */
  hiresBright: boolean;
};

export const TIMEX_MODELS_INFO: Record<TimexModelId, TimexModel> = {
  tc2048: {
    id: "tc2048",
    coreModel: 0,
    clockHz: 3_528_000,
    tactsPerLine: 224,
    linesPerFrame: 312,
    tactsPerFrame: 69_888,
    hiresBright: true
  }
};

/** The model a configuration means (the TC2048 when it does not say) */
export function getTimexModel(config?: Record<string, any>): TimexModel {
  return TIMEX_MODELS_INFO[config?.[MC_TIMEX_MODEL] as TimexModelId] ?? TIMEX_MODELS_INFO.tc2048;
}

/** The registry's models of the `timex` machine */
export const TIMEX_MODELS: MachineModel[] = [
  {
    modelId: "tc2048",
    displayName: "Timex Computer 2048",
    config: { [MC_TIMEX_MODEL]: "tc2048" }
  }
];

/**
 * The TC2048 ROM's size. Klive does not ship the Timex ROM (its rights are unclear, plan P5): the
 * user names their copy in the settings, and without one the machine boots the Sinclair 48K ROM,
 * which the TC2048's differs from only by a hook that clears port $FF on the start-up path.
 */
export const TC2048_ROM_SIZE = 0x4000;

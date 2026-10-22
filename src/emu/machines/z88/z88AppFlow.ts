import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { Z88KeyCode } from "./Z88KeyCode";

/*
 * Starting a card application on the Z88 (`.plans/Z88DK_INTEGRATION_PLAN.md` §7: a z88dk C program
 * built with `+z88 -subtype=app`). The card goes into a slot first (`applyCardStateChange`); then the
 * machine starts - a soft reset on the Z88 (`softResetOnFirstStart`), which is what makes OZ list an
 * application on a card inserted while it ran - and, once OZ is idle in the Index, □ + the
 * application's key starts it. Measured on the core (`test/z88dk/z88-card.core.test.ts`): OZ takes
 * 400-800 frames (2-4 s) after the reset before it reacts to the keys.
 */

/** Frames (5 ms each) between the reset and the □ chord: twice the slowest OZ the test measured. */
export const Z88_APP_START_DELAY_FRAMES = 1600;

/** The slot a C application card goes into (an EPROM in slot 3 is OZ's usual application slot). */
export const Z88_APP_SLOT = 3;

/** The Z88 key code of an application key (`A`-`Z`); undefined for anything else. */
export function z88KeyCodeOfAppKey(appKey: string): number | undefined {
  const key = (appKey ?? "").trim().toUpperCase();
  return /^[A-Z]$/.test(key) ? Z88KeyCode[key] : undefined;
}

/** Start the machine, then press □ + the application's key once OZ is ready. */
export function z88AppStartFlow(appKey: string): CodeInjectionFlow {
  const key = z88KeyCodeOfAppKey(appKey);
  if (key === undefined) throw new Error(`Not a Z88 application key: '${appKey}' (use a letter A-Z).`);
  return [
    { type: "Start" },
    { type: "QueueKey", primary: Z88KeyCode.Square, secondary: key, delayFrames: Z88_APP_START_DELAY_FRAMES, wait: 0 }
  ];
}

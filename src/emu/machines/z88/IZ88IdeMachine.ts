import type { BlinkState } from "@common/messaging/EmuApi";

/**
 * What the IDE reads from a Cambridge Z88, whichever core runs it.
 *
 * The Blink panel used to cast the running machine to `any` and read the TypeScript device objects
 * (`blinkDevice`, `keyboardDevice`, `beeperDevice`, `screenDevice`). A WASM machine has no such
 * objects, so the machine now answers from its own state - the TypeScript core from its devices, the
 * WASM core from its exports - and the IDE never needs to know which one is running (the lesson of
 * `IZxNextIdeMachine`; see `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`, Step 0.2).
 */
export interface IZ88IdeMachine {
  readonly machineId: "z88";

  /**
   * The Blink panel's state: the Blink registers, the keyboard lines, the beeper bits and the LCD
   * registers. Must not have side effects: it is polled while the machine runs.
   */
  getBlinkState(): BlinkState;
}

/**
 * Tells a Z88 machine (either core) from any other machine.
 * @param machine The running machine
 */
export function isZ88IdeMachine(machine: unknown): machine is IZ88IdeMachine {
  const m = machine as Partial<IZ88IdeMachine> | undefined;
  return m?.machineId === "z88" && typeof m.getBlinkState === "function";
}

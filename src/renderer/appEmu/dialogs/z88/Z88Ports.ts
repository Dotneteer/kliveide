import type { MachineConfigSet } from "@common/machines/info-types";
import type { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import type { MachineControllerState } from "@abstractions/MachineControllerState";

/**
 * The seam every Z88 card dialog shares.
 *
 * Change RAM, Insert Card and Remove Card all reach the machine the same three
 * ways, so the port is defined once here rather than three times: a fake that
 * satisfies one dialog satisfies all of them.
 */
export type Z88MachinePort = {
  /**
   * Writes a slot into the running machine's dynamic configuration and
   * reconfigures it in place. Slots 1-3 are hot-pluggable this way.
   */
  applyCardState(slot: number, cardState: CardSlotState): Promise<void>;

  /**
   * Rebuilds the machine on a new configuration — which stops it. Slot 0 and
   * the internal RAM both need this, because both change hardware that only
   * exists from boot.
   */
  setMachineConfig(config: MachineConfigSet): Promise<void>;

  /**
   * Tells the machine its card flap was shut again. The Z88 notices the flap
   * being open, so leaving it "open" after a dialog would hang the emulation.
   */
  signalFlapClosed(): void;
};

/**
 * The Emu output pane. Only Change RAM writes to it, but it is a machine-side
 * concern rather than a dialog-specific one.
 */
export type Z88OutputPort = {
  write(text: string): Promise<void>;
};

/**
 * Everything the Z88 dialogs read from Redux, as plain data.
 *
 * Pushed in as an intent by the container, so no layer below it knows Redux
 * exists and a test builds one as a literal.
 */
export type Z88Environment = {
  config: MachineConfigSet;
  machineState: MachineControllerState;
};

// --- Which machine to rebuild is not in here on purpose: the id and model are
// --- an implementation detail of `setMachineConfig`, and the adapter reads them
// --- from the store at the moment it rebuilds, exactly as the old components did.
export function readZ88Environment(emulatorState: {
  config?: MachineConfigSet;
  machineState?: MachineControllerState;
}): Z88Environment {
  return {
    // --- A machine with no configuration behaves as one with an empty one; the
    // --- old components each wrote `config ?? {}` at every use site.
    config: emulatorState?.config ?? {},
    machineState: emulatorState?.machineState
  };
}

/**
 * True when the two configurations describe the same machine.
 *
 * The container rebuilds the environment on every store notification, so the
 * reducers compare with this and return the same state object when nothing that
 * matters changed — which is what stops a needless re-render.
 */
export function isSameZ88Environment(left: Z88Environment, right: Z88Environment): boolean {
  return left.machineState === right.machineState && isSameConfig(left.config, right.config);
}

function isSameConfig(left: MachineConfigSet, right: MachineConfigSet): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  // --- A shallow compare is enough: slot states are replaced wholesale, never
  // --- mutated in place.
  return leftKeys.every((key) => left[key] === right[key]);
}

import { MachineConfigSet, MachineInfo } from "@common/machines/info-types";
import { machineRegistry, resolveModelId } from "@common/machines/machine-registry";

/**
 * The startup switches that choose the emulated machine and start it:
 *
 * - `--machine <id>[:<model>]` (or `--machine=<id>[:<model>]`) opens Klive on that machine instead of
 *   the one the last session saved.
 * - `--start` starts the machine once the emulator has loaded.
 *
 * They apply only to the first Klive: a second instance's command line is ignored on purpose (see
 * the `second-instance` handler in `index.ts`).
 */

export const MACHINE_SWITCH = "--machine";
export const START_SWITCH = "--start";

export type MachineRequest = { machineId: string; modelId?: string };

export type LaunchSwitches = {
  /** The machine `--machine` asked for, not yet checked against the registry */
  machine?: MachineRequest;
  /** `--start` was given */
  start: boolean;
  /** Problems with the switches themselves, such as `--machine` without a value */
  errors: string[];
};

/**
 * Reads the startup switches from a command line. Unknown arguments are left alone: Electron,
 * Chromium and the app's other switches share the same line.
 */
export function parseLaunchSwitches(argv: readonly string[]): LaunchSwitches {
  const result: LaunchSwitches = { start: false, errors: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === START_SWITCH) {
      result.start = true;
      continue;
    }
    let value: string | undefined;
    if (arg === MACHINE_SWITCH) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        i++;
      } else {
        value = "";
      }
    } else if (arg.startsWith(`${MACHINE_SWITCH}=`)) {
      value = arg.slice(MACHINE_SWITCH.length + 1);
    } else {
      continue;
    }
    const request = parseMachineRequest(value);
    if (request) {
      result.machine = request;
    } else {
      result.errors.push(`${MACHINE_SWITCH} needs a machine ID, such as '${MACHINE_SWITCH} sp128' or '${MACHINE_SWITCH} zxnext'.`);
    }
  }
  return result;
}

let processSwitches: LaunchSwitches | undefined;

/** This process's startup switches, read once from `process.argv` */
export function getLaunchSwitches(): LaunchSwitches {
  return (processSwitches ??= parseLaunchSwitches(process.argv));
}

/**
 * Whether the IDE leaves the last project closed at startup. Opening it would apply the project's
 * own machine, overriding `--machine` and replacing a machine `--start` has just started.
 */
export function skipsLastProjectReopen(switches: LaunchSwitches): boolean {
  return !!switches.machine || switches.start;
}

/** `<id>` or `<id>:<model>`; undefined when there is no machine ID */
function parseMachineRequest(value: string): MachineRequest | undefined {
  const trimmed = value.trim();
  const colon = trimmed.indexOf(":");
  const machineId = (colon < 0 ? trimmed : trimmed.slice(0, colon)).trim();
  const modelId = colon < 0 ? undefined : trimmed.slice(colon + 1).trim() || undefined;
  return machineId ? { machineId, modelId } : undefined;
}

export type SavedMachine = { machineId?: string; modelId?: string; config?: MachineConfigSet };

export type LaunchMachine = { machineId: string; modelId?: string; config?: MachineConfigSet };

/**
 * Turns a `--machine` request into the machine to start with, checked against the registry. IDs
 * match without regard to case and come back in the registry's spelling.
 *
 * A request for the machine and model the last session saved keeps that session's configuration
 * (its ROM, memory and slot choices); any other machine starts with its model's defaults, as the
 * Machine type menu does.
 */
export function resolveLaunchMachine(
  request: MachineRequest,
  saved: SavedMachine,
  registry: readonly MachineInfo[] = machineRegistry
): { machine?: LaunchMachine; error?: string } {
  const lower = request.machineId.toLowerCase();
  const info = registry.find((m) => m.machineId.toLowerCase() === lower);
  if (!info) {
    const known = registry.map((m) => m.machineId).join(", ");
    return { error: `Unknown machine '${request.machineId}' in ${MACHINE_SWITCH}. Known machines: ${known}.` };
  }
  const machineId = info.machineId;
  const models = info.models ?? [];

  let modelId: string | undefined;
  if (request.modelId !== undefined) {
    if (models.length === 0) {
      return { error: `${info.displayName} ('${machineId}') has no models; use '${MACHINE_SWITCH} ${machineId}'.` };
    }
    const requested = resolveModelId(machineId, request.modelId);
    const model = models.find((m) => m.modelId.toLowerCase() === requested.toLowerCase());
    if (!model) {
      const known = models.map((m) => m.modelId).join(", ");
      return { error: `Unknown model '${request.modelId}' of '${machineId}' in ${MACHINE_SWITCH}. Its models: ${known}.` };
    }
    modelId = model.modelId;
  } else if (models.length > 0) {
    // --- No model given: the saved one when it is this machine, else the model a model-less
    // --- reference means, else the first
    const savedModel =
      saved.machineId === machineId && saved.modelId !== undefined
        ? resolveModelId(machineId, saved.modelId)
        : undefined;
    const fallback = resolveModelId(machineId, undefined);
    modelId =
      [savedModel, fallback].find((id) => id !== undefined && models.some((m) => m.modelId === id)) ??
      models[0].modelId;
  }

  const sameAsSaved =
    saved.machineId === machineId &&
    (saved.modelId === undefined ? undefined : resolveModelId(machineId, saved.modelId)) === modelId;
  return { machine: { machineId, modelId, config: sameAsSaved ? saved.config : undefined } };
}

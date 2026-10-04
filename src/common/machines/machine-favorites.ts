import type { MachineInfo } from "./info-types";
import { resolveModelId } from "./machine-registry";
import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_Z88, MI_ZX81, MI_ZXNEXT } from "./constants";

/**
 * One entry of the Machine › Machine type menu. The order of the stored array is the menu order.
 * See `.plans/MACHINE_SELECT_DIALOG_PLAN.md` §3 and §5.1.
 */
export type MachineFavorite = {
  machineId: string;
  /**
   * Omitted for a machine without models; a model-less entry saved before its machine gained models
   * means the model `implicitModelIds` names (the ZX Spectrum 128K's `sp128`)
   */
  modelId?: string;
  /** Draw a menu separator after this entry. Ignored on the last entry. */
  separatorAfter?: boolean;
};

/**
 * The favourites used while the user has never customised them (the setting is absent).
 */
export const DEFAULT_MACHINE_FAVORITES: readonly MachineFavorite[] = Object.freeze([
  { machineId: MI_SPECTRUM_48, modelId: "pal" },
  { machineId: MI_SPECTRUM_128, modelId: "sp128" },
  { machineId: MI_SPECTRUM_3E, modelId: "fdd1", separatorAfter: true },
  { machineId: MI_ZXNEXT, modelId: "standard", separatorAfter: true },
  { machineId: MI_Z88, modelId: "OZ50" },
  { machineId: MI_ZX81, modelId: "zx81-16k" }
]);

/**
 * The identity of a machine model, unique across the registry
 */
export function favoriteKey(f: { machineId: string; modelId?: string }): string {
  return f.modelId ? `${f.machineId}/${f.modelId}` : f.machineId;
}

/**
 * Finds the registry model a machine/model pair names. A machine with models needs one of its model
 * IDs (aliases resolved); a machine without models must not name one.
 * @returns The canonical pair, or undefined when the registry has no such model
 */
export function resolveMachineModel(
  registry: readonly MachineInfo[],
  machineId: string,
  modelId: string | undefined
): { machineId: string; modelId?: string; displayName: string } | undefined {
  const machine = registry.find((m) => m.machineId === machineId);
  if (!machine) return undefined;
  if (!machine.models?.length) {
    return modelId ? undefined : { machineId, displayName: machine.displayName };
  }
  const resolved = resolveModelId(machineId, modelId);
  if (!resolved) return undefined;
  const model = machine.models.find((m) => m.modelId === resolved);
  return model ? { machineId, modelId: model.modelId, displayName: model.displayName } : undefined;
}

/**
 * Turns whatever the settings store holds into a clean favourites list: `undefined` (never
 * customised) gives the defaults; anything else is trusted for nothing. Entries naming a machine or
 * model the registry does not have are dropped, model aliases are resolved, duplicates keep their
 * first position, and the last entry carries no separator.
 * @param raw The stored setting value
 * @param registry The registered machines
 */
export function normalizeMachineFavorites(
  raw: unknown,
  registry: readonly MachineInfo[]
): MachineFavorite[] {
  const source = raw === undefined || raw === null ? DEFAULT_MACHINE_FAVORITES : raw;
  if (!Array.isArray(source)) return normalizeMachineFavorites(undefined, registry);

  const result: MachineFavorite[] = [];
  const seen = new Set<string>();
  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const { machineId, modelId, separatorAfter } = entry as Record<string, unknown>;
    if (typeof machineId !== "string") continue;
    if (modelId !== undefined && typeof modelId !== "string") continue;
    const model = resolveMachineModel(registry, machineId, modelId as string | undefined);
    if (!model) continue;
    const key = favoriteKey(model);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      machineId: model.machineId,
      ...(model.modelId ? { modelId: model.modelId } : {}),
      ...(separatorAfter === true ? { separatorAfter: true } : {})
    });
  }
  if (result.length) delete result[result.length - 1].separatorAfter;
  return result;
}

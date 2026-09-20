import type { MachineConfigSet, MachineModel } from "./info-types";

/**
 * How to derive the backend-comparison twins of a machine's models
 */
export type ModelTwinOptions = {
  /** The configuration key that selects the backend (e.g. `MC_Z88_IMPLEMENTATION`) */
  readonly configKey: string;
  /** The backend the twins select */
  readonly implementation: string;
  /** The machine-menu submenu the twins are listed in */
  readonly menuGroup: string;
  /** Appended to each model id: the twin's id (e.g. "-wasm") */
  readonly idSuffix: string;
  /** Appended to each display name, so the running model's name says which backend it is */
  readonly nameSuffix: string;
};

/**
 * Derives a twin of each model that selects another backend explicitly and is listed in its own
 * machine-menu submenu. The originals keep their ids (saved projects keep working) and follow the
 * default backend; see `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`, "Machine menu during the
 * comparison period".
 * @param models The machine's models
 * @param options How to derive the twins
 */
export function createModelTwins(models: readonly MachineModel[], options: ModelTwinOptions): MachineModel[] {
  return models.map((model) => ({
    modelId: `${model.modelId}${options.idSuffix}`,
    displayName: `${model.displayName}${options.nameSuffix}`,
    menuGroup: options.menuGroup,
    config: { ...model.config, [options.configKey]: options.implementation } as MachineConfigSet
  }));
}

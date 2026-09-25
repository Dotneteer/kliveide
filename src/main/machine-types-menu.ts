import type { MenuItemConstructorOptions } from "electron";
import type { MachineInfo } from "@common/machines/info-types";

/**
 * Selects a machine type (and model) from the machine menu
 */
export type MachineTypeSelector = (machineId: string, modelId?: string) => Promise<void>;

/**
 * Builds the machine-type items of the Machine menu: one checkbox per model (or per machine, for a
 * machine without models), a separator after each machine.
 * @param registry The registered machines
 * @param currentMachineId The machine running now
 * @param currentModelId The model running now
 * @param select Called when the user picks a machine type
 */
export function createMachineTypesMenu(
  registry: MachineInfo[],
  currentMachineId: string | undefined,
  currentModelId: string | undefined,
  select: MachineTypeSelector
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [];
  for (const machine of registry) {
    if (!machine.models) {
      items.push({
        id: `machine_${machine.machineId}`,
        label: machine.displayName,
        type: "checkbox",
        checked: currentMachineId === machine.machineId,
        click: async () => {
          await select(machine.machineId);
        }
      });
    } else {
      for (const model of machine.models) {
        items.push({
          id: `machine_${machine.machineId}_${model.modelId}`,
          label: model.displayName,
          type: "checkbox",
          checked: currentMachineId === machine.machineId && currentModelId === model.modelId,
          click: async () => {
            await select(machine.machineId, model.modelId);
          }
        });
      }
    }
    items.push({ type: "separator" });
  }
  return items;
}

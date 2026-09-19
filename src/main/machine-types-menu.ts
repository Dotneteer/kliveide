import type { MenuItemConstructorOptions } from "electron";
import type { MachineInfo } from "@common/machines/info-types";

/**
 * Selects a machine type (and model) from the machine menu
 */
export type MachineTypeSelector = (machineId: string, modelId?: string) => Promise<void>;

/**
 * Builds the machine-type items of the Machine menu: one checkbox per model (or per machine, for a
 * machine without models), a separator after each machine.
 *
 * Models that share a `menuGroup` are listed in one submenu labelled with the group, after the
 * machine's ungrouped models, in order of their group's first model. The ids and the checked state
 * of grouped items are the same as flat ones.
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
      const groups = new Map<string, MenuItemConstructorOptions[]>();
      for (const model of machine.models) {
        const item: MenuItemConstructorOptions = {
          id: `machine_${machine.machineId}_${model.modelId}`,
          label: model.displayName,
          type: "checkbox",
          checked: currentMachineId === machine.machineId && currentModelId === model.modelId,
          click: async () => {
            await select(machine.machineId, model.modelId);
          }
        };
        if (model.menuGroup === undefined) {
          items.push(item);
        } else {
          if (!groups.has(model.menuGroup)) groups.set(model.menuGroup, []);
          groups.get(model.menuGroup)!.push(item);
        }
      }
      for (const [label, submenu] of groups) {
        items.push({
          id: `machine_${machine.machineId}_group_${menuGroupId(label)}`,
          label,
          type: "submenu",
          submenu
        });
      }
    }
    items.push({ type: "separator" });
  }
  return items;
}

/** A menu-id-safe form of a group label */
function menuGroupId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

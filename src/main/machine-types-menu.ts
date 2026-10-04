import type { MenuItemConstructorOptions } from "electron";
import type { MachineInfo } from "@common/machines/info-types";
import { resolveModelId } from "@common/machines/machine-registry";
import { MachineFavorite, resolveMachineModel } from "@common/machines/machine-favorites";

/**
 * Selects a machine type (and model) from the machine menu
 */
export type MachineTypeSelector = (machineId: string, modelId?: string) => Promise<void>;

/** The menu item that opens the Select Machine dialog */
export const SELECT_MACHINE_ITEM_ID = "machine_select_dialog";
export const SELECT_MACHINE_ACCELERATOR = "CmdOrCtrl+Shift+M";

/**
 * Builds the items of the Machine › Machine type submenu (plan: `.plans/MACHINE_SELECT_DIALOG_PLAN.md`
 * §3):
 * - the favourites, in their order, with a separator after each entry that asks for one (never
 *   after the last favourite);
 * - the running model, ticked, in its own group, when it is not a favourite;
 * - a separator and "Select machine…", always.
 * @param registry The registered machines
 * @param favorites The favourites, already normalised (`normalizeMachineFavorites`)
 * @param currentMachineId The machine running now
 * @param currentModelId The model running now
 * @param select Called when the user picks a machine type
 * @param openSelector Called when the user picks "Select machine…"
 */
export function createMachineTypesMenu(
  registry: readonly MachineInfo[],
  favorites: readonly MachineFavorite[],
  currentMachineId: string | undefined,
  currentModelId: string | undefined,
  select: MachineTypeSelector,
  openSelector: () => Promise<void>
): MenuItemConstructorOptions[] {
  const runningModelId =
    currentMachineId && currentModelId ? resolveModelId(currentMachineId, currentModelId) : undefined;
  const isRunning = (machineId: string, modelId?: string) =>
    currentMachineId === machineId && (modelId === undefined || runningModelId === modelId);

  const itemFor = (machineId: string, modelId?: string): MenuItemConstructorOptions | undefined => {
    const model = resolveMachineModel(registry, machineId, modelId);
    if (!model) return undefined;
    return {
      id: model.modelId ? `machine_${machineId}_${model.modelId}` : `machine_${machineId}`,
      label: model.displayName,
      type: "checkbox",
      checked: isRunning(machineId, model.modelId),
      click: async () => {
        await select(machineId, model.modelId);
      }
    };
  };

  const items: MenuItemConstructorOptions[] = [];
  favorites.forEach((f, index) => {
    const item = itemFor(f.machineId, f.modelId);
    if (!item) return;
    items.push(item);
    if (f.separatorAfter && index < favorites.length - 1) items.push({ type: "separator" });
  });

  // --- The running model stays visible even when it is not a favourite
  if (currentMachineId && !items.some((i) => i.checked)) {
    const machine = registry.find((m) => m.machineId === currentMachineId);
    const running = itemFor(currentMachineId, machine?.models?.length ? runningModelId : undefined);
    if (running) {
      if (items.length) items.push({ type: "separator" });
      items.push(running);
    }
  }

  if (items.length) items.push({ type: "separator" });
  items.push({
    id: SELECT_MACHINE_ITEM_ID,
    label: "Select machine…",
    accelerator: SELECT_MACHINE_ACCELERATOR,
    click: async () => {
      await openSelector();
    }
  });
  return items;
}

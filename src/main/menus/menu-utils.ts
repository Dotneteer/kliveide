/*
 * Helpers shared by the menu builders (`.plans/MENU_REDESIGN_PLAN.md` §7 Phase 1).
 */
import type { MenuItem, MenuItemConstructorOptions } from "electron";
import type { MachineMenuItem } from "@common/machines/info-types";
import { getSettingDefinition, getSettingValue, setSettingValue } from "@main/settings-utils";
import { isEmuWindowFocused, isIdeWindowFocused } from "@main/index";

type AnyItem = MenuItemConstructorOptions | MenuItem;

/** Drops the items that are explicitly invisible */
export function filterVisibleItems<T extends AnyItem>(items: T[]): T[] {
  return items.filter((i) => i.visible !== false);
}

/**
 * Removes the separators that would render as stray lines: leading, trailing and repeated ones.
 * Invisible items count as absent, so a separator between two hidden groups goes too.
 */
export function tidySeparators<T extends AnyItem | MachineMenuItem>(items: T[]): T[] {
  const result: T[] = [];
  let pendingSeparator: T | undefined;
  for (const item of items) {
    if (!item) continue;
    if (item.type === "separator") {
      if (result.length) pendingSeparator ??= item;
      continue;
    }
    if ((item as AnyItem).visible === false) {
      result.push(item);
      continue;
    }
    if (pendingSeparator) {
      result.push(pendingSeparator);
      pendingSeparator = undefined;
    }
    result.push(item);
  }
  return result;
}

/**
 * The content of a device submenu made from a machine renderer's items: tidied, and unwrapped when
 * the renderer returned a single submenu (such as "Floppy Disks"), so the device submenu does not
 * hold one more submenu.
 */
export function submenuContent(items: MachineMenuItem[]): MenuItemConstructorOptions[] {
  const tidy = tidySeparators(items ?? []);
  const shown = tidy.filter((i) => i.type !== "separator");
  if (shown.length === 1 && Array.isArray(shown[0].submenu) && !shown[0].click) {
    return tidySeparators(shown[0].submenu) as MenuItemConstructorOptions[];
  }
  return tidy as MenuItemConstructorOptions[];
}

/** Does a menu have anything to show? */
export function hasVisibleItems(items: AnyItem[] | MachineMenuItem[]): boolean {
  return (items as AnyItem[]).some((i) => i && i.type !== "separator" && i.visible !== false);
}

/**
 * A checkbox bound to a boolean setting. A setting bound to one window (`boundTo`) shows only while
 * that window has the focus.
 */
export function createBooleanSettingsMenu(
  settingsId: string,
  options?: { enabledFn?: () => boolean; visibleFn?: () => boolean; label?: string }
): MenuItemConstructorOptions {
  const definition = getSettingDefinition(settingsId);
  if (!definition) {
    throw new Error(`Setting definition not found for ${settingsId}`);
  }

  const currentValue = getSettingValue(settingsId);
  const visible = options?.visibleFn
    ? options.visibleFn()
    : definition.boundTo === "emu"
      ? isEmuWindowFocused()
      : definition.boundTo === "ide"
        ? isIdeWindowFocused()
        : true;
  return {
    id: `Setting_${settingsId}`,
    label: options?.label ?? definition.title,
    type: "checkbox",
    enabled: options?.enabledFn?.() ?? true,
    visible,
    checked: !!currentValue,
    click: (mi) => {
      setSettingValue(settingsId, mi.checked);
    }
  };
}

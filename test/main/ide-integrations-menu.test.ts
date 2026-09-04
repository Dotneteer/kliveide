import { describe, expect, it, vi } from "vitest";
import type { MenuItemConstructorOptions } from "electron";

import { SJASMPLUS_INTEGRATION_DIALOG } from "@messaging/dialog-ids";
import {
  createIdeIntegrationsMenu,
  IDE_INTEGRATIONS,
  IDE_INTEGRATION_SJASMPLUS
} from "@main/ide-integrations-menu";

describe("createIdeIntegrationsMenu", () => {
  it("creates the SJASMPLUS integration menu item", async () => {
    const displayDialog = vi.fn(() => Promise.resolve());
    const menu = createIdeIntegrationsMenu(displayDialog);
    const submenu = menu.submenu as MenuItemConstructorOptions[];
    const sjasmplusItem = submenu[0];

    expect(menu.id).toBe(IDE_INTEGRATIONS);
    expect(menu.label).toBe("Integrations");
    expect(sjasmplusItem.id).toBe(IDE_INTEGRATION_SJASMPLUS);
    expect(sjasmplusItem.label).toBe("SjasmPlus Assembler");

    await sjasmplusItem.click?.({} as any, undefined, {} as any);

    expect(displayDialog).toHaveBeenCalledWith(SJASMPLUS_INTEGRATION_DIALOG);
  });
});

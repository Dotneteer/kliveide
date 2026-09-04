import type { MenuItemConstructorOptions } from "electron";

import { SJASMPLUS_INTEGRATION_DIALOG } from "@messaging/dialog-ids";

export const IDE_INTEGRATIONS = "ide_integrations";
export const IDE_INTEGRATION_SJASMPLUS = "ide_integration_sjasmplus";

export function createIdeIntegrationsMenu(
  displayDialog: (dialogId: number) => Promise<unknown>
): MenuItemConstructorOptions {
  return {
    type: "submenu",
    id: IDE_INTEGRATIONS,
    label: "Integrations",
    submenu: [
      {
        id: IDE_INTEGRATION_SJASMPLUS,
        label: "SjasmPlus Assembler",
        click: async () => {
          await displayDialog(SJASMPLUS_INTEGRATION_DIALOG);
        }
      }
    ]
  };
}

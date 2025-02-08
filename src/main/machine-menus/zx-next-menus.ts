import { MachineMenuRenderer } from "@common/machines/info-types";
import { getIdeAltApi } from "@common/messaging/MainToIdeMessenger";
import { setVolatileDocStateAction } from "@common/state/actions";
import { BASIC_PANEL_ID } from "@common/state/common-ids";
import { mainStore } from "@main/main-store";

/**
 * Renders ZX Spectrum IDE commands
 */
export const nextIdeRenderer: MachineMenuRenderer = () => {
  const volatileDocs = mainStore.getState()?.ideView?.volatileDocs ?? {};
  return [
    {
      id: "show_basic",
      label: "Show BASIC Listing",
      type: "checkbox",
      checked: volatileDocs[BASIC_PANEL_ID],
      click: async () => {
        await getIdeAltApi().showBasic(!volatileDocs[BASIC_PANEL_ID]);
        mainStore.dispatch(
          setVolatileDocStateAction(BASIC_PANEL_ID, !volatileDocs[BASIC_PANEL_ID])
        );
      }
    }
  ];
};


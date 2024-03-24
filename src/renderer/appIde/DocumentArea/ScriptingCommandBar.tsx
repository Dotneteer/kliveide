import { PANE_ID_SCRIPTIMG } from "@common/integration/constants";
import { TabButton, TabButtonSeparator } from "@renderer/controls/TabButton";
import { useAppServices } from "../services/AppServicesProvider";
import { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { isScriptCompleted } from "@common/utils/script-utils";
import { AppServices } from "@renderer/abstractions/AppServices";

/**
 * Represents the command bar for files that support scripting.
 */
const ScriptingCommandBar = () => {
  const { outputPaneService, ideCommandsService } = useAppServices();
  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName='play'
        title='Run this script file'
        clicked={async () => {
          const scriptPane =
            outputPaneService.getOutputPaneBuffer(PANE_ID_SCRIPTIMG);
          scriptPane.writeLine("Running script...");
          scriptPane.writeLine("Script completed.");
          await ideCommandsService.executeCommand(`outp ${PANE_ID_SCRIPTIMG}`);
        }}
      />
    </>
  );
};

export function getScriptingContextMenuIfo (
  services: AppServices
): ContextMenuInfo[] {
  return [
    {
      text: "Run script",
      disabled: (store: Store<AppState>, item: string) => {
        const script = store
          .getState()
          .scripts.find(
            s => s.scriptFileName === item && !isScriptCompleted(s.status)
          );
        return !!script;
      },
      clicked: async (item: string) => {
        services.ideCommandsService.executeCommand(`script-run "${item}"`);
      }
    },
    {
      text: "Stop script",
      disabled: (store: Store<AppState>, item: string) => {
        const script = store
          .getState()
          .scripts.find(
            s => s.scriptFileName === item && !isScriptCompleted(s.status)
          );
        return !script;
      },
      clicked: async (item: string) => {
        services.ideCommandsService.executeCommand(`script-cancel "${item}"`);
      }
    }
  ];
}

export const scriptingCommandBarRenderer = () => <ScriptingCommandBar />;

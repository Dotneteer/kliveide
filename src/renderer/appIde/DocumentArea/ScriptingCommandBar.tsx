import { PANE_ID_SCRIPTIMG } from "@common/integration/constants";
import { TabButton, TabButtonSeparator } from "@renderer/controls/TabButton";
import { useAppServices } from "../services/AppServicesProvider";

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

export const scriptingCommandBarRenderer = () => <ScriptingCommandBar />;

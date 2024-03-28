import { PANE_ID_SCRIPTIMG } from "@common/integration/constants";
import { TabButton, TabButtonSeparator } from "@renderer/controls/TabButton";
import { useAppServices } from "../services/AppServicesProvider";
import { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { isScriptCompleted } from "@common/utils/script-utils";
import { AppServices } from "@renderer/abstractions/AppServices";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";

type Props = {
  path: string;
};

/**
 * Represents the command bar for files that support scripting.
 */
const ScriptingCommandBar = ({ path }: Props) => {
  const { ideCommandsService, scriptService } = useAppServices();
  const scriptsInfo = useSelector(s => s.scripts);
  const [scriptRunning, setScriptRunning] = useState(false);

  useEffect(() => {
    const scripts = scriptsInfo.slice().reverse();
    const script = scripts.find(
      s => s.scriptFileName === path && !isScriptCompleted(s.status)
    );
    setScriptRunning(!!script);
  }, [scriptsInfo]);

  return (
    <>
      <TabButtonSeparator />
      {!scriptRunning && (
        <TabButton
          iconName='play'
          title='Run this script file'
          clicked={async () => {
            await ideCommandsService.executeCommand(
              `outp ${PANE_ID_SCRIPTIMG}`
            );
            await ideCommandsService.executeCommand(`script-run "${path}"`);

            // --- Delay 100ms to wait for the script to start
            await new Promise(resolve => setTimeout(resolve, 100));
            const scriptId = scriptService.getLatestScriptId(path);
            if (scriptId > 0) {
              await ideCommandsService.executeCommand(
                `script-output ${scriptId}`
              );
            }
          }}
        />
      )}
      {scriptRunning && (
        <TabButton
          iconName='stop'
          title='Stop this script file'
          clicked={async () => {
            await ideCommandsService.executeCommand(
              `outp ${PANE_ID_SCRIPTIMG}`
            );
            await ideCommandsService.executeCommand(`script-cancel "${path}"`);
          }}
        />
      )}
    </>
  );
};

export function getScriptingContextMenuIfo (
  services: AppServices
): ContextMenuInfo[] {
  const { ideCommandsService } = services;
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
        await ideCommandsService.executeCommand(`outp ${PANE_ID_SCRIPTIMG}`);
        await ideCommandsService.executeCommand(`script-run "${item}"`);
        // --- Delay 100ms to wait for the script to start
        await new Promise(resolve => setTimeout(resolve, 100));
        const scriptId = services.scriptService.getLatestScriptId(item);
        if (scriptId > 0) {
          await ideCommandsService.executeCommand(`script-output ${scriptId}`);
        }
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
        await ideCommandsService.executeCommand(`outp ${PANE_ID_SCRIPTIMG}`);
        await ideCommandsService.executeCommand(`script-cancel "${item}"`);
      }
    }
  ];
}

export const scriptingCommandBarRenderer = (path: string) => (
  <ScriptingCommandBar path={path} />
);

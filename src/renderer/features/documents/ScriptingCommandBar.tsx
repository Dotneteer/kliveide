import {
  TabButton,
  TabButtonSeparator,
  TabButtonSpace
} from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { AppServices } from "@renderer/abstractions/AppServices";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import {
  findRunningScript,
  runScript,
  showScriptOutput,
  stopScript
} from "./scriptingCommandHelpers";

type Props = {
  path: string;
};

/**
 * Exposes run, stop, and output commands for script-capable document tabs while
 * reflecting the current script state from the shared script service.
 */
const ScriptingCommandBar = ({ path }: Props) => {
  const { ideCommandsService, scriptService } = useAppServices();
  const scriptsInfo = useSelector(s => s.scripts);
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptEverStarted, setScriptEverStarted] = useState(false);

  useEffect(() => {
    setScriptRunning(!!findRunningScript(scriptsInfo, path));
    const scriptId = scriptService.getLatestScriptId(path);
    if (scriptId > 0) {
      setScriptEverStarted(true);
    }
  }, [path, scriptService, scriptsInfo]);

  return (
    <>
      <TabButtonSeparator />
      {!scriptRunning && (
        <TabButton
          iconName='play'
          title='Run this script file'
          clicked={async () => {
            await runScript(ideCommandsService, scriptService, path);
            setScriptEverStarted(true);
          }}
        />
      )}
      {scriptRunning && (
        <TabButton
          iconName='stop'
          title='Stop this script file'
          clicked={async () => await stopScript(ideCommandsService, path)}
        />
      )}
      <TabButtonSpace />
      <TabButton
        iconName='note'
        title='Show script output'
        disabled={!scriptEverStarted}
        clicked={async () => await showScriptOutput(ideCommandsService, scriptService, path)}
      />
    </>
  );
};

export function getScriptingContextMenuIfo (
  services: AppServices
): ContextMenuInfo[] {
  const { ideCommandsService, scriptService } = services;
  return [
    {
      text: "Run script",
      disabled: (store: Store<AppState>, item: string) => {
        return !!findRunningScript(store.getState().scripts, item);
      },
      clicked: async (item: string) => await runScript(ideCommandsService, scriptService, item)
    },
    {
      text: "Stop script",
      disabled: (store: Store<AppState>, item: string) => {
        return !findRunningScript(store.getState().scripts, item);
      },
      clicked: async (item: string) => await stopScript(ideCommandsService, item)
    },
    {
      text: "Show script output",
      disabled: (_, item: string) => {
        const scriptId = scriptService.getLatestScriptId(item);
        return scriptId < 0;
      },
      clicked: async (item: string) =>
        await showScriptOutput(ideCommandsService, scriptService, item)
    }
  ];
}

export const scriptingCommandBarRenderer = (path: string) => (
  <ScriptingCommandBar path={path} />
);

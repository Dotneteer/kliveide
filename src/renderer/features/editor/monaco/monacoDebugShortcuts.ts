import type * as monacoEditor from "monaco-editor";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { Store } from "@common/state/redux-light";
import type { AppState } from "@common/state/AppState";
import type { createEmuApi } from "@common/messaging/EmuApi";
import type { createMainApi } from "@common/messaging/MainApi";

type ShortcutBinding = {
  key: number;
  shortCut: string;
};

type MainApi = ReturnType<typeof createMainApi>;
type EmuApi = ReturnType<typeof createEmuApi>;

/**
 * Registers debugger stepping shortcuts on the mounted Monaco editor.
 */
export async function registerMonacoDebugShortcuts(
  editor: monacoEditor.editor.IStandaloneCodeEditor,
  mainApi: Pick<MainApi, "getUserSettings">,
  emuApi: Pick<EmuApi, "issueMachineCommand">,
  store: Store<AppState>,
  keysToRebind: ShortcutBinding[]
): Promise<void> {
  const settings = (await mainApi.getUserSettings())?.shortcuts ?? {};
  bindShortcut(settings.stepInto, "stepInto");
  bindShortcut(settings.stepOver, "stepOver");
  bindShortcut(settings.stepOut, "stepOut");

  function bindShortcut(shortcut: string | undefined, command: string): void {
    const mappingKey = keysToRebind.find((key) => key.shortCut === shortcut);
    if (!mappingKey) return;

    editor.addCommand(mappingKey.key, async () => {
      if (isPaused(store)) {
        await emuApi.issueMachineCommand(command);
      }
    });
  }
}

function isPaused(store: Store<AppState>): boolean {
  const state = store.getState();
  return (
    !state?.compilation?.inProgress &&
    state?.emulatorState?.machineState === MachineControllerState.Paused
  );
}

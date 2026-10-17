import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";

import { debugRecordingLoadCommandText } from "@common/debugRecording/debugRecordingTypes";

/*
 * **Open** / **Open at start** for a debug recording (`.klr`): the Explorer's context menu entries
 * and the buttons in the recording viewer's tab bar (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` D19),
 * copied from `MachineStateLaunchMenu.tsx`. Both run `debug-recording-load`, which makes the project
 * check once it has read the file's machine.
 */

/** The Explorer's entries for a recording */
export function getDebugRecordingContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const open = async (item: string, start: boolean) => {
    await ideCommandsService.executeCommand(debugRecordingLoadCommandText(item, { start }));
  };
  return [
    { text: t("documents.debugRecording.menu.open"), clicked: async (item: string) => await open(item, false) },
    { text: t("documents.debugRecording.menu.openAtStart"), clicked: async (item: string) => await open(item, true) }
  ];
}

/** The two actions in a recording document's tab bar */
const DebugRecordingLaunchCommandBar = ({ path }: { path: string }) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  const open = async (start: boolean) => {
    await ideCommandsService.executeCommand(debugRecordingLoadCommandText(path, { start }));
  };
  return (
    <>
      <TabButtonSeparator />
      <TabButton iconName="debug" title={t("documents.debugRecording.button.open")} clicked={async () => await open(false)} />
      <TabButtonSpace />
      <TabButton
        iconName="history"
        title={t("documents.debugRecording.button.openAtStart")}
        clicked={async () => await open(true)}
      />
    </>
  );
};

export const debugRecordingLaunchCommandBarRenderer = (path: string) => <DebugRecordingLaunchCommandBar path={path} />;

import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import type { MachineStateLoadMode } from "@common/machineState/machineStateTypes";

import { machineStateLoadCommandText } from "@common/machineState/machineStateTypes";

/*
 * **Run** / **Debug** for a Klive state file (`.kls`): the Explorer's context menu entries and the
 * buttons in the state viewer's tab bar (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.9),
 * copied from `SpectrumSnapshotLaunchMenu.tsx`. All of them run the `state-load` command, which
 * makes the project check (D10) once it has read the file's machine.
 */

/** The Explorer's entries for a state file */
export function getMachineStateContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const launch = async (item: string, mode: MachineStateLoadMode) => {
    await ideCommandsService.executeCommand(machineStateLoadCommandText(item, mode));
  };
  return [
    { text: t("documents.machineState.menu.run"), clicked: async (item: string) => await launch(item, "run") },
    { text: t("documents.machineState.menu.debug"), clicked: async (item: string) => await launch(item, "debug") }
  ];
}

/** The two actions in a state document's tab bar */
const MachineStateLaunchCommandBar = ({ path }: { path: string }) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  const launch = async (mode: MachineStateLoadMode) => {
    await ideCommandsService.executeCommand(machineStateLoadCommandText(path, mode));
  };
  return (
    <>
      <TabButtonSeparator />
      <TabButton iconName="play" title={t("documents.machineState.button.run")} clicked={async () => await launch("run")} />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={t("documents.machineState.button.debug")}
        clicked={async () => await launch("debug")}
      />
    </>
  );
};

export const machineStateLaunchCommandBarRenderer = (path: string) => <MachineStateLaunchCommandBar path={path} />;

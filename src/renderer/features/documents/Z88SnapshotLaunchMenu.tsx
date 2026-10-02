import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import type { Z88SnapshotCommandOption } from "@common/z88/z88SnapshotLoadTypes";

import { z88SnapshotCommandText } from "@common/z88/z88SnapshotLoadTypes";
import { z88SnapshotProjectGuard } from "@renderer/appIde/commands/Z88SnapshotCommand";

/*
 * **Run** / **Debug** for a `.z88` snapshot: the Explorer's context menu entries and the buttons in
 * the `.z88` viewer's tab bar (`.plans/Z88_SNAPSHOT_PLAN.md` §4.9). There is no "Load (paused)": it
 * stopped at the snapshot's PC exactly as Debug does, and differed only in Continue then ignoring
 * breakpoints, which nothing on screen told apart. All of them run the
 * `z88-snapshot` command, as the `.nex` launch entries run `nex-run`, so the Explorer, the viewer,
 * the emulator menu and a script do the same thing.
 *
 * They do what was clicked, whatever the file's `Autorun` flag says; only the emulator's "Open Z88
 * Snapshot" menu follows it. They are disabled for the one case the command refuses up front - a
 * project for another machine (`z88SnapshotProjectGuard`) - so the user is told before clicking.
 * A snapshot Klive cannot load leaves them enabled: the command explains why, and the viewer
 * already shows it.
 */

/**
 * The Explorer's entries for a `.z88` file.
 * @param services The app services
 */
export function getZ88SnapshotContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const refused = (store: Parameters<NonNullable<ContextMenuInfo["disabled"]>>[0]) =>
    !!z88SnapshotProjectGuard(store.getState());
  const launch = async (item: string, option: Z88SnapshotCommandOption) => {
    await ideCommandsService.executeCommand(z88SnapshotCommandText(item, option));
  };

  return [
    {
      text: "Run Z88 snapshot",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "run")
    },
    {
      text: "Debug Z88 snapshot (stop at PC)",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "debug")
    }
  ];
}

type Props = {
  path: string;
};

/** The two actions in a `.z88` document's tab bar */
const Z88SnapshotLaunchCommandBar = ({ path }: Props) => {
  const { ideCommandsService } = useAppServices();
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const refusal = z88SnapshotProjectGuard({ project: { isKliveProject }, emulatorState: { machineId } });
  const hint = refusal ? ` (${refusal})` : "";

  const launch = async (option: Z88SnapshotCommandOption) => {
    await ideCommandsService.executeCommand(z88SnapshotCommandText(path, option));
  };

  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={`Load and run this snapshot${hint}`}
        disabled={!!refusal}
        clicked={async () => await launch("run")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={`Load this snapshot and debug it, stopping at its PC${hint}`}
        disabled={!!refusal}
        clicked={async () => await launch("debug")}
      />
    </>
  );
};

export const z88SnapshotLaunchCommandBarRenderer = (path: string) => (
  <Z88SnapshotLaunchCommandBar path={path} />
);

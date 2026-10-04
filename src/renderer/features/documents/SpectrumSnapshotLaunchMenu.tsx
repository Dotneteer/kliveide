import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import type { SpectrumSnapshotCommandOption } from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";

import { spectrumSnapshotCommandText } from "@common/spectrum/snapshot/spectrumSnapshotLoadTypes";
import { spectrumSnapshotProjectGuard } from "@renderer/appIde/commands/SpectrumSnapshotCommand";

/*
 * **Run** / **Debug** for a ZX Spectrum snapshot (`.sna`, `.z80`, `.szx`): the Explorer's context
 * menu entries and the buttons in the snapshot viewer's tab bar
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.9), copied from `Z88SnapshotLaunchMenu.tsx`. All of
 * them run the `zx-snapshot` command, so the Explorer, the viewer, the menus and a script do the
 * same thing.
 *
 * They have not read the file, so they are disabled only for a project whose machine is not a ZX
 * Spectrum (`spectrumSnapshotProjectGuard` without a machine). The command makes the precise check
 * once it has parsed the snapshot (D7), and explains a snapshot Klive cannot load.
 */

/**
 * The Explorer's entries for a snapshot file.
 * @param services The app services
 */
export function getSpectrumSnapshotContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const refused = (store: Parameters<NonNullable<ContextMenuInfo["disabled"]>>[0]) =>
    !!spectrumSnapshotProjectGuard(store.getState());
  const launch = async (item: string, option: SpectrumSnapshotCommandOption) => {
    await ideCommandsService.executeCommand(spectrumSnapshotCommandText(item, option));
  };

  return [
    {
      text: "Run snapshot",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "run")
    },
    {
      text: "Debug snapshot (stop at PC)",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "debug")
    }
  ];
}

type Props = {
  path: string;
};

/** The two actions in a snapshot document's tab bar */
const SpectrumSnapshotLaunchCommandBar = ({ path }: Props) => {
  const { ideCommandsService } = useAppServices();
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const refusal = spectrumSnapshotProjectGuard({ project: { isKliveProject }, emulatorState: { machineId } });
  const hint = refusal ? ` (${refusal})` : "";

  const launch = async (option: SpectrumSnapshotCommandOption) => {
    await ideCommandsService.executeCommand(spectrumSnapshotCommandText(path, option));
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

export const spectrumSnapshotLaunchCommandBarRenderer = (path: string) => (
  <SpectrumSnapshotLaunchCommandBar path={path} />
);

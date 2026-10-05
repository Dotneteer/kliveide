import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";

import { rzxPlayCommandText, rzxVideoCommandText } from "@common/spectrum/rzx/rzxCommandTypes";
import { spectrumSnapshotProjectGuard } from "@renderer/appIde/commands/SpectrumSnapshotCommand";

/*
 * **Play** / **Debug** / **Render to video** for an RZX recording: the Explorer's context menu
 * entries and the buttons in the RZX viewer's tab bar (`.plans/RZX_PLAN.md` §4.6), following
 * `SpectrumSnapshotLaunchMenu.tsx`. All of them run the `zx-rzx` / `zx-rzx-video` commands, which
 * make the precise checks once they have read the file.
 */

const recordingGuard = (state: Parameters<typeof spectrumSnapshotProjectGuard>[0]) =>
  spectrumSnapshotProjectGuard(state)?.replace(/snapshot/g, "recording");

/** The Explorer's entries for an `.rzx` file */
export function getRzxContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const refused = (store: Parameters<NonNullable<ContextMenuInfo["disabled"]>>[0]) =>
    !!recordingGuard(store.getState());
  const run = async (command: string) => {
    await ideCommandsService.executeCommand(command);
  };
  return [
    { text: "Play recording", disabled: refused, clicked: async (item: string) => await run(rzxPlayCommandText(item)) },
    {
      text: "Debug recording (stop at its first instruction)",
      disabled: refused,
      clicked: async (item: string) => await run(rzxPlayCommandText(item, true))
    },
    {
      text: "Render recording to video",
      disabled: (store) => refused(store) || !store.getState()?.emulatorState?.screenRecordingAvailable,
      clicked: async (item: string) => await run(rzxVideoCommandText(item))
    }
  ];
}

type Props = { path: string };

const RzxLaunchCommandBar = ({ path }: Props) => {
  const { ideCommandsService } = useAppServices();
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const canRecord = useSelector((s) => s.emulatorState?.screenRecordingAvailable);
  const refusal = recordingGuard({ project: { isKliveProject }, emulatorState: { machineId } });
  const hint = refusal ? ` (${refusal})` : "";
  const run = async (command: string) => {
    await ideCommandsService.executeCommand(command);
  };
  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={`Play this recording${hint}`}
        disabled={!!refusal}
        clicked={async () => await run(rzxPlayCommandText(path))}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={`Play this recording under the debugger, stopping at its first instruction${hint}`}
        disabled={!!refusal}
        clicked={async () => await run(rzxPlayCommandText(path, true))}
      />
      <TabButtonSpace />
      <TabButton
        iconName="record"
        title={canRecord ? `Render this recording to video${hint}` : "Screen recording is not available (FFmpeg was not found)"}
        disabled={!!refusal || !canRecord}
        clicked={async () => await run(rzxVideoCommandText(path))}
      />
    </>
  );
};

export const rzxLaunchCommandBarRenderer = (path: string) => <RzxLaunchCommandBar path={path} />;

import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
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
    { text: t("documents.rzx.menu.play"), disabled: refused, clicked: async (item: string) => await run(rzxPlayCommandText(item)) },
    {
      text: t("documents.rzx.menu.debug"),
      disabled: refused,
      clicked: async (item: string) => await run(rzxPlayCommandText(item, true))
    },
    {
      text: t("documents.rzx.menu.video"),
      disabled: (store) => refused(store) || !store.getState()?.emulatorState?.screenRecordingAvailable,
      clicked: async (item: string) => await run(rzxVideoCommandText(item))
    }
  ];
}

type Props = { path: string };

const RzxLaunchCommandBar = ({ path }: Props) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const canRecord = useSelector((s) => s.emulatorState?.screenRecordingAvailable);
  const refusal = recordingGuard({ project: { isKliveProject }, emulatorState: { machineId } });
  const run = async (command: string) => {
    await ideCommandsService.executeCommand(command);
  };
  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={refusal ? t("documents.rzx.button.playRefused", { reason: refusal }) : t("documents.rzx.button.play")}
        disabled={!!refusal}
        clicked={async () => await run(rzxPlayCommandText(path))}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={
          refusal ? t("documents.rzx.button.debugRefused", { reason: refusal }) : t("documents.rzx.button.debug")
        }
        disabled={!!refusal}
        clicked={async () => await run(rzxPlayCommandText(path, true))}
      />
      <TabButtonSpace />
      <TabButton
        iconName="record"
        title={
          !canRecord
            ? t("documents.rzx.button.videoUnavailable")
            : refusal
              ? t("documents.rzx.button.videoRefused", { reason: refusal })
              : t("documents.rzx.button.video")
        }
        disabled={!!refusal || !canRecord}
        clicked={async () => await run(rzxVideoCommandText(path))}
      />
    </>
  );
};

export const rzxLaunchCommandBarRenderer = (path: string) => <RzxLaunchCommandBar path={path} />;

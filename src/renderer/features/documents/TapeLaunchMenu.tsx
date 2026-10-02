import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";

import { tapeLoadGuard } from "@renderer/appIde/commands/TapeLoadCommand";

/*
 * **Load and run** / **Insert** / **Load and debug** for a `.tap` or `.tzx` file: the Explorer's
 * context menu entries and the buttons in the tape viewer's tab bar (`.plans/TAPE_VIEWER_PLAN.md`
 * §4.6). All of them run the `tape-load` command, as the `.nex` entries run `nex-run`, so the
 * Explorer, the viewer and a script do the same thing.
 *
 * On any machine but the ZX Spectrum 48K, 128K and +2/+3 every one of them is disabled
 * (`tapeLoadGuard`, §7 Q1). The buttons keep their tooltip and say why; a context menu entry has no
 * tooltip, so it is only greyed out. The machine is never switched automatically.
 */

const LAUNCH_OPTIONS = {
  run: " -r",
  insert: "",
  debug: " -d"
} as const;

type TapeLaunchMode = keyof typeof LAUNCH_OPTIONS;

/** The command text for loading `path` in `mode`; the path is quoted, as it may hold spaces */
export function tapeLoadCommandText(path: string, mode: TapeLaunchMode): string {
  return `tape-load "${path}"${LAUNCH_OPTIONS[mode]}`;
}

/**
 * The Explorer's entries for a `.tap` or `.tzx` file.
 * @param services The app services
 */
export function getTapeLaunchContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const refused = (store: Parameters<NonNullable<ContextMenuInfo["disabled"]>>[0]) =>
    !!tapeLoadGuard(store.getState());
  const launch = async (item: string, mode: TapeLaunchMode) => {
    await ideCommandsService.executeCommand(tapeLoadCommandText(item, mode));
  };

  return [
    {
      text: "Load and run tape",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "run")
    },
    {
      text: "Insert tape",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "insert")
    },
    {
      text: "Load and debug tape",
      disabled: refused,
      clicked: async (item: string) => await launch(item, "debug")
    }
  ];
}

type Props = {
  path: string;
};

/** The three actions in a tape document's tab bar */
const TapeLaunchCommandBar = ({ path }: Props) => {
  const { ideCommandsService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const refusal = tapeLoadGuard({ emulatorState: { machineId } });
  const hint = refusal ? ` (${refusal})` : "";
  const loadHint = refusal ? hint : ` — fast load ${fastLoad === false ? "off" : "on"}`;

  const launch = async (mode: TapeLaunchMode) => {
    await ideCommandsService.executeCommand(tapeLoadCommandText(path, mode));
  };

  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={`Load and run this tape: reset, then LOAD ""${loadHint}`}
        disabled={!!refusal}
        clicked={async () => await launch("run")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="cassette-tape"
        title={`Insert this tape without a reset${hint}`}
        disabled={!!refusal}
        clicked={async () => await launch("insert")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={`Load and debug this tape, with breakpoints armed${loadHint}`}
        disabled={!!refusal}
        clicked={async () => await launch("debug")}
      />
    </>
  );
};

export const tapeLaunchCommandBarRenderer = (path: string) => <TapeLaunchCommandBar path={path} />;

import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";

import { MI_ZXNEXT } from "@common/machines/constants";

/**
 * How a `.nex` file is launched, and the `nex-run` options each mode passes.
 *
 * "Debug (break at entry)" is the one worth explaining: debugging a NEX you did not write starts
 * with not knowing where its code is, and the entry point is the one address the file itself names.
 * Plain "Debug" arms the breakpoints you already set and lets the program run; this one stops on its
 * first instruction, with the entry bank paged in and the disassembly pointing at it.
 */
const LAUNCH_MODES = {
  run: "",
  debug: " -d",
  entry: " -e"
} as const;

type NexLaunchMode = keyof typeof LAUNCH_MODES;

/**
 * The Explorer's **Run** / **Debug** entries for a `.nex` file.
 *
 * All three go through the `nex-run` command rather than duplicating its work, which is what keeps the
 * Explorer, the NEX viewer's toolbar and a script doing the same thing — the pattern `.ksx` already
 * follows with `getScriptingContextMenuIfo`.
 *
 * Quoting the path matters: a project folder can contain spaces, and the command line is parsed by
 * the same tokenizer the user types into.
 */
export function getNexLaunchContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  const { ideCommandsService } = services;

  // --- NextZXOS is what loads a NEX, so these do nothing useful on another machine. The command
  // --- refuses it too; disabling here means the user is told before clicking rather than after.
  const notOnNext = (store: Store<AppState>) =>
    store.getState().emulatorState?.machineId !== MI_ZXNEXT;

  const launch = async (item: string, mode: NexLaunchMode) => {
    await ideCommandsService.executeCommand(`nex-run "${item}"${LAUNCH_MODES[mode]}`);
  };

  return [
    {
      text: "Run NEX file",
      disabled: notOnNext,
      clicked: async (item: string) => await launch(item, "run")
    },
    {
      text: "Debug NEX file",
      disabled: notOnNext,
      clicked: async (item: string) => await launch(item, "debug")
    },
    {
      text: "Debug NEX file (break at entry point)",
      disabled: notOnNext,
      clicked: async (item: string) => await launch(item, "entry")
    }
  ];
}

type Props = {
  path: string;
};

/**
 * **Run** / **Debug** / **Debug from the entry point** buttons in a `.nex` document's tab bar — the
 * same three actions the Explorer's context menu offers, reaching the same command.
 *
 * The `.ksx` command bar established this shape; the difference is that nothing here has per-file
 * state to track, so the buttons only need to know whether the current machine can run a NEX at all.
 */
const NexLaunchCommandBar = ({ path }: Props) => {
  const { ideCommandsService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const canLaunch = machineId === MI_ZXNEXT;
  const notNextHint = " (requires the ZX Spectrum Next machine)";

  const launch = async (mode: NexLaunchMode) => {
    await ideCommandsService.executeCommand(`nex-run "${path}"${LAUNCH_MODES[mode]}`);
  };

  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={`Run this NEX file${canLaunch ? "" : notNextHint}`}
        disabled={!canLaunch}
        clicked={async () => await launch("run")}
      />
      {/* --- `TabButtonSpace` between buttons is the convention the build-root and scripting bars
          --- already follow; without it these three read as one run of icons. */}
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={`Debug this NEX file${canLaunch ? "" : notNextHint}`}
        disabled={!canLaunch}
        clicked={async () => await launch("debug")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug-with-bp"
        title={`Debug this NEX file, breaking at its entry point${
          canLaunch ? "" : notNextHint
        }`}
        disabled={!canLaunch}
        clicked={async () => await launch("entry")}
      />
    </>
  );
};

export const nexLaunchCommandBarRenderer = (path: string) => <NexLaunchCommandBar path={path} />;

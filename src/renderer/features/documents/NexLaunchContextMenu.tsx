import { TabButton, TabButtonSeparator } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useSelector } from "@renderer/core/RendererProvider";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";

import { MI_ZXNEXT } from "@common/machines/constants";

/**
 * The Explorer's **Run** / **Debug** entries for a `.nex` file.
 *
 * Both go through the `nex-run` command rather than duplicating its work, which is what keeps the
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

  const launch = async (item: string, debug: boolean) => {
    await ideCommandsService.executeCommand(`nex-run "${item}"${debug ? " -d" : ""}`);
  };

  return [
    {
      text: "Run NEX file",
      disabled: notOnNext,
      clicked: async (item: string) => await launch(item, false)
    },
    {
      text: "Debug NEX file",
      disabled: notOnNext,
      clicked: async (item: string) => await launch(item, true)
    }
  ];
}

type Props = {
  path: string;
};

/**
 * **Run** / **Debug** buttons in a `.nex` document's tab bar, the same two actions the Explorer's
 * context menu offers and reaching the same command.
 *
 * The `.ksx` command bar established this shape; the difference is that nothing here has per-file
 * state to track, so the buttons only need to know whether the current machine can run a NEX at all.
 */
const NexLaunchCommandBar = ({ path }: Props) => {
  const { ideCommandsService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const canLaunch = machineId === MI_ZXNEXT;
  const notNextHint = " (requires the ZX Spectrum Next machine)";

  const launch = async (debug: boolean) => {
    await ideCommandsService.executeCommand(`nex-run "${path}"${debug ? " -d" : ""}`);
  };

  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={`Run this NEX file${canLaunch ? "" : notNextHint}`}
        disabled={!canLaunch}
        clicked={async () => await launch(false)}
      />
      <TabButton
        iconName="debug"
        title={`Debug this NEX file${canLaunch ? "" : notNextHint}`}
        disabled={!canLaunch}
        clicked={async () => await launch(true)}
      />
    </>
  );
};

export const nexLaunchCommandBarRenderer = (path: string) => <NexLaunchCommandBar path={path} />;

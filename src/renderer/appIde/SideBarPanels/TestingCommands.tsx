import type { SideBarCommandsProps } from "@renderer/abstractions/Activity";
import { ContextMenuItem, ContextMenuSeparator } from "@controls/ContextMenu";
import { useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { PANE_ID_TESTS } from "@common/integration/constants";

/**
 * The Testing activity's "..." menu (`.plans/Z80_UNIT_TESTS_PLAN.md` D4, D16): Add unit-test support,
 * and the runs the panel's toolbar offers, by name. Each item runs the matching `test-*` command into
 * the Tests pane.
 */
export const TestingCommands = ({ close }: SideBarCommandsProps) => {
  const { ideCommandsService, outputPaneService } = useAppServices();
  const hasProject = useSelector((s) => !!s.project?.isKliveProject && !!s.project?.buildRoots?.length);
  const running = useSelector((s) => !!s.unitTests?.running);
  const anyFailed = useSelector((s) => Object.values(s.unitTests?.results ?? {}).some((r) => r.status !== "passed"));

  const run = (command: string) => {
    close();
    void (async () => {
      await ideCommandsService.executeCommand(command, outputPaneService.getOutputPaneBuffer(PANE_ID_TESTS));
      await ideCommandsService.executeCommand(`outp ${PANE_ID_TESTS}`);
    })();
  };

  return (
    <>
      <ContextMenuItem
        text="Add unit-test support"
        disabled={!hasProject || running}
        clicked={() => run("test-init")}
      />
      <ContextMenuSeparator />
      <ContextMenuItem text="Run all tests" disabled={!hasProject || running} clicked={() => run("test-run")} />
      <ContextMenuItem
        text="Run failed tests"
        disabled={!hasProject || running || !anyFailed}
        clicked={() => run("test-run -failed")}
      />
      <ContextMenuItem
        text="Run all tests with coverage"
        disabled={!hasProject || running}
        clicked={() => run("test-run -coverage")}
      />
    </>
  );
};

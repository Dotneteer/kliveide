import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import classnames from "classnames";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { useSelector, useStore } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { IconButton } from "@renderer/controls/IconButton";
import { Icon } from "@renderer/controls/Icon";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { ContextMenu, ContextMenuItem, ContextMenuSeparator, useContextMenuState } from "@controls/ContextMenu";
import { DataPanel, DataRow, EmptyState, PanelFilter } from "@renderer/controls/data";
import { iconSizes } from "@renderer/theming/tokens/dimensions";
import { PANE_ID_TESTS } from "@common/integration/constants";
import { discoverUnitTests, type UnitTestCase } from "@common/unit-tests/discovery";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import {
  formatTstates,
  resultText,
  summaryText,
  unitTestRows,
  type UnitTestRow,
  type UnitTestRowStatus
} from "@renderer/appIde/unit-tests/unitTestTree";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import styles from "./UnitTestsPanel.module.scss";
import { useT } from "@common/i18n/useT";
import { uiLocale } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

/*
 * The Unit Tests panel of the Testing activity (`.plans/Z80_UNIT_TESTS_PLAN.md` D13, D14): the
 * tests of the last successful build as a tree of suites, each test with its status, T-states and,
 * when it did not pass, its message. A click on a test goes to its label, a click on a message to
 * the failing line. Running goes through the `test-*` commands, so the panel and the prompt do
 * exactly the same thing.
 */

/** The glyph and its colour token for a status */
const STATUS_ICON: Record<UnitTestRowStatus, { icon: string; fill: string; titleKey: MessageKey }> = {
  passed: { icon: "check", fill: "--color-unit-test-passed", titleKey: "panels.side.unitTests.status.passed" },
  failed: { icon: "close", fill: "--color-unit-test-failed", titleKey: "panels.side.unitTests.status.failed" },
  error: { icon: "warning", fill: "--color-unit-test-error", titleKey: "panels.side.unitTests.status.error" },
  running: { icon: "circle-filled", fill: "--color-unit-test-running", titleKey: "panels.side.unitTests.status.running" },
  queued: { icon: "circle-outline", fill: "--color-unit-test-running", titleKey: "panels.side.unitTests.status.queued" },
  notRun: { icon: "circle-outline", fill: "--color-unit-test-idle", titleKey: "panels.side.unitTests.status.notRun" }
};

const TEST_LANGUAGES = ["kz80-asm", "sjasmp"];

export const UnitTestsPanel = () => {
  const t = useT();
  const { ideCommandsService, outputPaneService } = useAppServices();
  const mainApi = useMainApi();
  const compilation = useSelector((s) => s.compilation);
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const unitTests = useSelector((s) => s.unitTests);
  const project = useSelector((s) => s.project);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>();
  const [menuState, menuApi] = useContextMenuState();
  const [menuTarget, setMenuTarget] = useState<UnitTestCase>();

  // --- The build root's language decides whether there can be tests at all (D14)
  const store = useStore();
  const buildRoot = project?.buildRoots?.[0];
  const language = useMemo(
    () =>
      buildRoot && project?.folderPath
        ? getFileTypeEntry(`${project.folderPath}/${buildRoot}`, store)?.subType
        : undefined,
    [buildRoot, project?.folderPath, store]
  );

  // --- Discovery follows the build (D14): the last successful build's tests
  const program = useMemo(() => {
    const result = compilation?.result as KliveCompilerOutput | undefined;
    if (!result || compilation?.failed || result.errors?.some((e) => !e.isWarning)) return undefined;
    return discoverUnitTests(result as never, machineId);
  }, [compilation?.result, compilation?.failed, machineId]);

  const results = unitTests?.results ?? {};
  const run = { running: unitTests?.running, runningTest: unitTests?.runningTest, runIds: unitTests?.runIds };
  const tests = program?.tests ?? [];
  const rows = useMemo(
    () => unitTestRows(tests, results, run, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tests, unitTests?.version, filter]
  );

  const running = !!unitTests?.running;
  const anyFailed = Object.values(results).some((r) => r.status !== "passed");
  const canRun = !!program?.labels && tests.length > 0 && !running;

  /** Runs a command with the Tests pane as its output, then shows the pane */
  const execute = async (command: string) => {
    const pane = outputPaneService.getOutputPaneBuffer(PANE_ID_TESTS);
    await ideCommandsService.executeCommand(command, pane);
    await ideCommandsService.executeCommand(`outp ${PANE_ID_TESTS}`);
  };
  /** Export results as JUnit… (`.plans/UNIT_TESTS_CLI_PLAN.md` D14): the command line's format */
  const exportJUnit = async () => {
    const file = await mainApi.showSaveFileDialog({
      title: t("panels.side.unitTests.exportDialogTitle"),
      defaultPath: "unit-tests.xml",
      filters: [{ name: t("panels.side.unitTests.junitFilter"), extensions: ["xml"] }],
      settingsId: "unitTestJUnitExport"
    });
    if (file) await execute(`test-junit "${file}"`);
  };
  const navigate = (file: string | undefined, line: number | undefined) => {
    if (!file || line === undefined) return;
    void ideCommandsService.executeCommand(`nav "${file}" ${line} -r unitTest`);
  };
  const showMenu = (test: UnitTestCase, e: ReactMouseEvent) => {
    setMenuTarget(test);
    setSelected(test.id);
    menuApi.show(e);
  };

  // --- What the status line says
  const builtAt = compilation?.endedAt ? new Date(compilation.endedAt).toLocaleTimeString(uiLocale()) : undefined;
  const status = running
    ? unitTests?.runningTest
      ? t("panels.side.unitTests.runningTest", { test: unitTests.runningTest })
      : t("panels.side.unitTests.runningAll")
    : unitTests?.summary
      ? summaryText(unitTests.summary)
      : undefined;
  const problems = [
    ...(unitTests?.running ? [] : (unitTests?.problems ?? [])),
    ...(program?.problems ?? [])
  ];

  let empty: string | undefined;
  if (!project?.isKliveProject) empty = t("panels.side.unitTests.empty.noProject");
  else if (language && !TEST_LANGUAGES.includes(language))
    empty = t("panels.side.unitTests.empty.language");
  else if (!program) empty = t("panels.side.unitTests.empty.notBuilt");
  else if (!tests.length) empty = t("panels.side.unitTests.empty.noTests");

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <IconButton
          iconName="play"
          title={t("panels.side.unitTests.toolbar.runAll")}
          iconSize={iconSizes.sm}
          buttonWidth={22}
          buttonHeight={22}
          enable={!running && !!project?.isKliveProject}
          fill="--color-command-icon"
          clicked={() => void execute("test-run")}
        />
        <IconButton
          iconName="refresh"
          title={t("panels.side.unitTests.toolbar.runFailed")}
          iconSize={iconSizes.sm}
          buttonWidth={22}
          buttonHeight={22}
          enable={canRun && anyFailed}
          fill="--color-command-icon"
          clicked={() => void execute("test-run -failed")}
        />
        <IconButton
          iconName="debug"
          title={selected ? t("panels.side.unitTests.toolbar.debug", { test: selected }) : t("panels.side.unitTests.toolbar.selectToDebug")}
          iconSize={iconSizes.sm}
          buttonWidth={22}
          buttonHeight={22}
          enable={canRun && !!selected && tests.some((test) => test.id === selected)}
          fill="--color-command-icon"
          clicked={() => selected && void execute(`test-debug ${selected}`)}
        />
        <IconButton
          iconName="stop"
          title={t("panels.side.unitTests.toolbar.stop")}
          iconSize={iconSizes.sm}
          buttonWidth={22}
          buttonHeight={22}
          enable={running}
          fill="--color-command-icon"
          clicked={() => void mainApi.cancelUnitTests()}
        />
        {program && !program.labels && TEST_LANGUAGES.includes(language ?? "") && (
          <IconButton
            iconName="plus"
            title={t("panels.side.unitTests.toolbar.addSupport")}
            iconSize={iconSizes.sm}
            buttonWidth={22}
            buttonHeight={22}
            enable={!running}
            fill="--color-command-icon"
            clicked={() => void execute("test-init")}
          />
        )}
      </div>
      {(builtAt || status) && (
        <div className={styles.status} title={[builtAt && t("panels.side.unitTests.builtAtLong", { time: builtAt }), status].filter(Boolean).join(" · ")}>
          {[builtAt && t("panels.side.unitTests.builtAt", { time: builtAt }), status].filter(Boolean).join(" · ")}
        </div>
      )}
      {problems.map((p, i) => (
        <div key={i} className={styles.problem}>
          {p}
        </div>
      ))}
      <DataPanel>
        {tests.length > 0 && (
          <PanelFilter
            value={filter}
            onChange={setFilter}
            placeholder={t("panels.side.unitTests.filterPlaceholder")}
            label={t("panels.side.unitTests.filterLabel")}
            status={filter.trim() ? `${rows.filter((r) => r.kind === "test").length} / ${tests.length}` : undefined}
          />
        )}
        {empty && <EmptyState message={empty} />}
        {!empty && rows.length === 0 && <EmptyState message={t("panels.side.unitTests.noMatch", { filter: filter.trim() })} motif={false} />}
        {rows.length > 0 && (
          <div className={styles.list}>
            <VirtualizedList
              items={rows}
              scrollRowsHorizontally
              renderItem={(idx) => (
                <UnitTestRowView
                  key={rows[idx].key}
                  row={rows[idx]}
                  index={idx}
                  selected={rows[idx].kind === "test" && (rows[idx] as { test: UnitTestCase }).test.id === selected}
                  onSelect={(test) => {
                    setSelected(test.id);
                    navigate(test.file, test.line);
                  }}
                  onMessage={(row) => navigate(row.result.location?.file, row.result.location?.line)}
                  onRun={(test) => void execute(`test-run ${test.id}`)}
                  onContextMenu={showMenu}
                />
              )}
            />
          </div>
        )}
      </DataPanel>
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem
          text={t("panels.side.unitTests.menu.run")}
          iconName="play"
          disabled={!canRun}
          clicked={() => {
            menuApi.conceal();
            if (menuTarget) void execute(`test-run ${menuTarget.id}`);
          }}
        />
        <ContextMenuItem
          text={t("panels.side.unitTests.menu.debug")}
          iconName="debug"
          disabled={!canRun}
          clicked={() => {
            menuApi.conceal();
            if (menuTarget) void execute(`test-debug ${menuTarget.id}`);
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text={t("panels.side.unitTests.menu.copyResult")}
          iconName="copy"
          clicked={() => {
            menuApi.conceal();
            if (menuTarget) void navigator.clipboard?.writeText(resultText(menuTarget, results[menuTarget.id]));
          }}
        />
        <ContextMenuItem
          text={t("panels.side.unitTests.menu.revealInDisassembly")}
          iconName="disassembly-icon"
          clicked={() => {
            menuApi.conceal();
            if (menuTarget) void ideCommandsService.executeCommand(`show-disass $${toHexa4(menuTarget.address)}`);
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text={t("panels.side.unitTests.menu.exportJUnit")}
          iconName="save"
          disabled={!Object.keys(results).length || running}
          clicked={() => {
            menuApi.conceal();
            void exportJUnit();
          }}
        />
      </ContextMenu>
    </div>
  );
};

type RowProps = {
  row: UnitTestRow;
  index: number;
  selected: boolean;
  onSelect: (test: UnitTestCase) => void;
  onMessage: (row: Extract<UnitTestRow, { kind: "message" }>) => void;
  onRun: (test: UnitTestCase) => void;
  onContextMenu: (test: UnitTestCase, e: ReactMouseEvent) => void;
};

const StatusGlyph = ({ status }: { status: UnitTestRowStatus }) => {
  const t = useT();
  const s = STATUS_ICON[status];
  const title = t(s.titleKey);
  return (
    <span title={title} aria-label={title}>
      <Icon iconName={s.icon} width={iconSizes.sm} height={iconSizes.sm} fill={s.fill} />
    </span>
  );
};

const UnitTestRowView = ({ row, index, selected, onSelect, onMessage, onRun, onContextMenu }: RowProps) => {
  const t = useT();
  switch (row.kind) {
    case "suite":
      return (
        <DataRow index={index}>
          <StatusGlyph status={row.status} />
          <span className={styles.suiteName} title={row.name}>
            {row.name}
          </span>
          <span className={styles.tstates}>
            {row.failures
              ? t("panels.side.unitTests.suiteFailing", { failures: row.failures, count: row.count })
              : `${row.count}`}
          </span>
        </DataRow>
      );
    case "test": {
      const inSuite = row.test.suitePath.length > 0;
      return (
        <DataRow
          index={index}
          xclass={classnames({ [styles.selected]: selected, [styles.indented]: inSuite })}
          clicked={() => onSelect(row.test)}
          onDoubleClick={() => onRun(row.test)}
          onContextMenu={(e) => onContextMenu(row.test, e)}
        >
          <StatusGlyph status={row.status} />
          <span className={styles.testName} title={`${row.test.id} ($${toHexa4(row.test.address)})`}>
            {row.test.label}
          </span>
          {row.result && <span className={styles.tstates}>{formatTstates(row.result.tstates)}</span>}
        </DataRow>
      );
    }
    case "message":
      return (
        <DataRow index={index} xclass={styles.messageIndent} clicked={() => onMessage(row)}>
          <span
            className={classnames(
              styles.message,
              row.result.status === "failed" ? styles.messageFailed : styles.messageError
            )}
            title={row.result.message}
          >
            {row.result.message}
          </span>
        </DataRow>
      );
  }
};

import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ReactNode, useMemo } from "react";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import classnames from "classnames";
import styles from "./IdeStatusBar.module.scss";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CODE_EDITOR } from "@common/state/common-ids";
import { historyStepText } from "@common/history/historyNavigation";
import { reverseStatusText, reverseStatusTooltip } from "@common/history/reverseDebugText";

type IdeStatusBarProps = {
  show: boolean;
};

export const IdeStatusBar = ({ show }: IdeStatusBarProps) => {
  const { projectService, ideCommandsService } = useAppServices();
  // --- The history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D7): "you are in the past", one click back
  const historyPosition = useSelector((s) => s.emulatorState?.historyPosition);
  // --- Full reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4): in the past, replaying, searching
  const reverseDebug = useSelector((s) => s.emulatorState?.reverseDebug);
  const execState = useSelector((s) => s.emulatorState?.machineState);
  const statusMessage = useSelector((s) => s.ideView?.statusMessage);
  const statusSuccess = useSelector((s) => s.ideView?.statusSuccess);
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const compilation = useSelector((s) => s.compilation);
  const cursorLine = useSelector((s) => s.ideView?.cursorLine);
  const cursorColumn = useSelector((s) => s.ideView?.cursorColumn);
  const automation = useSelector((s) => s.automation);
  useSelector((s) => s.ideView?.documentHubState);

  const machineState = useMemo(() => {
    switch (execState) {
      case MachineControllerState.None: return "Turned off";
      case MachineControllerState.Running: return "Running";
      case MachineControllerState.Pausing: return "Pausing";
      case MachineControllerState.Paused: return "Paused";
      case MachineControllerState.Stopping: return "Stopping";
      case MachineControllerState.Stopped: return "Stopped";
      default: return "";
    }
  }, [execState]);

  const { compileStatus, compileSuccess } = useMemo(() => {
    if (compilation.inProgress) return { compileStatus: "Compilation in progress...", compileSuccess: true };
    if (!compilation.result) return { compileStatus: "Not compiled yet", compileSuccess: true };
    // --- Warnings are listed with the errors but do not fail the compilation
    if (compilation.failed || compilation.result?.errors?.some((e) => !e.isWarning))
      return { compileStatus: "Compilation failed", compileSuccess: false };
    return { compileStatus: "Compilation successful", compileSuccess: true };
  }, [compilation]);

  // --- Get active document to check if it's a Monaco editor
  const activeDocument = projectService?.getActiveDocumentHubService()?.getActiveDocument();
  const isMonacoEditor = activeDocument?.type === CODE_EDITOR;

  if (!show) return null;

  return (
    <div className={styles.ideStatusBar}>
      <div className={styles.sectionWrapper}>
        <Section>
          <Icon iconName="vm-running" width={16} height={16} fill="--color-statusbar-icon" />
          <LabelSeparator />
          <Label text={machineState} />
        </Section>
        {reverseDebug && reverseStatusText(reverseDebug, historyPosition ? historyStepText(historyPosition) : undefined) ? (
          <ReverseDebugSection
            text={reverseStatusText(reverseDebug, historyPosition ? historyStepText(historyPosition) : undefined)!}
            tooltip={reverseStatusTooltip(reverseDebug)}
            stopped={!reverseDebug.active}
            searching={reverseDebug.searchedIntervals !== undefined}
            inThePast={reverseDebug.active && reverseDebug.mode === "navigating" && reverseDebug.searchedIntervals === undefined}
            inputIgnored={!!reverseDebug.inputsIgnored}
            run={(command) => void ideCommandsService.executeCommand(command)}
          />
        ) : !!historyPosition && execState === MachineControllerState.Paused && (
          <Section>
            <button
              type="button"
              className={styles.historyChip}
              title="Showing the execution history: memory shows the present. Click to return to the present."
              onClick={() => void ideCommandsService.executeCommand("history-present")}
            >
              ⟲ History {historyStepText(historyPosition)}
            </button>
          </Section>
        )}
        {isKliveProject && (
          <Section>
            <LabelSeparator />
            <Icon
              iconName="combine"
              width={16}
              height={16}
              fill="--color-statusbar-icon"
            />
            <LabelSeparator />
            <Label text={compileStatus} isError={!compileSuccess} />
          </Section>
        )}
        {statusMessage && (
          <Section>
            <Icon
              iconName={
                statusSuccess === undefined
                  ? "circle-outline"
                  : statusSuccess
                    ? "check"
                    : "circle-filled"
              }
              width={16}
              height={16}
              fill="--color-statusbar-icon"
            />
            <LabelSeparator />
            <Label text={statusMessage} />
          </Section>
        )}
        <SpaceFiller />
        {automation?.listening && (
          <Section>
            <AutomationItem
              clients={automation.clients}
              level={automation.level}
              open={() => void ideCommandsService.executeCommand("outp automation")}
            />
          </Section>
        )}
        {isMonacoEditor && cursorLine !== undefined && cursorColumn !== undefined && (
          <Section>
            <Label text="Ln" />
            <Label text={cursorLine.toString()} isMonospace={true} />
            <Label text="Col" />
            <Label text={cursorColumn.toString()} isMonospace={true} />
          </Section>
        )}
      </div>
    </div>
  );
};

type ReverseDebugSectionProps = {
  text: string;
  tooltip?: string;
  /** The timeline ended early (a desync): an error chip that explains itself in its tooltip */
  stopped: boolean;
  /** A Reverse Continue search runs: a click cancels it */
  searching: boolean;
  /** Paused in the past: a click returns to the present, and Take over here is offered */
  inThePast: boolean;
  /** Live input was dropped while in the past (D12) */
  inputIgnored: boolean;
  run: (command: string) => void;
};

/**
 * The reverse-debugging states (`.plans/REVERSE_DEBUGGING_PLAN.md` §4.4): "⟲ −1.24 s · step −3,412"
 * in the past, with Take over here beside it; "▶ Replaying · 800 ms to present"; a search's progress,
 * which a click cancels; and an error chip when the timeline stopped. The reverse range is in the
 * tooltip. The past keeps G4.3's chip colours (the secondary accent).
 */
const ReverseDebugSection = ({ text, tooltip, stopped, searching, inThePast, inputIgnored, run }: ReverseDebugSectionProps) => {
  const action = searching ? "reverse-continue-cancel" : inThePast ? "history-present" : undefined;
  return (
    <Section>
      <button
        type="button"
        className={classnames(styles.historyChip, { [styles.reverseStopped]: stopped, [styles.passive]: !action })}
        title={tooltip}
        onClick={action ? () => run(action) : undefined}
      >
        {text}
        {inputIgnored && !searching ? " · input ignored" : ""}
      </button>
      {inThePast && (
        <button
          type="button"
          className={styles.historyAction}
          title="Continue from this point: the recorded future is discarded (asks first)"
          onClick={() => run("history-take-over")}
        >
          Take over here
        </button>
      )}
    </Section>
  );
};

type AutomationItemProps = {
  clients: number;
  level?: string;
  open: () => void;
};

/**
 * The automation server's item (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D4): automation is
 * listening, and how many clients are connected. A click opens the Automation output pane (D13).
 */
const AutomationItem = ({ clients, level, open }: AutomationItemProps) => {
  const connected = clients > 0;
  const text = connected ? `Automation · ${clients} client${clients === 1 ? "" : "s"}` : "Automation";
  const tooltip =
    `Automation is on${level ? ` (level: ${level})` : ""}: scripts on this computer can drive Klive. ` +
    `${connected ? `${clients} connected. ` : ""}Click to show the Automation output.`;
  return (
    <button
      type="button"
      className={classnames(styles.automation, { [styles.connected]: connected })}
      title={tooltip}
      onClick={open}
    >
      <Icon iconName="plug" width={14} height={14} fill="currentColor" />
      {text}
    </button>
  );
};

const Section = ({ children }: SectionProps) => {
  return <div className={styles.section}>{children}</div>;
};

type LabelProps = {
  text: string;
  isMonospace?: boolean;
  isError?: boolean;
};

const Label = ({ text, isMonospace, isError }: LabelProps) => {
  return (
    <span
      className={classnames(styles.label, {
        [styles.isMonospace]: isMonospace,
        [styles.isError]: isError
      })}
    >
      {text}
    </span>
  );
};

type SectionProps = {
  children: ReactNode;
};

const LabelSeparator = () => <div className={styles.labelSeparator} />;

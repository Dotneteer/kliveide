import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ReactNode, useMemo } from "react";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import classnames from "classnames";
import styles from "./IdeStatusBar.module.scss";
import { useAppServices } from "../services/AppServicesProvider";
import { CODE_EDITOR } from "@common/state/common-ids";

type IdeStatusBarProps = {
  show: boolean;
};

export const IdeStatusBar = ({ show }: IdeStatusBarProps) => {
  const { projectService } = useAppServices();
  const execState = useSelector((s) => s.emulatorState?.machineState);
  const statusMessage = useSelector((s) => s.ideView?.statusMessage);
  const statusSuccess = useSelector((s) => s.ideView?.statusSuccess);
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const compilation = useSelector((s) => s.compilation);
  const cursorLine = useSelector((s) => s.ideView?.cursorLine);
  const cursorColumn = useSelector((s) => s.ideView?.cursorColumn);

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
    if (compilation.failed || compilation.result?.errors?.length > 0)
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

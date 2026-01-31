import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ReactNode, useEffect, useState } from "react";
import { Icon } from "@controls/Icon";
import { SpaceFiller } from "@controls/SpaceFiller";
import classnames from "classnames";
import styles from "./IdeStatusBar.module.scss";

type IdeStatusBarProps = {
  show: boolean;
};

export const IdeStatusBar = ({ show }: IdeStatusBarProps) => {
  const execState = useSelector((s) => s.emulatorState?.machineState);
  const statusMessage = useSelector((s) => s.ideView?.statusMessage);
  const statusSuccess = useSelector((s) => s.ideView?.statusSuccess);
  const isKliveProject = useSelector((s) => s.project?.isKliveProject);
  const compilation = useSelector((s) => s.compilation);
  const cursorLine = useSelector((s) => s.ideView?.cursorLine);
  const cursorColumn = useSelector((s) => s.ideView?.cursorColumn);
  const [machineState, setMachineState] = useState("");
  const [compileStatus, setCompileStatus] = useState("");
  const [compileSuccess, setCompileSuccess] = useState(true);

  // --- Reflect machine execution state changes
  useEffect(() => {
    switch (execState) {
      case MachineControllerState.None:
        setMachineState("Turned off");
        break;
      case MachineControllerState.Running:
        setMachineState("Running");
        break;
      case MachineControllerState.Pausing:
        setMachineState("Pausing");
        break;
      case MachineControllerState.Paused:
        setMachineState("Paused");
        break;
      case MachineControllerState.Stopping:
        setMachineState("Stopping");
        break;
      case MachineControllerState.Stopped:
        setMachineState("Stopped");
        break;
    }
  }, [execState]);

  useEffect(() => {
    let compilationLabel = "";
    let success = true;
    if (compilation.inProgress) {
      compilationLabel = "Compilation in progress...";
    } else {
      if (!compilation.result) {
        compilationLabel = "Not compiled yet";
      } else {
        if (compilation.failed || compilation.result?.errors?.length > 0) {
          compilationLabel = "Compilation failed";
          success = false;
        } else {
          compilationLabel = "Compilation successful";
        }
      }
    }
    setCompileStatus(compilationLabel);
    setCompileSuccess(success);
  }, [compilation]);

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
        {cursorLine !== undefined && cursorColumn !== undefined && (
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

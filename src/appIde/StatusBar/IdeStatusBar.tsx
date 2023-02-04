import { useSelector } from "@/core/RendererProvider";
import { MachineControllerState } from "@state/MachineControllerState";
import { ReactNode, useEffect, useState } from "react";
import { Icon } from "../../controls/common/Icon";
import { SpaceFiller } from "../../controls/common/SpaceFiller";
import classnames from "../../utils/classnames";
import styles from "./IdeStatusBar.module.scss";

export const IdeStatusBar = () => {
  const execState = useSelector(s => s.emulatorState?.machineState);
  const statusMessage = useSelector(s => s.ideView?.statusMessage);
  const statusSuccess = useSelector(s => s.ideView?.statusSuccess);
  const [machineState, setMachineState] = useState("");

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
  return (
    <div className={styles.ideStatusBar}>
      <div className={styles.sectionWrapper}>
        <Section>
          <Icon
            iconName='vm-running'
            width={16}
            height={16}
            fill='--color-statusbar-icon'
          />
          <LabelSeparator />
          <Label text={machineState} />
        </Section>
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
              fill='--color-statusbar-icon'
            />
            <LabelSeparator />
            <Label text={statusMessage} />
          </Section>
        )}
        <SpaceFiller />
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
};

const Label = ({ text, isMonospace }: LabelProps) => {
  return (
    <span
      className={classnames(styles.label, {
        [styles.isMonospace]: isMonospace
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
const SectionSeparator = () => <div className={styles.sectionSeparator} />;

import { useSelector } from "@/core/RendererProvider";
import { useAppServices } from "@/appIde/services/AppServicesProvider";
import { MachineControllerState } from "@state/MachineControllerState";
import { ReactNode, useEffect, useState } from "react";
import { Icon } from "../../controls/common/Icon";
import { SpaceFiller } from "../../controls/common/SpaceFiller";
import classnames from "../../utils/classnames";
import styles from "./IdeStatusBar.module.scss";

export const IdeStatusBar = () => {
  const { machineService } = useAppServices();
  const machineId = useSelector(s => s.emulatorState?.machineId);
  const execState = useSelector(s => s.emulatorState?.machineState);
  const [machineState, setMachineState] = useState("");
  const [machineName, setMachineName] = useState("");

  // --- Reflect machine ID changes
  useEffect(() => {
    if (machineId) {
      const info = machineService.getMachineInfo();
      setMachineName(info?.displayName ?? "");
    }
  }, [machineId]);

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
    <div className={styles.component}>
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
        <SpaceFiller />
        <Label text={machineName} />
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
      className={classnames(
        styles.label,
        isMonospace ? styles.isMonospace : ""
      )}
    >
      {text}
    </span>
  );
};

type SectionProps = {
  children: ReactNode;
};

type DataLabelProps = {
  value: number;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
};
const DataLabel = ({
  value,
  minimumFractionDigits = 3,
  maximumFractionDigits = 3,
  minimumIntegerDigits = 2
}: DataLabelProps) => {
  return (
    <Label
      text={value.toLocaleString(undefined, {
        minimumFractionDigits,
        maximumFractionDigits,
        minimumIntegerDigits
      })}
      isMonospace={true}
    />
  );
};

const LabelSeparator = () => <div className={styles.labelSeparator} />;
const SectionSeparator = () => <div className={styles.sectionSeparator} />;

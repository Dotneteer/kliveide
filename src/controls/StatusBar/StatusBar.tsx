import { useSelector } from "@/emu/StoreProvider";
import { useIdeServices } from "@/ide/IdeServicesProvider";
import { ReactNode, useEffect, useState } from "react";
import { Icon } from "../common/Icon";
import { SpaceFiller } from "../common/SpaceFiller";
import styles from "./StatusBar.module.scss";

export const StatusBar = () => {
    const {machineService } = useIdeServices();
    const machineId = useSelector(s => s.ideView?.machineId);
    const [machineName, setMachineName] = useState("");

    // --- Reflect machine ID changes
    useEffect(() => {
        if (machineId) {
            const info = machineService.getMachineInfo();
            setMachineName(info?.displayName ?? "");
        }
    }, [machineId]);

    return <div className={styles.component}>
        <div className={styles.sectionWrapper}>
            <Section>
                <Icon iconName="vm-running" width={16} height={16} fill="--color-statusbar-icon" />
                <LabelSeparator />
                <DataLabel value={123.45678} />
                <Label text="/" />
                <DataLabel value={123.45678} />
            </Section>
            <SectionSeparator />
            <Section>
                <Icon iconName="vm" width={16} height={16} fill="--color-statusbar-icon" />
                <LabelSeparator />
                <DataLabel value={123.45678} />
                <Label text="/" />
                <DataLabel value={123.45678} />
            </Section>
            <SectionSeparator />
            <Section>
                <Icon iconName="window" width={16} height={16} fill="--color-statusbar-icon" />
                <LabelSeparator />
                <Label text="48" />
            </Section>
            <SectionSeparator />
            <Section>
                <Label text="PC:" />
                <LabelSeparator />
                <Label text="15EF" />
            </Section>
            <SpaceFiller />
            <Label text={machineName} />
        </div>
    </div>
}

type LabelProps = {
    text: string;
}

const Section = ({children}: SectionProps) => {
    return <div className={styles.section}>{children}</div>
}

const Label = ({
    text
}: LabelProps ) => {
    return <span className={styles.label}>{text}</span>
}

type SectionProps = {
    children: ReactNode;
}

type DataLabelProps = {
    value: number;
}
const DataLabel = ({value}: DataLabelProps) => {
    return <Label text={value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/>
}

const LabelSeparator = () => <div className={styles.labelSeparator} />
const SectionSeparator = () => <div className={styles.sectionSeparator} />
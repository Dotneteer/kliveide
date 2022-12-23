import { useSelector } from "@/emu/StoreProvider";
import { useIdeServices } from "@/ide/IdeServicesProvider";
import { useEffect, useState } from "react";
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
        <SpaceFiller />
        <Label text={machineName} />
    </div>
}

type LabelProps = {
    text: string;
}

const Label = ({
    text
}: LabelProps ) => {
    return <span className={styles.label}>{text}</span>
}
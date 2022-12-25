import { MachineController } from "@/emu/machines/controller/MachineController";
import { useIdeServices } from "@/ide/IdeServicesProvider";
import { useEffect, useRef, useState } from "react";

export const useController = () => {
    const { machineService } = useIdeServices();
    const [controller, setController] = useState<MachineController>();
    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;

        mounted.current = true;
        const unsubscribe = machineService.newMachineTypeInitialized(() => {
            setController(machineService.getMachineController());
        });

        return () => {
            mounted.current = false;
            unsubscribe();
        };
    })

    return controller;
}

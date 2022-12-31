import { MachineController } from "@/emu/machines/controller/MachineController";
import { useIdeServices } from "@/ide/IdeServicesProvider";
import { useEffect, useRef, useState } from "react";

export const useController = () => {
    const { machineService, outputPaneService } = useIdeServices();
    const [controller, setController] = useState<MachineController>();
    const mounted = useRef(false);

    useEffect(() => {
        if (mounted.current) return;

        mounted.current = true;
        const unsubscribe = machineService.newMachineTypeInitialized(() => {
            // --- Obtain the new machine controller
            const newController = machineService.getMachineController();
            if (newController === controller) return;

            // --- Clean up the old controller
            controller?.dispose();

            // --- Done
            setController(newController);
            newController.output = outputPaneService.getOutputPaneBuffer("emu")
        });

        return () => {
            mounted.current = false;
            unsubscribe();
        };
    })
    return controller;
}

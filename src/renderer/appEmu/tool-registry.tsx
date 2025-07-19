import { MI_Z88 } from "@common/machines/constants";
import { ReactNode } from "react";
import { Z88ToolArea } from "./machines/Z88ToolArea";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

type EmuToolInfo = {
  machineId: string;
  toolFactory: (machine: IAnyMachine) => ReactNode;
};

// --- Registry of machine-specific tools
export const machineEmuToolRegistry: EmuToolInfo[] = [
  {
    machineId: MI_Z88,
    toolFactory: (_machine: IAnyMachine) => {
      return <Z88ToolArea />;
    }
  }
];

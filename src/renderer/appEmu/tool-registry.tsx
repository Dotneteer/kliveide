import { MI_Z88 } from "@common/machines/constants";
import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { ReactNode } from "react";
import { Z88ToolArea } from "./machines/Z88ToolArea";

type EmuToolInfo = {
  machineId: string;
  toolFactory: (machine: IZ80Machine) => ReactNode;
};

// --- Registry of machine-specific tools
export const machineEmuToolRegistry: EmuToolInfo[] = [
  {
    machineId: MI_Z88,
    toolFactory: (_machine: IZ80Machine) => {
      return <Z88ToolArea />;
    }
  }
];

import { createMetadata, wrapComponent } from "xmlui";
import type { ComponentMetadata } from "xmlui";
import { EmuMachineCommandsReact } from "./EmuMachineCommandsReact";

const COMP = "EmuMachineCommands";

export const EmuMachineCommandsMd: ComponentMetadata = createMetadata({
  status: "experimental",
  description: "Exposes emulator machine commands to XMLUI.",
  props: {},
  events: {},
  apis: {
    issueMachineCommand: {
      description: "Issues a command to the temporary emulator lifecycle controller.",
      signature: "issueMachineCommand(command: string): AppState"
    },
    issueRecordingCommand: {
      description: "Issues a command to the emulator recording controller.",
      signature: "issueRecordingCommand(command: string): AppState"
    }
  },
  nonVisual: true
});

export const emuMachineCommandsComponentRenderer = wrapComponent(
  COMP,
  EmuMachineCommandsReact,
  EmuMachineCommandsMd,
  {
    exposeRegisterApi: true
  }
);

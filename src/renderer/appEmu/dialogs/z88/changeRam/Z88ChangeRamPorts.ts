import type { Z88MachinePort, Z88OutputPort } from "../Z88Ports";

export type Z88ChangeRamDialogResult = {
  selectedSize: string;
  ramMask: number;
  changed: boolean;
};

export type Z88ChangeRamClosePort = {
  // --- Carries the outcome to the caller, including the "nothing changed" case:
  // --- the caller wants to know the dialog was answered, not only that the
  // --- machine was rebuilt.
  settled(result: Z88ChangeRamDialogResult): void;
  dismissed(): void;
};

export type Z88ChangeRamPorts = {
  machine: Z88MachinePort;
  output: Z88OutputPort;
  close: Z88ChangeRamClosePort;
};

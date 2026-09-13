import type { Z88MachinePort } from "../Z88Ports";

export type Z88RemoveCardDialogResult = {
  slot: number;
};

export type Z88RemoveCardClosePort = {
  removed(result: Z88RemoveCardDialogResult): void;
  dismissed(): void;
};

export type Z88RemoveCardPorts = {
  machine: Z88MachinePort;
  close: Z88RemoveCardClosePort;
};

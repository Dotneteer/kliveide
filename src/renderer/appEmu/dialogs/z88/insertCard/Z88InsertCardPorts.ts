import type { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";

import type { Z88MachinePort } from "../Z88Ports";
import type { Z88CardCheckResult } from "./Z88InsertCardModel";

export type Z88InsertCardDialogResult = {
  slot: number;
  slotState: CardSlotState;
};

/**
 * Reading a card image, in two steps on purpose.
 *
 * Picking a file and judging what is in it are separate concerns: the size rule
 * lives in the model, so the port only fetches and reports, and a test can
 * drive a rejected card without a file system.
 */
export type Z88CardFilePort = {
  // --- Resolves to undefined when the user dismisses the picker.
  pickCardFile(slot: number): Promise<string | undefined>;
  checkCard(path: string): Promise<Z88CardCheckResult>;
  notify(type: "info" | "error", title: string, message: string): Promise<void>;
};

export type Z88InsertCardClosePort = {
  inserted(result: Z88InsertCardDialogResult): void;
  dismissed(): void;
};

export type Z88InsertCardPorts = {
  machine: Z88MachinePort;
  cardFile: Z88CardFilePort;
  close: Z88InsertCardClosePort;
};

export const Z88_CARDS_FOLDER_SETTINGS_KEY = "z88CardsFolder";

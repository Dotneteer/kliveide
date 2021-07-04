/**
 * Available Z88 card slot states
 */
export type SlotContent = "empty" | "32K" | "128K" | "512K" | "1M" | "eprom";

export type SlotState = {
  content: SlotContent;
  epromFile?: string;
};

/**
 * Represents the Z88 card states
 */
export type Z88CardsState = {
  slot1: SlotState;
  slot2: SlotState;
  slot3: SlotState;
};

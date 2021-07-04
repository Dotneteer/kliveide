/**
 * Available Z88 card slot states
 */
export type SlotContent = "empty" | "32K" | "128K" | "512K" | "1M" | "eprom";

/**
 * State of a particular slot
 */
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

/**
 * The contents of a particular card in a Z88 slot
 */
export type CardContent = {
  ramSize?: number;
  eprom?: Uint8Array;
}

/**
 * Represents the construction options of Z88
 */
export type Cz88ContructionOptions = {
  sch?: number;
  scw?: number;
  firmware?: Uint8Array[];
  card1?: CardContent;
  card2?: CardContent;
  card3?: CardContent;
}


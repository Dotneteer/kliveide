import { IZ88MemoryCard } from "./IZ88MemoryCard";

/**
 * Represents information about a particular Z88 slot
 */
export type Z88PageInfo = {
  // --- The start offset of the slot in the 4MB memory space
  offset: number;

  // --- The bank mapped into the slot
  bank: number;

  // --- The object handling the memory access for the slot (through a memory card)
  // --- If empty, the slot is unavailable (random read values, no writes)
  handler?: IZ88MemoryCard;
};

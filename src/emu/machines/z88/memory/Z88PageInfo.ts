import { IZ88MemoryCard } from "./IZ88MemoryCard";

/**
 * Represents information about a particular Z88 8K page
 */
export type Z88PageInfo = {
  // --- The start offset of the 8K Page in the 4MB memory space
  offset: number;

  // --- The bank mapped into the 8k Page
  bank: number;

  // --- The object handling the memory access for the slot (through a memory card)
  // --- If empty, the slot is unavailable (random read values, no writes)
  handler?: IZ88MemoryCard;
};

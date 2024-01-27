/**
 * Represents a Z88 memory operations
 *
 * According to the 8K memory page organization, the read and write operations should mask the address
 * with 0x1fff. The memOffset shows the start offset of the memory card in the 4MB memory space, so,
 * you must read or write the byte at the [memOffset + (address & 0x1fff)] address.
 * Nonetheless, the operations accept the bank index and the full 16 bit address as well; a particular
 * memory card may use them.
 */
export interface IZ88MemoryOperation {
  /**
   * Reads the byte at the specified memory address
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @returns The read byte
   */
  readMemory(memOffset: number, bank: number, address: number): number;

  /**
   * Writes the specified data byte at the given 16-bit memory address
   * @param memOffset The start offset of the memory card in the 4MB memory space
   * @param bank The bank mapped into the page
   * @param address 16-bit memory address to read
   * @param data Byte to write
   */
  writeMemory(
    memOffset: number,
    bank: number,
    address: number,
    data: number
  ): void;
}

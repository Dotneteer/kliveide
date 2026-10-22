/**
 * Hardware abstraction layer. Implement this to emulate
 * a particular computer.
 */
export interface Hal {
    /**
     * Clock count.
     */
    tStateCount: number;

    /**
     * Read a byte of memory.
     */
    readMemory(address: number): number;

    /**
     * Write a byte to memory.
     */
    writeMemory(address: number, value: number): void;

    /**
     * Contend memory at an address.
     */
    contendMemory(address: number): void;

    /**
     * Read a byte from a port. Warning: Use only the lower byte of
     * the address. The upper byte may have data used for testing.
     */
    readPort(address: number): number;

    /**
     * Write a byte to a port. Warning: Use only the lower byte of
     * the address. The upper byte may have data used for testing.
     */
    writePort(address: number, value: number): void;

    /**
     * Contend a port address.
     */
    contendPort(address: number): void;
}

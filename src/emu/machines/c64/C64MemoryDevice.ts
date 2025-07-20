import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * This class represents the memory device of the Commodore 64 (C64) machine.
 * It handles the memory mapping, I/O operations, and ROM management for the C64.
 */
export class C64MemoryDevice implements IGenericDevice<IC64Machine> {
  /**
   * The Data Direction Register (DDR) for the C64 memory device.
   * This register controls the direction of data flow for the I/O ports.
   * Bit 0: Input/Output for port 0
   * Bit 1: Input/Output for port 1
   * Bit 2: Input/Output for port 2
   * Bit 3: Input/Output for port 3
   * Bit 4: Input/Output for port 4
   * Bit 5: Input/Output for port 5
   * Bit 6: Input/Output for port 6
   * Bit 7: Input/Output for port 7
   */
  private _ddr: number;

  /**
   * The port register for I/O operations.
   * This register is used to read and write data to/from the C64's I/O ports.
   * Bit 0: LORAM: Show BASIC ROM if set, or RAM if cleared
   * Bit 1: HIRAM: Show KERNAL ROM if set, or RAM if cleared
   * Bit 2: CHAREN: Show I/O devices if set, or character ROM if cleared
   * Bit 3: Casette motor control
   * Bit 4: Casette write
   * Bit 5: Casette sense
   * Bit 6: Unused
   * Bit 7: Unused
   */
  private _port: number; // Port register for I/O operations

  private _basicRom = new Uint8Array(0x2000); // 8KB BASIC ROM
  private _kernalRom = new Uint8Array(0x2000); // 8KB KERNAL ROM
  private _charRom = new Uint8Array(0x1000); // 4KB Character ROM
  private _ram = new Uint8Array(0x10000); // 64KB RAM
  private _colorRam = new Uint8Array(0x400); // 1KB Color RAM

  constructor(public readonly machine: IC64Machine) {}

  /**
   * Get the current value of the I/O port control register.
   * This register is used to control the behavior of I/O ports in the C64.
   */
  get ioPortControl(): number {
    return this._ddr;
  }

  /**
   * Set the value of the I/O port control register.
   * This register is used to control the behavior of I/O ports in the C64.
   * @param value The new value for the I/O port control register
   */
  set ioPortControl(value: number) {
    this._ddr = value & 0xff; // Ensure it's a byte value
  }

  /**
   * Reset the device to its initial state.
   */
  reset(): void {
    this._ddr = 0x2f;
    this._port = 0x37;
  }

  /**
   * Optional hard reset operation
   */
  hardReset?: () => void = () => {
    // Perform a full reset, including any hardware-specific logic
    this.reset();
    // Additional hard reset logic can be added here
  };

  /**
   * Dispose the resources held by the device
   */
  dispose(): void {
    // Clean up resources if necessary
    // For now, nothing to dispose
  }

  /**
   * Upload the BASIC ROM data.
   * @param data The new BASIC ROM data
   */
  uploadBasicRom(data: Uint8Array): void {
    if (data.length !== 0x2000) {
      throw new Error("BASIC ROM must be exactly 8KB in size.");
    }
    this._basicRom.set(data);
  }

  /**
   * Upload the KERNAL ROM data.
   * @param data The new KERNAL ROM data
   */
  uploadKernalRom(data: Uint8Array): void {
    if (data.length !== 0x2000) {
      throw new Error("KERNAL ROM must be exactly 8KB in size.");
    }
    this._kernalRom.set(data);
  }

  /**
   * Upload the Character ROM data.
   * @param data The new Character ROM data
   */
  uploadCharRom(data: Uint8Array): void {
    if (data.length !== 0x1000) {
      throw new Error("Character ROM must be exactly 4KB in size.");
    }
    this._charRom.set(data);
  }

  readMemory(addr: number): number {
    addr &= 0xffff;

    // First handle I/O port (6510)
    if (addr === 0x0000) return this._ddr;
    if (addr === 0x0001) {
      return (this._port & this._ddr) | (0x20 & ~this._ddr);
    }

    // Memory configuration via $01 & $00
    const cpuPort = (this._port & this._ddr) | (0xff & ~this._ddr);

    const LORAM = cpuPort & 0x01;
    const HIRAM = cpuPort & 0x02;
    const CHAREN = cpuPort & 0x04;

    // BASIC ROM ($A000–$BFFF)
    if (addr >= 0xa000 && addr <= 0xbfff) {
      if (LORAM && HIRAM) return this._basicRom[addr - 0xa000];
    }

    // I/O or CHAR ROM ($D000–$DFFF)
    if (addr >= 0xd000 && addr <= 0xdfff) {
      if (CHAREN) {
        // I/O area
        return this.readIo(addr);
      } else {
        return this._charRom[addr - 0xd000];
      }
    }

    // KERNAL ROM ($E000–$FFFF)
    if (addr >= 0xe000 && addr <= 0xffff) {
      if (HIRAM) return this._kernalRom[addr - 0xe000];
    }

    // Everything else: RAM
    return this._ram[addr];
  }

  readIo(addr: number): number {
    // Implement I/O read logic here
    return 0;
  }

  writeMemory(addr: number, value: number): void {
    addr &= 0xffff;
    value &= 0xff; // Ensure it's a byte value

    // Handle I/O port (6510)
    if (addr === 0x0000) {
      this._ddr = value;
      return;
    }
    if (addr === 0x0001) {
      this._port = value;
      return;
    }

    // Memory configuration via $01 & $00
    const cpuPort = (this._port & this._ddr) | (0xff & ~this._ddr);
    const CHAREN = cpuPort & 0x04;

    // I/O area ($D000-$DFFF)
    if (addr >= 0xd000 && addr <= 0xdfff) {
      if (CHAREN) {
        // Write to I/O devices
        this.writeIo(addr, value);
        return;
      }
      // Writing to Character ROM area maps to underlying RAM
    }

    // BASIC ROM ($A000-$BFFF) and KERNAL ROM ($E000-$FFFF)
    // Writing to ROM areas always affects the underlying RAM,
    // regardless of LORAM and HIRAM settings

    // Everything is written to RAM
    this._ram[addr] = value;
  }

  writeIo(_addr: number, _value: number): void {
    // Implement I/O write logic here
    // This will handle writes to VIC-II, SID, CIA, etc.
  }

  /**
   * Gets the CPU reset vector value from memory addresses $FFFC-$FFFD.
   * When the 6510 CPU resets, it loads the program counter from this vector.
   * @returns The 16-bit reset vector address
   */
  getResetVector(): number {
    // The reset vector is stored at $FFFC-$FFFD in little-endian format
    // Due to the memory mapping, we need to consider the HIRAM bit state
    // to determine if we should read from ROM or RAM

    const lowByte = this._kernalRom[0x1ffc]; // $FFFC - $E000
    const highByte = this._kernalRom[0x1ffd]; // $FFFD - $E000

    // Combine the bytes into a 16-bit address (little-endian)
    return lowByte | (highByte << 8);
  }
}

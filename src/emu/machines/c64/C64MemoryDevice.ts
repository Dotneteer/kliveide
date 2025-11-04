import { IGenericDevice } from "../../../emu/abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";
import { C64VicDevice } from "./vic/C64VicDevice";
import { C64SidDevice } from "./C64SidDevice";
import { C64Cia1Device } from "./C64Cia1Device";
import { C64Cia2Device } from "./C64Cia2Device";
import { C64CpuPortDevice } from "./C64CpuPortDevice";
import { C64IoExpansionDevice } from "./C64IoExpansionDevice";

/**
 * This class represents the memory device of the Commodore 64 (C64) machine.
 * It handles the memory mapping, I/O operations, and ROM management for the C64.
 */
export class C64MemoryDevice implements IGenericDevice<IC64Machine> {
  // --- Memory configuration and dispatch table referecnes
  private _readTable: ReadFunction[][] = []; // [config][page]
  private _writeTable: WriteFunction[][] = []; // [config][page]
  private _currentConfig: number;

  // --- Memory arrays references
  private _ram = new Uint8Array(0x10000); // 64KB RAM
  private _basicRom = new Uint8Array(0x2000); // 8KB BASIC ROM
  private _kernalRom = new Uint8Array(0x2000); // 8KB KERNAL ROM
  private _chargenRom = new Uint8Array(0x1000); // 4KB Character ROM
  private _colorRam = new Uint8Array(0x400); // 1KB Color RAM

  // --- Memory paging flags
  private _loram: boolean = false; // BASIC ROM visible
  private _hiram: boolean = false; // KERNAL ROM visible
  private _chargen: boolean = false; // Character ROM visible

  // --- Device references
  private _port: C64CpuPortDevice;
  private _vic: C64VicDevice;
  private _sid: C64SidDevice;
  private _cia1: C64Cia1Device;
  private _cia2: C64Cia2Device;
  private _ioExtDevice: C64IoExpansionDevice;

  /**
   * Creates an instance of the C64MemoryDevice.
   * @param machine The C64 machine instance
   */
  constructor(public readonly machine: IC64Machine) {
    this._port = machine.cpuPortDevice;
    this._vic = machine.vicDevice;
    this._sid = machine.sidDevice;
    this._cia1 = machine.cia1Device;
    this._cia2 = machine.cia2Device;
    this._ioExtDevice = machine.ioExpansionDevice;

    // --- Memory access uses dispatch tables
    this.initializeDispatchTables();

    // --- Initialize with default configuration
    this._currentConfig = 0;
    this.updateConfiguration();
  }

  /**
   * Reset the device to its initial state.
   */
  reset(): void {
    // Reset memory configuration based on CPU port state
    this.updateConfiguration();
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
   * Gets the current state of the BASIC ROM visibility
   */
  get loram(): boolean {
    return this._loram;
  }

  /**
   * Gets the current state of the KERNAL ROM visibility
   */
  get hiram(): boolean {
    return this._hiram;
  }

  /**
   * Gets the current state of the Character ROM visibility
   */
  get chargen(): boolean {
    return this._chargen;
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
  uploadChargenRom(data: Uint8Array): void {
    if (data.length !== 0x1000) {
      throw new Error("Character ROM must be exactly 4KB in size.");
    }
    this._chargenRom.set(data);
  }

  /**
   * Gets the 64KB flat memory representation.
   * @returns A Uint8Array representing the 64KB flat memory
   */
  get64KFlatMemory(): Uint8Array {
    const flatMemory = new Uint8Array(65536);

    // --- RAM between 0x0000-0x9fff
    flatMemory.set(this._ram.slice(0x0000, 0xa000), 0x0000);

    // --- RAM/BASIC ROM between 0xa000-0xbfff
    if (this._loram) {
      flatMemory.set(this._basicRom, 0xa000);
    } else {
      flatMemory.set(this._ram.slice(0xa000, 0xc000), 0xa000);
    }

    // --- IO RAM/CHARACTER ROM between 0xd000-0xdfff
    if (!this._chargen) {
      flatMemory.set(this._chargenRom, 0xd000);
    } else {
      flatMemory.set(this.machine.vicDevice.getFlatMemory(), 0xd000);
      flatMemory.set(this._sid.getFlatMemory(), 0xd400);
      flatMemory.set(this._colorRam, 0xd800);
      flatMemory.set(this._cia1.getFlatMemory(), 0xdc00);
      flatMemory.set(this._cia2.getFlatMemory(), 0xdd00);
    }

    // --- RAM/KERNAL ROM between 0xe000-0xffff
    if (this._hiram) {
      flatMemory.set(this._kernalRom, 0xe000);
    } else {
      flatMemory.set(this._ram.slice(0xe000), 0xe000);
    }

    // --- Done.
    return flatMemory;
  }

  /**
   * Gets the current memory configuration.
   */
  get currentConfig(): number {
    return this._currentConfig;
  }

  /**
   * Read a byte from memory.
   * @param address The memory address to read from
   * @returns The byte value read from memory
   */
  readMemory(address: number): number {
    address &= 0xffff;
    const page = address >>> 8;
    return this._readTable[this._currentConfig][page](address);
  }

  /**
   * Write a byte to memory.
   * @param address The memory address to write to
   * @param value The byte value to write
   */
  writeMemory(address: number, value: number): void {
    address &= 0xffff;
    const page = address >>> 8;
    this._writeTable[this._currentConfig][page](address, value);
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

  /**
   * Update the memory configuration based on the CPU port and cartridge lines.
   */
  updateConfiguration(): void {
    // Calculate new configuration
    this._currentConfig =
      ((~this._port.readDirection() | this._port.readData()) & 0x7) |
      (this._ioExtDevice.exromLine ? 0x08 : 0) |
      (this._ioExtDevice.gameLine ? 0x10 : 0);

    // Update the configuration flags based on the new configuration
    this._loram = (this._currentConfig & 0x01) !== 0;
    this._hiram = (this._currentConfig & 0x02) !== 0;
    this._chargen = (this._currentConfig & 0x04) !== 0;
  }

  /**
   * Initializes the dispatch tables
   *
   * - Bit 0 (LORAM): Controls BASIC ROM visibility
   * - Bit 1 (HIRAM): Controls KERNAL ROM visibility
   * - Bit 2 (CHAREN): Controls Character ROM vs I/O area
   * - Bit 3 (/EXROM): Activates cartridge mapping in $8000–$9FFF (ROML)
   * - Bit 4 (/GAME):  Activates cartridge mapping in $A000–$BFFF (ROML)
   */
  private initializeDispatchTables(): void {
    // Initialize read table [32 configs][256 pages]
    this._readTable = [];
    for (let config = 0; config < 0x20; config++) {
      // --- Initialize the read & write tables for the config
      this._readTable[config] = [];
      this._writeTable[config] = [];

      // --- Calculate the configuration flags
      this._loram = (config & 0x01) !== 0;
      this._hiram = (config & 0x02) !== 0;
      this._chargen = (config & 0x04) !== 0;
      const exrom = (config & 0x08) !== 0;
      const game = (config & 0x10) !== 0;

      // --- Zero page
      this._readTable[config][0x00] = this.zeroPageRead.bind(this);
      this._writeTable[config][0x00] = this.zeroPageWrite.bind(this);

      // --- Pages 0x01-0xff: Default is RAM
      for (let page = 0x01; page <= 0xff; page++) {
        this._readTable[config][page] = this.ramRead.bind(this);
        this._writeTable[config][page] = this.ramWrite.bind(this);
      }

      // --- Page in the BASIC ROM when LORAM is enabled
      if (this._loram) {
        for (let page = 0xa0; page <= 0xbf; page++) {
          this._readTable[config][page] = this.basicRomRead.bind(this);
        }
      }

      // --- Page in the KERNAL ROM when HIRAM is enabled
      if (this._hiram) {
        for (let page = 0xe0; page <= 0xff; page++) {
          this._readTable[config][page] = this.kernalRomRead.bind(this);
        }
      }

      // --- Page in the Character ROM when CHAREN is enabled
      if (this._chargen) {
        // --- I/O area visible
        // $D000-$D3FF: VIC-II registers (mirrored every $40 bytes)
        for (let page = 0xd0; page <= 0xd3; page++) {
          this._readTable[config][page] = this.viciiRead.bind(this);
        }

        // $D400-$D7FF: SID registers (mirrored every $20 bytes)
        for (let page = 0xd4; page <= 0xd7; page++) {
          this._readTable[config][page] = this.sidRead.bind(this);
        }

        // $D800-$DBFF: Color RAM
        for (let page = 0xd8; page <= 0xdb; page++) {
          this._readTable[config][page] = this.colorRamRead.bind(this);
        }

        // $DC00-$DCFF: CIA1
        this._readTable[config][0xdc] = this.cia1Read.bind(this);

        // $DE00-$DEFF: CIA2
        this._readTable[config][0xde] = this.cia2Read.bind(this);
      } else {
        for (let page = 0xd0; page <= 0xdf; page++) {
          this._readTable[config][page] = this.chargenRomRead.bind(this);
        }
      }

      // --- Handle extension ROMs
      if (game && !exrom) {
        // --- 8k EXROM mode
        for (let page = 0x80; page <= 0x9f; page++) {
          this._readTable[config][page] = this.cartridgeRomlRead.bind(this);
        }
      } else if (!game && exrom) {
        // --- Ultimax mode
        for (let page = 0xa0; page <= 0xbf; page++) {
          this._readTable[config][page] = this.cartridgeRomhRead.bind(this);
        }
      } else if (!game && !exrom) {
        // --- 16k cartridge mode
        for (let page = 0x80; page <= 0x9f; page++) {
          this._readTable[config][page] = this.cartridgeRomlRead.bind(this);
        }
        for (let page = 0xa0; page <= 0xbf; page++) {
          this._readTable[config][page] = this.cartridgeRomhRead.bind(this);
        }
      }

      // --- Now, set up the write table for the I/O areas
      // $D000-$D3FF: VIC-II registers
      for (let page = 0xd0; page <= 0xd3; page++) {
        this._writeTable[config][page] = this.viciiWrite.bind(this);
      }

      // $D400-$D7FF: SID registers
      for (let page = 0xd4; page <= 0xd7; page++) {
        this._writeTable[config][page] = this.sidWrite.bind(this);
      }

      // $D800-$DBFF: Color RAM
      for (let page = 0xd8; page <= 0xdb; page++) {
        this._writeTable[config][page] = this.colorRamWrite.bind(this);
      }

      // $DC00-$DCFF: CIA1
      this._writeTable[config][0xdc] = this.cia1Write.bind(this);

      // $DE00-$DEFF: CIA2 (also handles VIC-II bank switching)
      this._writeTable[config][0xde] = this.cia2Write.bind(this);
    }
  }

  private readCpuPortDirection(): number {
    return this.machine.cpuPortDevice.readDirection();
  }

  private readCpuPortData(): number {
    return this.machine.cpuPortDevice.readData();
  }

  private writeCpuPortDirection(value: number): void {
    this._port.writeDirection(value);
    this.updateConfiguration();
  }

  private writeCpuPortData(value: number): void {
    this._port.writeData(value);
    this.updateConfiguration();
  }

  // Read function implementations
  private ramRead(address: number): number {
    return this._ram[address];
  }

  private zeroPageRead(address: number): number {
    const offset = address & 0xff;
    if (offset === 0x00) {
      return this.readCpuPortDirection();
    } else if (offset === 0x01) {
      return this.readCpuPortData();
    }
    return this._ram[address];
  }

  private basicRomRead(address: number): number {
    const offset = address & 0x1fff;
    return this._basicRom[offset];
  }

  private kernalRomRead(address: number): number {
    const offset = address & 0x1fff;
    return this._kernalRom[offset];
  }

  private chargenRomRead(address: number): number {
    const offset = address & 0x0fff;
    return this._chargenRom[offset];
  }

  private colorRamRead(address: number): number {
    const colorValue = this._colorRam[address & 0x3ff];
    const phi1Data = this._vic.readPhi1Data();
    return colorValue | (phi1Data & 0xf0);
  }

  private viciiRead(address: number): number {
    return this._vic.readRegister(address & 0x3f); // VIC-II registers repeat every $40 bytes
  }

  private sidRead(address: number): number {
    return this._sid.readRegister(address & 0x1f); // SID registers repeat every $20 bytes
  }

  private cia1Read(address: number): number {
    return this._cia1.readRegister(address & 0x0f); // CIA registers repeat every $10 bytes
  }

  private cia2Read(address: number): number {
    return this._cia2.readRegister(address & 0x0f);
  }

  private cartridgeRomlRead(_address: number): number {
    // Cartridge ROM Low ($8000-$9FFF)
    // TODO: Implement this method later
    return 0xff;
  }

  private cartridgeRomhRead(_address: number): number {
    // Cartridge ROM High ($A000-$BFFF or $E000-$FFFF in Ultimax)
    // TODO: Implement this method later
    return 0xff;
  }

  // Write function implementations
  private ramWrite(address: number, value: number): void {
    this._ram[address] = value;
  }

  private zeroPageWrite(address: number, value: number): void {
    const offset = address & 0xff;
    if (offset === 0x00) {
      this.writeCpuPortDirection(value);
    } else if (offset === 0x01) {
      this.writeCpuPortData(value);
    } else {
      this._ram[address] = value;
    }
  }

  private colorRamWrite(address: number, value: number): void {
    this._colorRam[address & 0x3ff] = value & 0x0f; // Only lower 4 bits stored
  }

  private viciiWrite(address: number, value: number): void {
    this._vic.writeRegister(address & 0x3f, value);
  }

  private sidWrite(address: number, value: number): void {
    this._sid.writeRegister(address & 0x1f, value);
  }

  private cia1Write(address: number, value: number): void {
    this._cia1.writeRegister(address & 0x0f, value);
  }

  private cia2Write(address: number, value: number): void {
    this._cia2.writeRegister(address & 0x0f, value);

    // CIA2 Port A bits 0-1 control VIC-II bank
    if ((address & 0x0f) === 0x00) {
      // CIA2 Port A
      const newVBank = 3 - (value & 0x03); // Inverted: 00=bank3, 01=bank2, 10=bank1, 11=bank0
      this._vic.setBaseBank(newVBank);
    }
  }
}

export type ReadFunction = (address: number) => number;
export type WriteFunction = (address: number, value: number) => void;

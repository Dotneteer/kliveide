import { IGenericDevice } from "@emu/abstractions/IGenericDevice";
import { IC64Machine } from "./IC64Machine";
import { C64VicDevice } from "./C64VicDevice";
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
  private _configurations: MemoryConfiguration[] = [];
  private _readTable: ReadFunction[][] = []; // [config][page]
  private _writeTable: WriteFunction[][][] = []; // [vbank][config][page]
  private _currentConfig: number;
  private _currentVBank: number;

  // --- Memory arrays references
  private _ram = new Uint8Array(0x10000); // 64KB RAM
  private _basicRom = new Uint8Array(0x2000); // 8KB BASIC ROM
  private _kernalRom = new Uint8Array(0x2000); // 8KB KERNAL ROM
  private _chargenRom = new Uint8Array(0x1000); // 4KB Character ROM
  private _colorRam = new Uint8Array(0x400); // 1KB Color RAM

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
    
    // Initialize with default configuration
    this._currentConfig = 0;
    this._currentVBank = 0;

    this.initializeConfigurations();
    this.initializeDispatchTables();
    
    // Set initial configuration
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
    this._writeTable[this._currentVBank][this._currentConfig][page](address, value);
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
      (this._ioExtDevice.exromLine ? 8 : 0) |
      (this._ioExtDevice.gameLine ? 16 : 0);
  }

  /**-
   * Initializes the memory configurations for the C64.
   * This sets up the various memory mapping options based on the VICE emulator's PLA logic.
   * Configuration format:
   * GAME(bit4) | EXROM(bit3) | CHAREN(bit2) | HIRAM(bit1) | LORAM(bit0)
   */
  private initializeConfigurations(): void {
    for (let config = 0; config < 32; config++) {
      const loram = (config & 0x01) !== 0;
      const hiram = (config & 0x02) !== 0;
      const charen = (config & 0x04) !== 0;
      const exrom = (config & 0x08) === 0; // Note: EXROM is inverted in config
      const game = (config & 0x10) === 0; // Note: GAME is inverted in config

      this._configurations[config] = this.createConfiguration(loram, hiram, charen, exrom, game);
    }
  }

  /**
   * Initializes the dispatch tables
   */
  private initializeDispatchTables(): void {
    // Initialize read table [32 configs][257 pages]
    this._readTable = new Array(32);
    for (let config = 0; config < 32; config++) {
      this._readTable[config] = new Array(257);
      this.setupReadTable(config);
    }

    // Initialize write table [4 VIC banks][32 configs][257 pages]
    this._writeTable = new Array(4);
    for (let vbank = 0; vbank < 4; vbank++) {
      this._writeTable[vbank] = new Array(32);
      for (let config = 0; config < 32; config++) {
        this._writeTable[vbank][config] = new Array(257);
        this.setupWriteTable(vbank, config);
      }
    }
  }

  /**
   * Sets up the read table for a specific memory configuration.
   * @param config The memory configuration to set up
   */
  private setupReadTable(config: number): void {
    const loram = (config & 0x01) !== 0;
    const hiram = (config & 0x02) !== 0;
    const charen = (config & 0x04) !== 0;
    const exrom = (config & 0x08) === 0;
    const game = (config & 0x10) === 0;

    // Default all pages to RAM
    for (let page = 0; page <= 0x100; page++) {
      this._readTable[config][page] = this.ramRead.bind(this);
    }

    // Page 0: Zero page with CPU port
    this._readTable[config][0x00] = this.zeroPageRead.bind(this);

    // Pages $10-$7F: Always RAM (pages $1000-$7FFF)
    // Already set to RAM above

    // Pages $80-$9F: $8000-$9FFF area
    if (!game && !exrom) {
      // 16K cartridge mode - ROML visible
      for (let page = 0x80; page <= 0x9f; page++) {
        this._readTable[config][page] = this.cartridgeRomlRead.bind(this);
      }
    } else if (game && !exrom) {
      // 8K cartridge mode - ROML visible
      for (let page = 0x80; page <= 0x9f; page++) {
        this._readTable[config][page] = this.cartridgeRomlRead.bind(this);
      }
    } else if (!game && exrom) {
      // Ultimax mode - ROML visible
      for (let page = 0x80; page <= 0x9f; page++) {
        this._readTable[config][page] = this.cartridgeRomlRead.bind(this);
      }
    }
    // Otherwise remains RAM

    // Pages $A0-$BF: $A000-$BFFF area
    if (!game && !exrom) {
      // 16K cartridge mode - ROMH visible
      for (let page = 0xa0; page <= 0xbf; page++) {
        this._readTable[config][page] = this.cartridgeRomhRead.bind(this);
      }
    } else if (game && !exrom && hiram) {
      // 8K cartridge mode with HIRAM - ROMH visible
      for (let page = 0xa0; page <= 0xbf; page++) {
        this._readTable[config][page] = this.cartridgeRomhRead.bind(this);
      }
    } else if (game && exrom && loram && hiram) {
      // Normal C64 mode with BASIC ROM
      for (let page = 0xa0; page <= 0xbf; page++) {
        this._readTable[config][page] = this.basicRomRead.bind(this);
      }
    }
    // Otherwise remains RAM

    // Pages $D0-$DF: $D000-$DFFF area
    if (charen && (hiram || !game)) {
      // Character ROM visible
      for (let page = 0xd0; page <= 0xdf; page++) {
        this._readTable[config][page] = this.chargenRomRead.bind(this);
      }
    } else if (!charen && (hiram || !game)) {
      // I/O area visible
      this.setupIOReadPages(config);
    }
    // Otherwise remains RAM

    // Pages $E0-$FF: $E000-$FFFF area
    if (!game && exrom) {
      // Ultimax mode - ROMH visible
      for (let page = 0xe0; page <= 0xff; page++) {
        this._readTable[config][page] = this.cartridgeRomhRead.bind(this);
      }
    } else if (hiram && (game || !exrom)) {
      // KERNAL ROM visible
      for (let page = 0xe0; page <= 0xff; page++) {
        this._readTable[config][page] = this.kernalRomRead.bind(this);
      }
    }
    // Otherwise remains RAM

    // Page $100: Mirror of page $00 for optimization
    this._readTable[config][0x100] = this._readTable[config][0x00];
  }

  /**
   * Sets up the I/O read pages for a specific memory configuration.
   * @param config The memory configuration to set up
   */
  private setupIOReadPages(config: number): void {
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

    // $DD00-$DDFF: CIA2
    this._readTable[config][0xdd] = this.cia2Read.bind(this);

    // $DE00-$DEFF: I/O expansion area 1
    this._readTable[config][0xde] = this.io1Read.bind(this);

    // $DF00-$DFFF: I/O expansion area 2
    this._readTable[config][0xdf] = this.io2Read.bind(this);
  }

  /**
   * Sets up the write table for a specific memory configuration.
   * @param vbank The video bank to set up
   * @param config The memory configuration to set up
   */
  private setupWriteTable(vbank: number, config: number): void {
    const hiram = (config & 0x02) !== 0;
    const charen = (config & 0x04) !== 0;
    const exrom = (config & 0x08) === 0;
    const game = (config & 0x10) === 0;

    // Default all pages to RAM write
    for (let page = 0; page <= 0x100; page++) {
      this._writeTable[vbank][config][page] = this.ramWrite.bind(this);
    }

    // Page 0: Zero page with CPU port
    this._writeTable[vbank][config][0x00] = this.zeroPageWrite.bind(this);

    // Pages $10-$7F: Always RAM
    // Already set above

    // Pages $80-$9F: $8000-$9FFF area
    // Cartridge areas may have special write handling
    if (!game && !exrom) {
      // 16K cartridge - may have special write handling
      for (let page = 0x80; page <= 0x9f; page++) {
        this._writeTable[vbank][config][page] = this.cartridgeRomlWrite.bind(this);
      }
    } else if (game && !exrom) {
      // 8K cartridge - may have special write handling
      for (let page = 0x80; page <= 0x9f; page++) {
        this._writeTable[vbank][config][page] = this.cartridgeRomlWrite.bind(this);
      }
    }
    // Note: Writes to ROM areas typically go to underlying RAM

    // Pages $A0-$BF: $A000-$BFFF area
    if (!game && !exrom) {
      // 16K cartridge - may have special write handling
      for (let page = 0xa0; page <= 0xbf; page++) {
        this._writeTable[vbank][config][page] = this.cartridgeRomhWrite.bind(this);
      }
    } else if (game && !exrom && hiram) {
      // 8K cartridge mode - may have special write handling
      for (let page = 0xa0; page <= 0xbf; page++) {
        this._writeTable[vbank][config][page] = this.cartridgeRomhWrite.bind(this);
      }
    }
    // BASIC ROM writes go to underlying RAM (default RAM write)

    // Pages $D0-$DF: $D000-$DFFF area
    if (!charen && (hiram || !game)) {
      // I/O area visible
      this.setupIOWritePages(vbank, config);
    }
    // Character ROM and RAM writes use default RAM write

    // Pages $E0-$FF: $E000-$FFFF area
    // KERNAL ROM writes go to underlying RAM (default RAM write)
    // Cartridge ROM writes may have special handling
    if (!game && exrom) {
      // Ultimax mode - may have special write handling
      for (let page = 0xe0; page <= 0xff; page++) {
        this._writeTable[vbank][config][page] = this.cartridgeRomhWrite.bind(this);
      }
    }

    // Page $100: Mirror of page $00
    this._writeTable[vbank][config][0x100] = this._writeTable[vbank][config][0x00];
  }

  private setupIOWritePages(vbank: number, config: number): void {
    // $D000-$D3FF: VIC-II registers
    for (let page = 0xd0; page <= 0xd3; page++) {
      this._writeTable[vbank][config][page] = this.viciiWrite.bind(this);
    }

    // $D400-$D7FF: SID registers
    for (let page = 0xd4; page <= 0xd7; page++) {
      this._writeTable[vbank][config][page] = this.sidWrite.bind(this);
    }

    // $D800-$DBFF: Color RAM
    for (let page = 0xd8; page <= 0xdb; page++) {
      this._writeTable[vbank][config][page] = this.colorRamWrite.bind(this);
    }

    // $DC00-$DCFF: CIA1
    this._writeTable[vbank][config][0xdc] = this.cia1Write.bind(this);

    // $DD00-$DDFF: CIA2 (also handles VIC-II bank switching)
    this._writeTable[vbank][config][0xdd] = this.cia2Write.bind(this);

    // $DE00-$DEFF: I/O expansion area 1
    this._writeTable[vbank][config][0xde] = this.io1Write.bind(this);

    // $DF00-$DFFF: I/O expansion area 2
    this._writeTable[vbank][config][0xdf] = this.io2Write.bind(this);
  }

  /**
   * Creates a memory configuration based on the provided parameters.
   * This method sets up the visibility of ROMs, I/O, and cartridge areas based on the C64's memory mapping logic.
   * @param loram Low RAM visible (LORAM)
   * @param hiram High RAM visible (HIRAM)
   * @param charen Character ROM visible (CHAREN)
   * @param exrom EXROM line state
   * @param game GAME line state
   * @returns The created MemoryConfiguration object
   */
  private createConfiguration(
    loram: boolean,
    hiram: boolean,
    charen: boolean,
    exrom: boolean,
    game: boolean
  ): MemoryConfiguration {
    // --- Default configuration - all RAM
    let config: MemoryConfiguration = {
      basicRomVisible: false,
      kernalRomVisible: false,
      chargenVisible: false,
      ioVisible: false,
      cartridgeRomlVisible: false,
      cartridgeRomhVisible: false
    };

    // --- Handle cartridge modes first (GAME=0 or EXROM=0)
    if (!game && !exrom) {
      // --- 16K Game cartridge mode (GAME=0, EXROM=0)
      config.cartridgeRomlVisible = true;
      config.cartridgeRomhVisible = true;
      config.ioVisible = !charen;
      config.chargenVisible = charen;
      config.kernalRomVisible = hiram;
    } else if (!game && exrom) {
      // --- Ultimax mode (GAME=0, EXROM=1)
      config.cartridgeRomlVisible = true;
      config.cartridgeRomhVisible = true;
      config.ioVisible = true;
      // --- In Ultimax mode, most of memory is unmapped except cartridge areas
    } else if (game && !exrom) {
      // --- 8K Game cartridge mode (GAME=1, EXROM=0)
      config.cartridgeRomlVisible = true;
      if (hiram) {
        config.cartridgeRomhVisible = true;
      }
      config.ioVisible = !charen;
      config.chargenVisible = charen;
      config.kernalRomVisible = hiram;
    } else {
      // --- Normal C64 mode (GAME=1, EXROM=1) - no cartridge interference
      config.basicRomVisible = loram && hiram;
      config.kernalRomVisible = hiram;
      config.ioVisible = !charen;
      config.chargenVisible = charen;
    }

    // --- Done.
    return config;
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
    const offset = address - 0xa000;
    return this._basicRom[offset];
  }

  private kernalRomRead(address: number): number {
    const offset = address - 0xe000;
    return this._kernalRom[offset];
  }

  private chargenRomRead(address: number): number {
    const offset = address - 0xd000;
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

  private io1Read(address: number): number {
    // I/O expansion area 1 ($DE00-$DEFF)
    // Default to open bus or cartridge handling
    return 0xff; // Placeholder - would delegate to cartridge
  }

  private io2Read(address: number): number {
    // I/O expansion area 2 ($DF00-$DFFF)
    // Default to open bus or cartridge handling
    return 0xff; // Placeholder - would delegate to cartridge
  }

  private cartridgeRomlRead(address: number): number {
    // Cartridge ROM Low ($8000-$9FFF)
    // Placeholder - would delegate to cartridge implementation
    return 0xff;
  }

  private cartridgeRomhRead(address: number): number {
    // Cartridge ROM High ($A000-$BFFF or $E000-$FFFF in Ultimax)
    // Placeholder - would delegate to cartridge implementation
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

  private io1Write(address: number, value: number): void {
    // I/O expansion area 1 ($DE00-$DEFF)
    // Placeholder - would delegate to cartridge
  }

  private io2Write(address: number, value: number): void {
    // I/O expansion area 2 ($DF00-$DFFF)
    // Placeholder - would delegate to cartridge
  }

  private cartridgeRomlWrite(address: number, value: number): void {
    // Cartridge ROM Low writes - typically go to underlying RAM
    // Some cartridges (like DQBB) may intercept writes
    this._ram[address] = value; // Default: write to underlying RAM
  }

  private cartridgeRomhWrite(address: number, value: number): void {
    // Cartridge ROM High writes - typically go to underlying RAM
    this._ram[address] = value; // Default: write to underlying RAM
  }
}

export type ReadFunction = (address: number) => number;
export type WriteFunction = (address: number, value: number) => void;

/**
 * This type represents the memory configuration for the C64.
 */
type MemoryConfiguration = {
  basicRomVisible: boolean;
  kernalRomVisible: boolean;
  chargenVisible: boolean;
  ioVisible: boolean;
  cartridgeRomlVisible: boolean;
  cartridgeRomhVisible: boolean;
};

import { AssemblerOutput } from "@main/compiler-common/assembler-in-out";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * NEX file format writer for ZX Spectrum Next.
 * Implements NEX V1.2 specification.
 * 
 * NEX file structure:
 * - Header (512 bytes)
 * - Palette (512 bytes, optional)
 * - Screens (variable size, optional)
 * - Copper code (max 2048 bytes, optional)
 * - Banks (16384 bytes each, in specific order)
 */
export class NexFileWriter {
  private header: Uint8Array;
  private palette?: Uint8Array;
  private screens: Map<string, Uint8Array>;
  private copper?: Uint8Array;
  private banks: Map<number, Uint8Array>;

  constructor() {
    this.header = new Uint8Array(512);
    this.screens = new Map();
    this.banks = new Map();
    this.initializeHeader();
  }

  /**
   * Initialize NEX header with signature and version.
   */
  private initializeHeader(): void {
    // Write "Next" signature (bytes 0-3)
    this.header[0] = 0x4e; // 'N'
    this.header[1] = 0x65; // 'e'
    this.header[2] = 0x78; // 'x'
    this.header[3] = 0x74; // 't'

    // Write version "V1.2" (bytes 4-7)
    this.header[4] = 0x56; // 'V'
    this.header[5] = 0x31; // '1'
    this.header[6] = 0x2e; // '.'
    this.header[7] = 0x32; // '2'
  }

  /**
   * Set RAM requirement (768K or 1792K).
   * @param ramSize - 768 or 1792
   */
  setRamRequirement(ramSize: number): void {
    this.header[8] = ramSize === 1792 ? 1 : 0;
  }

  /**
   * Set border color (0-7).
   * @param color - Border color
   */
  setBorderColor(color: number): void {
    this.header[11] = color & 0x07;
  }

  /**
   * Set stack pointer value.
   * @param sp - Stack pointer address
   */
  setStackPointer(sp: number): void {
    this.header[12] = sp & 0xff;
    this.header[13] = (sp >> 8) & 0xff;
  }

  /**
   * Set program counter (entry point). 0 = load only, don't run.
   * @param pc - Program counter address
   */
  setProgramCounter(pc: number): void {
    this.header[14] = pc & 0xff;
    this.header[15] = (pc >> 8) & 0xff;
  }

  /**
   * Set required core version.
   * @param major - Major version (0-255)
   * @param minor - Minor version (0-255)
   * @param subminor - Subminor version (0-255)
   */
  setCoreVersion(major: number, minor: number, subminor: number): void {
    this.header[135] = major & 0xff;
    this.header[136] = minor & 0xff;
    this.header[137] = subminor & 0xff;
  }

  /**
   * Configure loading bar.
   * @param enabled - Show loading bar
   * @param color - Bar color (0-255)
   * @param delay - Delay per bar step (frames)
   * @param startDelay - Initial delay (frames)
   */
  setLoadingBar(
    enabled: boolean,
    color: number,
    delay: number,
    startDelay: number
  ): void {
    this.header[130] = enabled ? 1 : 0;
    this.header[131] = color & 0xff;
    this.header[132] = delay & 0xff;
    this.header[133] = startDelay & 0xff;
  }

  /**
   * Set preserve Next registers flag.
   * @param preserve - true = preserve, false = reset
   */
  setPreserveNextRegs(preserve: boolean): void {
    this.header[134] = preserve ? 1 : 0;
  }

  /**
   * Set entry bank (mapped to slot 3 on start).
   * @param bank - Bank number (0-111)
   */
  setEntryBank(bank: number): void {
    this.header[139] = bank & 0xff;
  }

  /**
   * Set file handle address. 0 = close file, 1 = pass handle in BC (recommended), 0x4000+ = write to memory address.
   * @param address - Address to store file handle, or special value
   */
  setFileHandle(address: number): void {
    this.header[140] = address & 0xff;
    this.header[141] = (address >> 8) & 0xff;
  }

  /**
   * Add a bank with data. Data will be padded to 16KB.
   * @param bankNo - Bank number (0-111)
   * @param data - Bank data (max 16384 bytes)
   */
  addBank(bankNo: number, data: Uint8Array): void {
    if (bankNo < 0 || bankNo > 111) {
      throw new Error(`Invalid bank number: ${bankNo} (must be 0-111)`);
    }
    if (data.length > 16384) {
      throw new Error(`Bank ${bankNo} data too large: ${data.length} bytes (max 16384)`);
    }

    // Pad to 16KB
    const paddedData = new Uint8Array(16384);
    paddedData.set(data);
    this.banks.set(bankNo, paddedData);

    // Mark bank as present in header (bytes 18-129)
    // Each bank uses one byte in the array (0/1 flag), not a bitmask
    this.header[18 + bankNo] = 1;
  }

  /**
   * Add a loading screen.
   * @param type - Screen type
   * @param data - Screen data
   */
  addScreen(type: string, data: Uint8Array): void {
    this.validateScreenData(type, data);
    this.screens.set(type, data);
    this.updateScreenFlags();
  }

  /**
   * Validate screen data size.
   */
  private validateScreenData(type: string, data: Uint8Array): void {
    const expectedSizes: Record<string, number> = {
      layer2: 49152, // 256x192x8
      ula: 6912, // 32x24 chars + attrs
      lores: 12288, // 128x96x8
      "hires-mono": 12288, // 512x192 mono
      "hires-color": 12288, // 8x1 color attrs
      layer2_320: 81920, // 320x256x8
      layer2_640: 81920, // 640x256x4
    };

    const expected = expectedSizes[type];
    if (expected && data.length !== expected) {
      throw new Error(
        `Invalid screen data size for ${type}: ${data.length} bytes (expected ${expected})`
      );
    }
  }

  /**
   * Set palette data (512 bytes).
   * @param data - Palette data
   */
  setPalette(data: Uint8Array): void {
    if (data.length !== 512) {
      throw new Error(`Palette must be 512 bytes, got ${data.length}`);
    }
    this.palette = data;
  }

  /**
   * Set copper code (max 2048 bytes).
   * @param data - Copper code
   */
  setCopper(data: Uint8Array): void {
    if (data.length > 2048) {
      throw new Error(
        `Copper code too large: ${data.length} bytes (max 2048)`
      );
    }
    this.copper = data;
  }

  /**
   * Update loading screen flags in header.
   */
  private updateScreenFlags(): void {
    let flags = 0;
    
    // Bit 0: Layer2 present
    if (this.screens.has("layer2")) flags |= 0x01;
    
    // Bit 1: ULA screen present
    if (this.screens.has("ula")) flags |= 0x02;
    
    // Bit 2: LoRes screen present
    if (this.screens.has("lores")) flags |= 0x04;
    
    // Bit 3: HiRes screen present
    if (this.screens.has("hires-mono") || this.screens.has("hires-color")) {
      flags |= 0x08;
    }
    
    // Bit 4: HiColor present
    if (this.screens.has("hires-color")) flags |= 0x10;
    
    // Bit 6: Layer2 320x256 or 640x256
    if (this.screens.has("layer2_320") || this.screens.has("layer2_640")) {
      flags |= 0x40;
    }
    
    // Bit 7: No palette (inverted logic - 0 = palette present)
    if (!this.palette) {
      flags |= 0x80;
    }
    
    this.header[10] = flags;
  }

  /**
   * Finalize header before writing.
   */
  private finalizeHeader(): void {
    // Update number of banks (byte 9)
    this.header[9] = this.banks.size;
    
    // Update screen flags
    this.updateScreenFlags();
  }

  /**
   * Write complete NEX file.
   * @returns NEX file as byte array
   */
  write(): Uint8Array {
    this.finalizeHeader();
    
    const parts: Uint8Array[] = [];

    // 1. Header (512 bytes, always present)
    parts.push(this.header);

    // 2. Palette (512 bytes, if present and not marked as "no palette")
    if (this.palette && !(this.header[10] & 0x80)) {
      parts.push(this.palette);
    }

    // 3. Screens in order (if present)
    if (this.screens.has("layer2")) {
      parts.push(this.screens.get("layer2")!);
    }
    if (this.screens.has("ula")) {
      parts.push(this.screens.get("ula")!);
    }
    if (this.screens.has("lores")) {
      parts.push(this.screens.get("lores")!);
    }
    if (this.screens.has("hires-mono")) {
      parts.push(this.screens.get("hires-mono")!);
    }
    if (this.screens.has("hires-color")) {
      parts.push(this.screens.get("hires-color")!);
    }
    if (this.screens.has("layer2_320")) {
      parts.push(this.screens.get("layer2_320")!);
    } else if (this.screens.has("layer2_640")) {
      parts.push(this.screens.get("layer2_640")!);
    }

    // 4. Copper code (if present)
    if (this.copper) {
      parts.push(this.copper);
    }

    // 5. Banks in required order: 5,2,0,1,3,4,6,7,8,9,...,111
    const bankOrder = [5, 2, 0, 1, 3, 4];
    for (let i = 6; i <= 111; i++) {
      bankOrder.push(i);
    }

    for (const bankNo of bankOrder) {
      if (this.banks.has(bankNo)) {
        parts.push(this.banks.get(bankNo)!);
      }
    }

    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }

  /**
   * Create NEX file from assembler output.
   * @param output - Assembler output with nexConfig
   * @param baseDir - Base directory for resolving relative paths
   * @returns NEX file as byte array
   */
  static async fromAssemblerOutput(
    output: AssemblerOutput<any, any>,
    baseDir: string
  ): Promise<Uint8Array> {
    if (!output.nexConfig) {
      throw new Error("No NEX configuration in assembler output");
    }

    const writer = new NexFileWriter();
    const config = output.nexConfig;

    // Configure header
    writer.setRamRequirement(config.ramSize);
    writer.setBorderColor(config.borderColor);
    
    if (config.stackAddr !== undefined) {
      writer.setStackPointer(config.stackAddr);
    }
    
    if (config.entryAddr !== undefined) {
      writer.setProgramCounter(config.entryAddr);
    } else if (output.entryAddress !== undefined) {
      writer.setProgramCounter(output.entryAddress);
    }
    
    writer.setCoreVersion(
      config.coreVersion.major,
      config.coreVersion.minor,
      config.coreVersion.subminor
    );
    
    writer.setLoadingBar(
      config.loadingBar.enabled,
      config.loadingBar.color,
      config.loadingBar.delay,
      config.loadingBar.startDelay
    );
    
    writer.setPreserveNextRegs(config.preserveRegs);
    writer.setEntryBank(config.entryBank);
    
    // Handle file handle
    if (config.fileHandle === "close") {
      writer.setFileHandle(0x0000); // 0 = close file
    } else if (config.fileHandle === "open") {
      writer.setFileHandle(0x0001); // 1 = pass handle in BC register (recommended)
    } else if (typeof config.fileHandle === "number") {
      writer.setFileHandle(config.fileHandle);
    } else {
      writer.setFileHandle(0x0000); // Default to close
    }

    // Load screen
    if (config.screen && config.screen.filename) {
      const screenPath = path.resolve(baseDir, config.screen.filename);
      const screenData = await fs.readFile(screenPath);
      writer.addScreen(config.screen.type, new Uint8Array(screenData));
    }

    // Load palette
    if (config.paletteFile) {
      const palettePath = path.resolve(baseDir, config.paletteFile);
      const paletteData = await fs.readFile(palettePath);
      writer.setPalette(new Uint8Array(paletteData));
    }

    // Load copper
    if (config.copperFile) {
      const copperPath = path.resolve(baseDir, config.copperFile);
      const copperData = await fs.readFile(copperPath);
      writer.setCopper(new Uint8Array(copperData));
    }

    // Add banks from segments
    const bankData = new Map<number, Uint8Array>();
    
    // Process unbanked segments into bank 2 (for Next auto-defaults)
    if (output.unbankedSegments && output.unbankedSegments.length > 0) {
      if (!bankData.has(2)) {
        bankData.set(2, new Uint8Array(16384));
      }
      
      const bank2 = bankData.get(2)!;
      
      // Map each unbanked segment to bank 2
      for (const segment of output.unbankedSegments) {
        // Calculate bank 2 offset from absolute address
        // Bank 2 address range is $8000-$bfff, offset 0 corresponds to $8000
        const bank2Offset = segment.startAddress - 0x8000;
        
        if (bank2Offset < 0) {
          // Address below bank 2 range
          console.warn(
            `Warning: Unbanked code at $${segment.startAddress.toString(16).toUpperCase()} ` +
            `is below bank 2 range ($8000). Code will be ignored.`
          );
          continue;
        }
        
        if (bank2Offset >= 16384) {
          // Address above bank 2 range
          console.warn(
            `Warning: Unbanked code at $${segment.startAddress.toString(16).toUpperCase()} ` +
            `is above bank 2 range ($bfff). Code may be truncated.`
          );
        }
        
        // Copy segment data to bank 2 at correct offset
        const segmentData = new Uint8Array(segment.emittedCode);
        for (let i = 0; i < segmentData.length; i++) {
          const targetOffset = bank2Offset + i;
          if (targetOffset < 16384) {
            bank2[targetOffset] = segmentData[i];
          }
        }
      }
    }
    
    for (const segment of output.segments) {
      if (segment.bank !== undefined && segment.bank !== null) {
        // Get or create bank data
        if (!bankData.has(segment.bank)) {
          bankData.set(segment.bank, new Uint8Array(16384));
        }
        
        const bank = bankData.get(segment.bank)!;
        
        // Calculate offset within bank
        const bankOffset = segment.startAddress % 16384;
        
        // Copy segment data to bank
        const segmentData = new Uint8Array(segment.emittedCode);
        for (let i = 0; i < segmentData.length; i++) {
          if (bankOffset + i < 16384) {
            bank[bankOffset + i] = segmentData[i];
          }
        }
      }
    }

    // Add all banks to writer
    for (const [bankNo, data] of bankData) {
      writer.addBank(bankNo, data);
    }

    return writer.write();
  }
}

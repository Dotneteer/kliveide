import { describe, it, expect } from "vitest";
import { NexFileWriter } from "@main/z80-compiler/nex-file-writer";
import { AssemblerOutput, AssemblerOptions, SourceFileItem, BinarySegment } from "@main/compiler-common/assembler-in-out";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

describe("NEX File Writer", () => {
  it("creates header with correct signature and version", () => {
    const writer = new NexFileWriter();
    const nex = writer.write();

    // Check signature "Next"
    expect(nex[0]).toBe(0x4e); // 'N'
    expect(nex[1]).toBe(0x65); // 'e'
    expect(nex[2]).toBe(0x78); // 'x'
    expect(nex[3]).toBe(0x74); // 't'

    // Check version "V1.2"
    expect(nex[4]).toBe(0x56); // 'V'
    expect(nex[5]).toBe(0x31); // '1'
    expect(nex[6]).toBe(0x2e); // '.'
    expect(nex[7]).toBe(0x32); // '2'
  });

  it("sets RAM requirement correctly", () => {
    const writer = new NexFileWriter();
    
    writer.setRamRequirement(768);
    let nex = writer.write();
    expect(nex[8]).toBe(0); // 768K
    
    writer.setRamRequirement(1792);
    nex = writer.write();
    expect(nex[8]).toBe(1); // 1792K
  });

  it("sets border color correctly", () => {
    const writer = new NexFileWriter();
    writer.setBorderColor(5);
    const nex = writer.write();
    expect(nex[11]).toBe(5);
  });

  it("sets stack pointer correctly", () => {
    const writer = new NexFileWriter();
    writer.setStackPointer(0xff00);
    const nex = writer.write();
    expect(nex[12]).toBe(0x00); // Low byte
    expect(nex[13]).toBe(0xff); // High byte
  });

  it("sets program counter correctly", () => {
    const writer = new NexFileWriter();
    writer.setProgramCounter(0x8000);
    const nex = writer.write();
    expect(nex[14]).toBe(0x00); // Low byte
    expect(nex[15]).toBe(0x80); // High byte
  });

  it("sets core version correctly", () => {
    const writer = new NexFileWriter();
    writer.setCoreVersion(3, 1, 10);
    const nex = writer.write();
    expect(nex[135]).toBe(3);
    expect(nex[136]).toBe(1);
    expect(nex[137]).toBe(10);
  });

  it("sets loading bar correctly", () => {
    const writer = new NexFileWriter();
    writer.setLoadingBar(true, 128, 50, 100);
    const nex = writer.write();
    expect(nex[130]).toBe(1); // enabled
    expect(nex[131]).toBe(128); // color
    expect(nex[132]).toBe(50); // delay
    expect(nex[133]).toBe(100); // start delay
  });

  it("sets preserve Next regs correctly", () => {
    const writer = new NexFileWriter();
    writer.setPreserveNextRegs(true);
    const nex = writer.write();
    expect(nex[134]).toBe(1);
  });

  it("sets entry bank correctly", () => {
    const writer = new NexFileWriter();
    writer.setEntryBank(5);
    const nex = writer.write();
    expect(nex[139]).toBe(5);
  });

  it("sets file handle correctly", () => {
    const writer = new NexFileWriter();
    writer.setFileHandle(0x5b00);
    const nex = writer.write();
    expect(nex[140]).toBe(0x00); // Low byte
    expect(nex[141]).toBe(0x5b); // High byte
  });

  it("adds banks and marks them in header", () => {
    const writer = new NexFileWriter();
    const bankData = new Uint8Array([0x01, 0x02, 0x03]);
    
    writer.addBank(5, bankData);
    const nex = writer.write();
    
    // Check bank count
    expect(nex[9]).toBe(1);
    
    // Check bank 5 is marked present
    expect(nex[18 + 5]).toBe(1);
    
    // Check header size is 512
    expect(nex.length).toBeGreaterThanOrEqual(512);
  });

  it("pads bank data to 16KB", () => {
    const writer = new NexFileWriter();
    const bankData = new Uint8Array([0x01, 0x02, 0x03]);
    
    writer.addBank(5, bankData);
    const nex = writer.write();
    
    // NEX should be 512 (header) + 16384 (bank) = 16896 bytes
    expect(nex.length).toBe(16896);
  });

  it("orders banks correctly in NEX file", () => {
    const writer = new NexFileWriter();
    
    // Add banks out of order
    writer.addBank(0, new Uint8Array([0x00]));
    writer.addBank(5, new Uint8Array([0x05]));
    writer.addBank(2, new Uint8Array([0x02]));
    writer.addBank(7, new Uint8Array([0x07]));
    
    const nex = writer.write();
    
    // Check bank count
    expect(nex[9]).toBe(4);
    
    // Banks should be in order: 5, 2, 0, 1(missing), 3(missing), 4(missing), 6(missing), 7
    // After 512-byte header:
    // Position 512: bank 5 (starts with 0x05)
    // Position 512+16384: bank 2 (starts with 0x02)
    // Position 512+32768: bank 0 (starts with 0x00)
    // Position 512+49152: bank 7 (starts with 0x07) - skipping 1,3,4,6
    
    expect(nex[512]).toBe(0x05); // Bank 5
    expect(nex[512 + 16384]).toBe(0x02); // Bank 2
    expect(nex[512 + 32768]).toBe(0x00); // Bank 0
    expect(nex[512 + 49152]).toBe(0x07); // Bank 7
  });

  it("throws error for invalid bank number", () => {
    const writer = new NexFileWriter();
    const bankData = new Uint8Array([0x01]);
    
    expect(() => writer.addBank(-1, bankData)).toThrow("Invalid bank number");
    expect(() => writer.addBank(112, bankData)).toThrow("Invalid bank number");
  });

  it("throws error for bank data too large", () => {
    const writer = new NexFileWriter();
    const bankData = new Uint8Array(16385); // One byte too large
    
    expect(() => writer.addBank(5, bankData)).toThrow("Bank 5 data too large");
  });

  it("adds Layer2 screen and sets flags", () => {
    const writer = new NexFileWriter();
    const screenData = new Uint8Array(49152); // 256x192x8
    screenData[0] = 0xaa; // Marker
    
    writer.addScreen("layer2", screenData);
    const nex = writer.write();
    
    // Check screen flag (bit 0)
    expect(nex[10] & 0x01).toBe(0x01);
    
    // Screen should be after 512-byte header
    expect(nex[512]).toBe(0xaa);
  });

  it("adds ULA screen and sets flags", () => {
    const writer = new NexFileWriter();
    const screenData = new Uint8Array(6912); // Standard Spectrum screen
    screenData[0] = 0xbb;
    
    writer.addScreen("ula", screenData);
    const nex = writer.write();
    
    // Check screen flag (bit 1)
    expect(nex[10] & 0x02).toBe(0x02);
    
    expect(nex[512]).toBe(0xbb);
  });

  it("validates screen data size", () => {
    const writer = new NexFileWriter();
    const wrongSize = new Uint8Array(1000); // Wrong size for any screen type
    
    expect(() => writer.addScreen("layer2", wrongSize)).toThrow(
      "Invalid screen data size"
    );
  });

  it("adds palette and clears no-palette flag", () => {
    const writer = new NexFileWriter();
    const paletteData = new Uint8Array(512);
    paletteData[0] = 0xcc;
    
    writer.setPalette(paletteData);
    const nex = writer.write();
    
    // Check no-palette flag is NOT set (bit 7 should be 0)
    expect(nex[10] & 0x80).toBe(0x00);
    
    // Palette should be after 512-byte header
    expect(nex[512]).toBe(0xcc);
  });

  it("validates palette size", () => {
    const writer = new NexFileWriter();
    const wrongSize = new Uint8Array(256);
    
    expect(() => writer.setPalette(wrongSize)).toThrow("Palette must be 512 bytes");
  });

  it("adds copper code", () => {
    const writer = new NexFileWriter();
    const copperData = new Uint8Array(100);
    copperData[0] = 0xdd;
    
    writer.setCopper(copperData);
    
    // Add a bank so we can find the copper code position
    writer.addBank(5, new Uint8Array([0x05]));
    
    const nex = writer.write();
    
    // Copper comes after header (512) and before banks
    // Since no screens/palette, copper should be at position 512
    expect(nex[512]).toBe(0xdd);
  });

  it("validates copper code size", () => {
    const writer = new NexFileWriter();
    const tooLarge = new Uint8Array(2049);
    
    expect(() => writer.setCopper(tooLarge)).toThrow("Copper code too large");
  });

  it("creates NEX from assembler output", async () => {
    const sourceItem = new SourceFileItem("test.z80");
    const output = new AssemblerOutput<any, any>(sourceItem, false);
    
    // Configure NEX settings
    output.nexConfig = {
      ramSize: 768,
      borderColor: 2,
      coreVersion: { major: 3, minor: 1, subminor: 10 },
      stackAddr: 0xff00,
      entryAddr: 0x8000,
      entryBank: 5,
      fileHandle: "close",
      preserveRegs: false,
      loadingBar: { enabled: true, color: 128, delay: 10, startDelay: 50 }
    };
    
    // Add entry address
    output.entryAddress = 0x8000;
    
    // Add a segment in bank 5
    const segment = new BinarySegment();
    segment.bank = 5;
    segment.bankOffset = 0;
    segment.startAddress = 0xc000;
    segment.emittedCode = [0x3e, 0x05, 0xd3, 0xfe, 0xc9]; // ld a,5 : out (0xfe),a : ret
    output.segments.push(segment);
    
    const nex = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    
    expect(nex[0]).toBe(0x4e); // 'N'
    expect(nex[8]).toBe(0); // 768K RAM
    expect(nex[11]).toBe(2); // Border
    expect(nex[139]).toBe(5); // Entry bank
    expect(nex[14]).toBe(0x00); // PC low
    expect(nex[15]).toBe(0x80); // PC high
  });

  it("handles multiple segments in same bank", async () => {
    const sourceItem = new SourceFileItem("test.z80");
    const output = new AssemblerOutput<any, any>(sourceItem, false);
    
    output.nexConfig = {
      ramSize: 768,
      borderColor: 0,
      coreVersion: { major: 0, minor: 0, subminor: 0 },
      entryBank: 5,
      fileHandle: "close",
      preserveRegs: false,
      loadingBar: { enabled: false, color: 0, delay: 0, startDelay: 0 }
    };
    
    // Add two segments in bank 5
    const segment1 = new BinarySegment();
    segment1.bank = 5;
    segment1.bankOffset = 0;
    segment1.startAddress = 0xc000;
    segment1.emittedCode = [0x01, 0x02, 0x03];
    output.segments.push(segment1);
    
    const segment2 = new BinarySegment();
    segment2.bank = 5;
    segment2.bankOffset = 0;
    segment2.startAddress = 0xd000; // Different address in same bank
    segment2.emittedCode = [0x04, 0x05, 0x06];
    output.segments.push(segment2);
    
    const nex = await NexFileWriter.fromAssemblerOutput(output, process.cwd());
    
    // Bank 5 should contain both segments
    // Bank data starts at 512 bytes (header)
    const bankStart = 512;
    
    // First segment at bank offset 0
    expect(nex[bankStart + 0]).toBe(0x01);
    
    // Second segment at bank offset 0x1000 (0xD000 - 0xC000)
    expect(nex[bankStart + 0x1000]).toBe(0x04);
  });

  it("creates minimal valid NEX file", () => {
    const writer = new NexFileWriter();
    const nex = writer.write();
    
    // Minimal NEX is just the 512-byte header
    expect(nex.length).toBe(512);
    
    // Verify it's a valid NEX header
    expect(nex[0]).toBe(0x4e); // 'N'
    expect(nex[1]).toBe(0x65); // 'e'
    expect(nex[2]).toBe(0x78); // 'x'
    expect(nex[3]).toBe(0x74); // 't'
  });

  it("creates complex NEX with all features", () => {
    const writer = new NexFileWriter();
    
    // Configure everything
    writer.setRamRequirement(1792);
    writer.setBorderColor(5);
    writer.setStackPointer(0xff00);
    writer.setProgramCounter(0xc000);
    writer.setCoreVersion(3, 1, 10);
    writer.setLoadingBar(true, 2, 10, 50);
    writer.setPreserveNextRegs(true);
    writer.setEntryBank(5);
    writer.setFileHandle(0xffff);
    
    // Add palette
    const palette = new Uint8Array(512);
    palette[0] = 0xee; // Add a marker
    writer.setPalette(palette);
    
    // Add Layer2 screen
    const screen = new Uint8Array(49152);
    writer.addScreen("layer2", screen);
    
    // Add copper
    const copper = new Uint8Array(100);
    writer.setCopper(copper);
    
    // Add banks
    writer.addBank(5, new Uint8Array([0x05]));
    writer.addBank(2, new Uint8Array([0x02]));
    writer.addBank(0, new Uint8Array([0x00]));
    
    const nex = writer.write();
    
    // Calculate expected size:
    // 512 (header) + 512 (palette) + 49152 (screen) + 100 (copper) + 3*16384 (banks) = 99364
    expect(nex.length).toBe(512 + 512 + 49152 + 100 + 3 * 16384);
    
    // Verify structure
    expect(nex[0]).toBe(0x4e); // Header starts correctly
    expect(nex[512]).toBe(0xee); // Palette present with marker
    expect(nex[10] & 0x01).toBe(0x01); // Layer2 flag set
    expect(nex[9]).toBe(3); // 3 banks
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { instantiateWasmZxSpectrum48Machine } from "@emu/sp48/WasmZxSpectrum48Machine";

async function createMachine() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  return instantiateWasmZxSpectrum48Machine(readFileSync(wasmPath));
}

describe("Wasm ZX Spectrum 48K skeleton", () => {
  it("exports stable static buffers and machine shape", async () => {
    const machine = await createMachine();
    machine.hardReset();

    const memory = machine.getMemory();
    const pixels = machine.getPixelBuffer();
    const pixelBytes = machine.getPixelBufferBytes();
    const keyboard = machine.getKeyboardLines();
    const audioWords = machine.getAudioSampleWords();

    expect(memory.byteLength).toBe(0x10000);
    expect(pixels.length).toBe(256 * 192);
    expect(pixelBytes.byteLength).toBe(256 * 192 * 4);
    expect(keyboard.length).toBe(8);
    expect(audioWords.length).toBe(machine.getAudioSampleCount() * 2);
    expect(machine.screenWidthInPixels).toBe(256);
    expect(machine.screenHeightInPixels).toBe(192);
    expect(machine.tactsInFrame).toBe(69888);
    expect(machine.baseClockFrequency).toBe(3_500_000);
    expect(machine.getPixelBufferStartOffset()).toBe(0);

    const memoryBuffer = memory.buffer;
    const pixelBuffer = pixels.buffer;
    const keyboardBuffer = keyboard.buffer;
    const audioBuffer = audioWords.buffer;

    machine.executeMachineFrame();

    expect(machine.getMemory().buffer).toBe(memoryBuffer);
    expect(machine.getPixelBuffer().buffer).toBe(pixelBuffer);
    expect(machine.getKeyboardLines().buffer).toBe(keyboardBuffer);
    expect(machine.getAudioSampleWords().buffer).toBe(audioBuffer);
  });

  it("advances frames and changes the placeholder display", async () => {
    const machine = await createMachine();
    machine.reset();

    const before = machine.getPixelBuffer()[0];
    const result = machine.executeMachineFrame();
    const after = machine.getPixelBuffer()[0];

    expect(result).toBe(0);
    expect(machine.frames).toBe(1);
    expect(machine.tacts).toBe(69888);
    expect(after).not.toBe(before);
  });

  it("produces deterministic placeholder audio samples", async () => {
    const machine = await createMachine();
    machine.setAudioSampleRate(48_000);
    machine.executeMachineFrame();

    const samples = machine.getAudioSamples();

    expect(machine.getAudioSampleCount()).toBe(960);
    expect(machine.getAudioSampleCapacity()).toBeGreaterThanOrEqual(960);
    expect(samples.length).toBe(960);
    expect(samples[0].left).toBe(samples[0].right);
    expect(samples.some((sample) => sample.left !== 0)).toBe(true);
    expect(machine.getDiagnosticFlags()).toBe(0);
  });

  it("records keyboard state in static Wasm memory and affects the fake display", async () => {
    const machine = await createMachine();
    machine.reset();

    const before = machine.getPixelBuffer()[0];
    machine.setKeyStatus(10, true);
    machine.executeMachineFrame();

    expect(machine.getKeyboardLine(2)).toBe(0x01);
    expect(machine.getKeyboardLines()[2]).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xfe);
    expect(machine.getPixelBuffer()[0]).not.toBe(before);

    machine.setKeyStatus(10, false);
    expect(machine.getKeyboardLine(2)).toBe(0x00);
    expect(machine.readPort(0xfbfe)).toBe(0xff);
  });

  it("reads the real keyboard matrix through port $FE", async () => {
    const machine = await createMachine();
    machine.reset();

    expect(machine.readPort(0x00fe)).toBe(0xff);

    machine.setKeyStatus(10, true); // Q, line 2 bit 0
    machine.setKeyStatus(14, true); // T, line 2 bit 4
    machine.setKeyStatus(5, true);  // A, line 1 bit 0

    expect(machine.getKeyboardLine(2)).toBe(0x11);
    expect(machine.getKeyboardLine(1)).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xee);
    expect(machine.readPort(0xfdfe)).toBe(0xfe);
    expect(machine.readPort(0xf9fe)).toBe(0xee);
    expect(machine.readPort(0xffff)).toBe(0xff);

    machine.setKeyStatus(14, false);

    expect(machine.getKeyboardLine(2)).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xfe);
  });

  it("uploads the 48K ROM and protects ROM bytes through the memory map", async () => {
    const machine = await createMachine();
    const romPath = resolve(process.cwd(), "src/public/roms/sp48.rom");
    const rom = new Uint8Array(readFileSync(romPath));

    expect(machine.getRomSize()).toBe(0x4000);

    const topLeftBeforeRom = machine.getPixelBuffer()[0];
    machine.uploadRomBytes(rom);
    machine.hardReset();

    expect(machine.getRomUploadCount()).toBe(0x4000);
    expect(machine.getRomChecksum()).not.toBe(0);
    expect(machine.getPixelBuffer()[0]).not.toBe(topLeftBeforeRom);

    machine.writeMemory(0x0000, rom[0] ^ 0xff);
    machine.writeMemory(0x4000, 0x5a);
    machine.writeMemory(0xffff, 0xa5);

    expect(machine.readMemory(0x0000)).toBe(rom[0]);
    expect(machine.readMemory(0x3fff)).toBe(rom[0x3fff]);
    expect(machine.readMemory(0x4000)).toBe(0x5a);
    expect(machine.readMemory(0xffff)).toBe(0xa5);

    machine.hardReset();

    expect(machine.readMemory(0x0000)).toBe(rom[0]);
    expect(machine.readMemory(0x3fff)).toBe(rom[0x3fff]);
    expect(machine.readMemory(0x4000)).toBe(0x00);
    expect(machine.readMemory(0xffff)).toBe(0x00);
  });

  it("initializes upper memory as unavailable in 16K mode", async () => {
    const machine = await createMachine();

    machine.writeMemory(0x8000, 0x5a);
    machine.hardReset(true);

    expect(machine.readMemory(0x4000)).toBe(0x00);
    expect(machine.readMemory(0x7fff)).toBe(0x00);
    expect(machine.readMemory(0x8000)).toBe(0xff);
    expect(machine.readMemory(0xffff)).toBe(0xff);
  });

  it("does not export allocator functions", async () => {
    const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
    const module = new WebAssembly.Module(readFileSync(wasmPath));
    const exportNames = WebAssembly.Module.exports(module).map((item) => item.name);

    expect(exportNames).not.toContain("malloc");
    expect(exportNames).not.toContain("calloc");
    expect(exportNames).not.toContain("realloc");
    expect(exportNames).not.toContain("free");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { instantiateWasmZxSpectrum48Machine } from "@emu/sp48/WasmZxSpectrum48Machine";

async function createMachine() {
  const wasmPath = resolve(process.cwd(), "public/wasm/sp48.wasm");
  return instantiateWasmZxSpectrum48Machine(readFileSync(wasmPath));
}

const RenderingPhase = {
  Border: 1,
  BorderFetchPixel: 2,
  BorderFetchAttr: 3,
  DisplayB1: 4,
  DisplayB1FetchB2: 6,
  DisplayB1FetchA2: 7,
  DisplayB2FetchB1: 8,
  DisplayB2FetchA1: 9
} as const;

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

    const sampleIndex = 16 * machine.screenWidthInPixels + 16;
    const before = machine.getPixelBuffer()[sampleIndex];
    const result = machine.executeMachineFrame();
    const after = machine.getPixelBuffer()[sampleIndex];

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

    const sampleIndex = 16 * machine.screenWidthInPixels + 16;
    const before = machine.getPixelBuffer()[sampleIndex];
    machine.setKeyStatus(10, true);
    machine.executeMachineFrame();

    expect(machine.getKeyboardLine(2)).toBe(0x01);
    expect(machine.getKeyboardLines()[2]).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xbe);
    expect(machine.getPixelBuffer()[sampleIndex]).not.toBe(before);

    machine.setKeyStatus(10, false);
    expect(machine.getKeyboardLine(2)).toBe(0x00);
    expect(machine.readPort(0xfbfe)).toBe(0xbf);
  });

  it("reads the real keyboard matrix through port $FE", async () => {
    const machine = await createMachine();
    machine.reset();

    expect(machine.readPort(0x00fe)).toBe(0xbf);

    machine.setKeyStatus(10, true); // Q, line 2 bit 0
    machine.setKeyStatus(14, true); // T, line 2 bit 4
    machine.setKeyStatus(5, true);  // A, line 1 bit 0

    expect(machine.getKeyboardLine(2)).toBe(0x11);
    expect(machine.getKeyboardLine(1)).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xae);
    expect(machine.readPort(0xfdfe)).toBe(0xbe);
    expect(machine.readPort(0xf9fe)).toBe(0xae);
    expect(machine.readPort(0xffff)).toBe(0xff);

    machine.setKeyStatus(14, false);

    expect(machine.getKeyboardLine(2)).toBe(0x01);
    expect(machine.readPort(0xfbfe)).toBe(0xbe);
  });

  it("writes port $FE border, EAR, and MIC state", async () => {
    const machine = await createMachine();
    machine.reset();

    expect(machine.getBorderColor()).toBe(7);
    expect(machine.getPortFeValue()).toBe(0);
    expect(machine.getEarBit()).toBe(false);
    expect(machine.getMicBit()).toBe(false);
    expect(machine.getBeeperLevel()).toBe(0);

    const before = machine.getPixelBuffer()[0];
    machine.writePort(0x00fe, 0x1b);
    machine.executeMachineFrame();

    expect(machine.getPortFeValue()).toBe(0x1b);
    expect(machine.getBorderColor()).toBe(3);
    expect(machine.getEarBit()).toBe(true);
    expect(machine.getMicBit()).toBe(true);
    expect(machine.getBeeperLevel()).toBe(3);
    expect(machine.readPort(0x00fe)).toBe(0xff);
    expect(machine.getPixelBuffer()[0]).not.toBe(before);

    machine.writePort(0x00ff, 0x00);

    expect(machine.getPortFeValue()).toBe(0x1b);
    expect(machine.getBorderColor()).toBe(3);
  });

  it("tracks EAR transition tacts for passive port $FE reads", async () => {
    const machine = await createMachine();
    machine.reset();

    machine.executeInstruction();
    machine.writePort(0x00fe, 0x10);

    expect(machine.tacts).toBe(4);
    expect(machine.getEarBit()).toBe(true);
    expect(machine.getEarBitChangedFrom0Tacts()).toBe(4);

    machine.executeInstruction();
    machine.executeInstruction();
    machine.writePort(0x00fe, 0x00);

    expect(machine.tacts).toBe(12);
    expect(machine.getEarBit()).toBe(false);
    expect(machine.getEarBitChangedFrom1Tacts()).toBe(12);
    expect(machine.readPort(0x00fe)).toBe(0xff);

    for (let i = 0; i < 9; i++) {
      machine.executeInstruction();
    }

    expect(machine.tacts).toBe(48);
    expect(machine.readPort(0x00fe)).toBe(0xbf);
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

  it("initializes PAL and NTSC frame timing from the Spectrum screen model", async () => {
    const machine = await createMachine();

    machine.hardReset(false, false);

    expect(machine.tactsInFrame).toBe(69_888);
    expect(machine.getRasterLines()).toBe(312);
    expect(machine.getScreenLineTime()).toBe(224);
    expect(machine.getTimingScreenWidth()).toBe(352);
    expect(machine.getTimingScreenLines()).toBe(288);
    expect(machine.getFirstVisibleLine()).toBe(15);
    expect(machine.getFirstDisplayLine()).toBe(64);
    expect(machine.getFirstVisibleBorderTact()).toBe(200);

    machine.hardReset(false, true);

    expect(machine.tactsInFrame).toBe(59_136);
    expect(machine.getRasterLines()).toBe(264);
    expect(machine.getScreenLineTime()).toBe(224);
    expect(machine.getTimingScreenWidth()).toBe(352);
    expect(machine.getTimingScreenLines()).toBe(240);
    expect(machine.getFirstVisibleLine()).toBe(23);
    expect(machine.getFirstDisplayLine()).toBe(48);
    expect(machine.getFirstVisibleBorderTact()).toBe(200);
  });

  it("builds rendering phase tables for display and border prefetch tacts", async () => {
    const machine = await createMachine();
    machine.hardReset();

    const firstDisplayTact = machine.getFirstDisplayLine() * machine.getScreenLineTime();

    expect(machine.getRenderingPhase(firstDisplayTact)).toBe(RenderingPhase.DisplayB1FetchB2);
    expect(machine.getRenderingPixelAddress(firstDisplayTact)).toBe(0x0001);
    expect(machine.getContentionValue(firstDisplayTact)).toBe(5);
    expect(machine.getRenderingPixelIndex(firstDisplayTact)).toBe(17_296);

    expect(machine.getRenderingPhase(firstDisplayTact + 1)).toBe(RenderingPhase.DisplayB1FetchA2);
    expect(machine.getRenderingAttributeAddress(firstDisplayTact + 1)).toBe(0x1801);
    expect(machine.getContentionValue(firstDisplayTact + 1)).toBe(4);

    expect(machine.getRenderingPhase(firstDisplayTact + 2)).toBe(RenderingPhase.DisplayB1);
    expect(machine.getContentionValue(firstDisplayTact + 2)).toBe(3);

    expect(machine.getRenderingPhase(firstDisplayTact + 6)).toBe(RenderingPhase.DisplayB2FetchB1);
    expect(machine.getRenderingPixelAddress(firstDisplayTact + 6)).toBe(0x0002);
    expect(machine.getContentionValue(firstDisplayTact + 6)).toBe(0);

    expect(machine.getRenderingPhase(firstDisplayTact + 7)).toBe(RenderingPhase.DisplayB2FetchA1);
    expect(machine.getRenderingAttributeAddress(firstDisplayTact + 7)).toBe(0x1802);
    expect(machine.getContentionValue(firstDisplayTact + 7)).toBe(6);

    const prefetchLineTact = (machine.getFirstDisplayLine() - 1) * machine.getScreenLineTime();

    expect(machine.getRenderingPhase(prefetchLineTact + 221)).toBe(RenderingPhase.Border);
    expect(machine.getContentionValue(prefetchLineTact + 221)).toBe(0);
    expect(machine.getRenderingPhase(prefetchLineTact + 222)).toBe(RenderingPhase.BorderFetchPixel);
    expect(machine.getRenderingPixelAddress(prefetchLineTact + 222)).toBe(0x0000);
    expect(machine.getRenderingPixelIndex(prefetchLineTact + 222)).toBe(17_292);
    expect(machine.getRenderingPhase(prefetchLineTact + 223)).toBe(RenderingPhase.BorderFetchAttr);
    expect(machine.getRenderingAttributeAddress(prefetchLineTact + 223)).toBe(0x1800);
    expect(machine.getContentionValue(prefetchLineTact + 223)).toBe(6);
  });

  it("applies memory and port contention delays at the current frame tact", async () => {
    const machine = await createMachine();
    machine.hardReset();

    const firstDisplayTact = machine.getFirstDisplayLine() * machine.getScreenLineTime();

    machine.setTacts(firstDisplayTact);
    machine.resetContentionCounters();
    machine.delayAddressBusAccess(0x4000);

    expect(machine.tacts).toBe(firstDisplayTact + 5);
    expect(machine.getTotalContentionDelaySinceStart()).toBe(5);
    expect(machine.getContentionDelaySincePause()).toBe(5);

    machine.delayAddressBusAccess(0x8000);

    expect(machine.tacts).toBe(firstDisplayTact + 5);
    expect(machine.getTotalContentionDelaySinceStart()).toBe(5);

    machine.setTacts(firstDisplayTact);
    machine.resetContentionCounters();
    machine.delayPortRead(0x8001);

    expect(machine.tacts).toBe(firstDisplayTact + 4);
    expect(machine.getTotalContentionDelaySinceStart()).toBe(0);

    machine.setTacts(firstDisplayTact);
    machine.resetContentionCounters();
    machine.delayPortRead(0x8000);

    expect(machine.tacts).toBe(firstDisplayTact + 8);
    expect(machine.getTotalContentionDelaySinceStart()).toBe(4);

    machine.setTacts(firstDisplayTact);
    machine.resetContentionCounters();
    machine.delayPortWrite(0x4000);

    expect(machine.tacts).toBe(firstDisplayTact + 9);
    expect(machine.getTotalContentionDelaySinceStart()).toBe(5);
  });

  it("executes Z80 instructions through the SP48 ROM and port bus", async () => {
    const machine = await createMachine();
    const rom = new Uint8Array(0x4000);
    rom.set([0x3e, 0x03, 0xd3, 0xfe]); // LD A,3; OUT ($FE),A

    machine.uploadRomBytes(rom);
    machine.hardReset();

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x0002);
    expect(machine.getCpuAf() >> 8).toBe(0x03);
    expect(machine.getCpuInstructionsExecuted()).toBe(1);
    expect(machine.getBorderColor()).toBe(7);

    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x0004);
    expect(machine.getPortFeValue()).toBe(0x03);
    expect(machine.getBorderColor()).toBe(3);
    expect(machine.getCpuInstructionsExecuted()).toBe(2);
  });

  it("executes Z80 memory writes through the SP48 RAM map", async () => {
    const machine = await createMachine();
    const rom = new Uint8Array(0x4000);
    rom.set([0x21, 0x00, 0x40, 0x36, 0x3c]); // LD HL,$4000; LD (HL),$3C

    machine.uploadRomBytes(rom);
    machine.hardReset();
    machine.executeInstruction();
    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x0005);
    expect(machine.getCpuHl()).toBe(0x4000);
    expect(machine.readMemory(0x4000)).toBe(0x3c);
  });

  it("uses display contention when the embedded Z80 reads contended RAM", async () => {
    const machine = await createMachine();
    const rom = new Uint8Array(0x4000);
    rom[0] = 0x7e; // LD A,(HL)

    machine.uploadRomBytes(rom);
    machine.hardReset();
    machine.writeMemory(0x4000, 0x5a);
    machine.setCpuHl(0x4000);

    const firstDisplayTact = machine.getFirstDisplayLine() * machine.getScreenLineTime();
    machine.setTacts(firstDisplayTact);
    machine.resetContentionCounters();
    machine.executeInstruction();

    expect(machine.getCpuPc()).toBe(0x0001);
    expect(machine.getCpuAf() >> 8).toBe(0x5a);
    expect(machine.tacts).toBe(firstDisplayTact + 8);
    expect(machine.getCpuTacts()).toBe(firstDisplayTact + 8);
    expect(machine.getTotalContentionDelaySinceStart()).toBe(1);
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

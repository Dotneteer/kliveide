import { describe, expect, it, vi } from "vitest";

import type { Z80CpuState } from "@common/messaging/EmuApi";
import type { Z88HarnessMachine } from "../../harness/z88";

import { machineRegistry } from "@common/machines/machine-registry";
import {
  MC_SCREEN_SIZE,
  MC_Z88_INTRAM,
  MC_Z88_INTROM,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3,
  MC_Z88_USE_DEFAULT_ROM
} from "@common/machines/constants";
import { AUDIO_SAMPLE_RATE, FILE_PROVIDER } from "@emu/machines/machine-props";
import { Z88Machine } from "@emu/machines/z88/Z88Machine";
import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { CardIds } from "@emu/machines/z88/memory/CardIds";
import { Z88KeyCode } from "@emu/machines/z88/Z88KeyCode";
import { z88InternalRamSizeInBytes } from "@emu/machines/z88/z88CardCatalog";
import {
  createHarnessZ88Machine,
  createZ88Session,
  HarnessFileProvider,
  ResolvingMessenger,
  z88WasmArtifactBytes
} from "../../harness/z88";

/*
 * The WASM Cambridge Z88 as a machine (Steps 2-9 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`):
 * the host plumbing it shares with the TypeScript machine - compared with it side by side - and how
 * the adapter hands keys, audio samples, the picture and the sleep state between the app and the core.
 */

const SLOT = 0x10_0000;

function models(): string[] {
  return machineRegistry
    .find((m) => m.machineId === "z88")
    .models.filter((m) => m.menuGroup === undefined) // the originals, not the backend twins
    .map((m) => m.modelId);
}

function sentSettings(machine: Z88HarnessMachine): unknown[] {
  const messenger = (machine as unknown as { messenger: ResolvingMessenger }).messenger;
  return messenger.sent.map((m) => (m as any).args);
}

/** A WASM machine whose key and Blink calls are recorded instead of reaching the core */
class RecordingZ88WasmMachine extends Z88WasmV2Machine {
  readonly calls: string[] = [];
  override setKeyStatus(key: number, isDown: boolean): void {
    this.calls.push(`key ${key} ${isDown ? "down" : "up"}`);
  }
  override signalFlapOpened(): void {
    this.calls.push("flap opened");
  }
  override signalFlapClosed(): void {
    this.calls.push("flap closed");
  }
  protected override raiseBatteryLow(): void {
    this.calls.push("battery low");
  }
}

describe("Cambridge Z88 WASM machine - identity and metadata (same as the TypeScript machine)", () => {
  const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
  const ts = new Z88Machine(model, model.config, undefined);
  const wasm = new Z88WasmV2Machine(model, model.config);

  it.each([
    "machineId",
    "romId",
    "uiFrameFrequency",
    "softResetOnFirstStart",
    "baseClockFrequency",
    "clockMultiplier",
    "delayedAddressBus",
    "tactsInFrame",
    "isOsInitialized",
    "isInSleepMode"
  ])("%s", (member) => {
    expect((wasm as any)[member]).toEqual((ts as any)[member]);
  });

  it("answers the partition, ROM-page and disassembly questions the same way", () => {
    expect(wasm.getPartitionLabels()).toEqual(ts.getPartitionLabels());
    expect(wasm.getPartitionGroups()).toEqual(ts.getPartitionGroups());
    expect(wasm.getPartitionDescriptions()).toEqual(ts.getPartitionDescriptions());
    for (const label of ["0", "3f", "FF", "100", "x"]) {
      expect(wasm.parsePartitionLabel(label)).toBe(ts.parsePartitionLabel(label));
    }
    expect(wasm.getRomFlags()).toEqual(ts.getRomFlags());
    expect(wasm.getSelectedRomPage()).toBe(ts.getSelectedRomPage());
    expect(wasm.getSelectedRamBank()).toBe(ts.getSelectedRamBank());
    for (const options of [{}, { ram: true }, { screen: true }, { ram: true, screen: true }]) {
      expect(wasm.getDisassemblySections(options)).toEqual(ts.getDisassemblySections(options));
    }
  });

  it("uses the same key codes and default key mapping", () => {
    expect(wasm.getKeyCodeSet()).toBe(ts.getKeyCodeSet());
    expect(wasm.getDefaultKeyMapping()).toBe(ts.getDefaultKeyMapping());
  });

  it("has the same code-injection stub (follow-up F4)", async () => {
    expect(await wasm.getCodeInjectionFlow("OZ50")).toEqual(await ts.getCodeInjectionFlow("OZ50"));
    expect(wasm.injectCodeToRun({} as any)).toBe(ts.injectCodeToRun({} as any));
  });

  it("sizes the internal RAM from MC_Z88_INTRAM as the TypeScript banked memory does", () => {
    for (const mask of [0x01, 0x07, 0x1f, undefined]) {
      const machine = new Z88WasmV2Machine(model, { [MC_Z88_INTRAM]: mask });
      expect(machine.internalRam).toEqual({ kind: "RAM", sizeInBytes: z88InternalRamSizeInBytes(mask ?? 0x1f) });
    }
  });
});

describe("Cambridge Z88 WASM machine - setup (same as the TypeScript machine)", () => {
  it.each(models())("%s: loads the same slot-0 image, ROM properties and keyboard layout", async (model) => {
    const ts = await createHarnessZ88Machine({ backend: "typescript", model, rom: "model" });
    const wasm = await createHarnessZ88Machine({ backend: "wasm", model, rom: "model" });

    expect(wasm.getMachineProperty(MC_Z88_INTROM)).toBe(ts.getMachineProperty(MC_Z88_INTROM));
    expect(wasm.getMachineProperty(MC_Z88_USE_DEFAULT_ROM)).toBe(ts.getMachineProperty(MC_Z88_USE_DEFAULT_ROM));
    expect(sentSettings(wasm)).toEqual(sentSettings(ts));

    const romSize = wasm.getMachineProperty(MC_Z88_INTROM) as number;
    for (let bank = 0; bank < romSize / 0x4000; bank++) {
      expect(wasm.getMemoryPartition(bank), `bank ${bank}`).toEqual(ts.getMemoryPartition(bank));
    }
  });

  it("loads the core once, however often it is set up", async () => {
    let reads = 0;
    const wasm = new Z88WasmV2Machine(undefined, undefined, new ResolvingMessenger(), {
      artifactName: "z88-once.wasm",
      readArtifact: async () => {
        reads++;
        return z88WasmArtifactBytes();
      }
    });
    wasm.setMachineProperty(FILE_PROVIDER, new HarnessFileProvider());
    await wasm.setup();
    const runtime = wasm.wasmV2Runtime;
    await wasm.hardReset();
    await wasm.setup();
    expect(wasm.wasmV2Runtime).toBe(runtime);
    expect(reads).toBe(1);
  });

  it("a blank core holds the blank 512K ROM card in slot 0, as a constructed TypeScript machine does", async () => {
    const wasm = (await createHarnessZ88Machine({ backend: "wasm" })) as Z88WasmV2Machine;
    expect(wasm.getInsertedCard(0)).toEqual({ kind: "ROM", sizeInBytes: 0x08_0000 });
    for (const slot of [1, 2, 3]) expect(wasm.getInsertedCard(slot)).toBeUndefined();
    expect(wasm.directReadMemory(0)).toBe(0);
  });

  it.each([
    [undefined, 640, 64],
    ["640x320", 640, 320],
    ["640x480", 640, 480],
    ["800x320", 800, 320],
    ["800x480", 800, 480]
  ])("LCD size %s: %i x %i, and the pixel buffer is exactly the LCD", async (size, width, height) => {
    const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
    const config = { ...model.config, [MC_SCREEN_SIZE]: size };
    const ts = await createHarnessZ88Machine({ backend: "typescript", config, rom: "model" });
    const wasm = (await createHarnessZ88Machine({ backend: "wasm", config, rom: "model" })) as Z88WasmV2Machine;

    expect([wasm.screenWidthInPixels, wasm.screenHeightInPixels]).toEqual([width, height]);
    expect([wasm.screenWidthInPixels, wasm.screenHeightInPixels]).toEqual([
      ts.screenWidthInPixels,
      ts.screenHeightInPixels
    ]);
    expect(wasm.getPixelBuffer()).toHaveLength(width * height);
    expect(wasm.getPixelBufferBytes()).toHaveLength(width * height * 4);
    // --- A view of the core's buffer, not a copy
    expect(wasm.getPixelBuffer().buffer).toBe(wasm.wasmV2Runtime!.exports.memory.buffer);
  });
});

describe("Cambridge Z88 WASM machine - cards (same as the TypeScript machine)", () => {
  /** A file provider that also serves card images by name */
  class CardFiles extends HarnessFileProvider {
    constructor(private readonly files: Record<string, Uint8Array>) {
      super();
    }
    override async readBinaryFile(path: string): Promise<Uint8Array> {
      return this.files[path] ?? super.readBinaryFile(path);
    }
  }

  async function both(slots: Record<string, unknown>, files: Record<string, Uint8Array>) {
    const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
    const results: Z88HarnessMachine[] = [];
    for (const backend of ["typescript", "wasm"] as const) {
      const machine = await createHarnessZ88Machine({ backend, model: model.modelId, rom: "model" });
      machine.setMachineProperty(FILE_PROVIDER, new CardFiles(files));
      machine.dynamicConfig = slots;
      results.push(machine);
    }
    return results;
  }

  it("hot-plugs card images into the same physical memory", async () => {
    const ram = new Uint8Array(0x8000).map((_, i) => (i * 7) & 0xff);
    const rom = new Uint8Array(0x2_0000).map((_, i) => (i * 13 + 1) & 0xff);
    const [ts, wasm] = await both(
      {
        [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "ram.bin" },
        [MC_Z88_SLOT2]: { size: 128, cardType: "ROM", file: "rom.bin" }
      },
      { "ram.bin": ram, "rom.bin": rom }
    );
    await ts.configure();
    await wasm.configure();

    for (const offset of [0, 1, 0x1234, 0x7fff]) {
      expect(wasm.directReadMemory(SLOT + offset)).toBe(ram[offset]);
      expect(wasm.directReadMemory(SLOT + offset)).toBe(ts.directReadMemory(SLOT + offset));
    }
    for (const offset of [0, 0x1_0000, 0x1_ffff]) {
      expect(wasm.directReadMemory(2 * SLOT + offset)).toBe(rom[offset]);
      expect(wasm.directReadMemory(2 * SLOT + offset)).toBe(ts.directReadMemory(2 * SLOT + offset));
    }
    const w = wasm as Z88WasmV2Machine;
    expect(w.getInsertedCard(1)).toEqual({ kind: "RAM", sizeInBytes: 0x8000 });
    expect(w.getInsertedCard(2)).toEqual({ kind: "ROM", sizeInBytes: 0x2_0000 });
    expect(w.getInsertedCard(3)).toBeUndefined();
  });

  it("an AMD flash card takes the chip's size, whatever the configuration says", async () => {
    const [, wasm] = await both({ [MC_Z88_SLOT3]: { size: 512, cardType: CardIds.AMDF29F080B } }, {});
    await wasm.configure();
    expect((wasm as Z88WasmV2Machine).getInsertedCard(3)).toEqual({
      kind: "AMD_FLASH_29F080B",
      sizeInBytes: 0x10_0000
    });
  });

  it("removing a card keeps its bytes in physical memory", async () => {
    const ram = new Uint8Array(0x8000).fill(0x5a);
    const [ts, wasm] = await both({ [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "ram.bin" } }, {
      "ram.bin": ram
    });
    for (const machine of [ts, wasm]) {
      await machine.configure();
      machine.dynamicConfig = { [MC_Z88_SLOT1]: { size: 0, cardType: "-" } };
      await machine.configure();
    }
    expect((wasm as Z88WasmV2Machine).getInsertedCard(1)).toBeUndefined();
    expect(wasm.directReadMemory(SLOT)).toBe(0x5a);
    expect(wasm.directReadMemory(SLOT)).toBe(ts.directReadMemory(SLOT));
  });

  it.each([
    [
      "an image of the wrong size",
      { [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "short.bin" } },
      "Invalid initial content size (100/32768)"
    ],
    [
      "an unknown card type (EPROMUV256, follow-up F2)",
      { [MC_Z88_SLOT2]: { size: 256, cardType: CardIds.EPROMUV256 } },
      "Unknown card type: EPROMUV256"
    ],
    [
      "an invalid card size",
      { [MC_Z88_SLOT2]: { size: 48, cardType: CardIds.RAM32 } },
      "Invalid card size: 48"
    ]
  ])("rejects %s with the TypeScript machine's error", async (_what, slots, message) => {
    const [ts, wasm] = await both(slots, { "short.bin": new Uint8Array(100) });
    await expect(ts.configure()).rejects.toThrow(message);
    await expect(wasm.configure()).rejects.toThrow(message);
  });
});

describe("Cambridge Z88 WASM machine - reset and power-on", () => {
  it("hard reset clears the internal RAM, keeps and re-inserts the cards", async () => {
    const wasm = (await createHarnessZ88Machine({ backend: "wasm", model: "OZ40", rom: "model" })) as Z88WasmV2Machine;
    const memory = wasm.wasmV2Runtime!.memory;
    const romByte = memory[0x1234];
    memory[0x08_0100] = 0x55;
    memory[0x1234] = romByte ^ 0xff;

    await wasm.hardReset();

    expect(memory[0x08_0100]).toBe(0x00);
    // --- The ROM image was re-inserted from its file
    expect(memory[0x1234]).toBe(romByte);
    expect(wasm.getInsertedCard(0)).toEqual({ kind: "ROM", sizeInBytes: 0x2_0000 });
  });

  it("reset keeps memory, clears the keystroke queue and the sleep flag, and resets the CPU", async () => {
    const wasm = (await createHarnessZ88Machine({ backend: "wasm", rom: "model" })) as Z88WasmV2Machine;
    const memory = wasm.wasmV2Runtime!.memory;
    memory[0x08_0100] = 0x55;
    wasm.queueKeystroke(1, 2, Z88KeyCode.A);
    wasm.isInSleepMode = true;

    wasm.reset();

    expect(memory[0x08_0100]).toBe(0x55);
    expect(wasm.getKeyQueueLength()).toBe(0);
    expect(wasm.isInSleepMode).toBe(false);
    expect(wasm.tactsInFrame).toBe(16384);
    const cpu = wasm.getCpuState() as Z80CpuState;
    expect([cpu.pc, cpu.sp, cpu.af]).toEqual([0x0000, 0xffff, 0xffff]);
  });
});

describe("Cambridge Z88 WASM machine - host behaviour", () => {
  it("queues and plays keystrokes as the TypeScript machine does (primary, secondary, release)", () => {
    const machine = new RecordingZ88WasmMachine();
    machine.queueKeystroke(1, 2, Z88KeyCode.A, Z88KeyCode.ShiftL);
    expect(machine.getKeyQueueLength()).toBe(1);

    machine.tacts = 16384 - 1;
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([]);

    machine.tacts = 16384;
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([`key ${Z88KeyCode.A} down`, `key ${Z88KeyCode.ShiftL} down`]);

    machine.tacts = 3 * 16384 + 1;
    machine.emulateKeystroke();
    expect(machine.calls.slice(2)).toEqual([`key ${Z88KeyCode.A} up`, `key ${Z88KeyCode.ShiftL} up`]);
    expect(machine.getKeyQueueLength()).toBe(0);
  });

  it("dispatches the machine-menu commands", async () => {
    vi.useFakeTimers();
    try {
      const machine = new RecordingZ88WasmMachine();
      await machine.executeCustomCommand("flap_open");
      await machine.executeCustomCommand("flap_close");
      await machine.executeCustomCommand("battery_low");
      const shifts = machine.executeCustomCommand("press_shifts");
      await vi.advanceTimersByTimeAsync(400);
      await shifts;
      expect(machine.calls).toEqual([
        "flap opened",
        "flap closed",
        "battery low",
        `key ${Z88KeyCode.ShiftL} down`,
        `key ${Z88KeyCode.ShiftR} down`,
        `key ${Z88KeyCode.ShiftL} up`,
        `key ${Z88KeyCode.ShiftR} up`
      ]);

      // --- battery_low while asleep presses both shifts first
      machine.calls.length = 0;
      machine.isInSleepMode = true;
      const low = machine.executeCustomCommand("battery_low");
      await vi.advanceTimersByTimeAsync(400);
      await low;
      expect(machine.calls.at(-1)).toBe("battery low");
      expect(machine.calls).toHaveLength(5);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Cambridge Z88 WASM machine - keys, audio, picture and sleep reach the core", () => {
  it("a key sets its bit in the core's matrix and releasing clears it", async () => {
    const machine = (await createHarnessZ88Machine({ backend: "wasm" })) as Z88WasmV2Machine;
    const w = machine.wasmV2Runtime!.exports;
    machine.setKeyStatus(Z88KeyCode.A, true);
    expect(w.z88GetKeyLine(Z88KeyCode.A >> 3)).toBe(1 << (Z88KeyCode.A & 7));
    expect(w.z88GetKeyPressed()).toBe(1);
    machine.setKeyStatus(Z88KeyCode.A, false);
    expect(w.z88GetKeyLine(Z88KeyCode.A >> 3)).toBe(0);
    expect(w.z88GetKeyPressed()).toBe(0);
  });

  it("the audio samples are one frame's worth, in an array reused from frame to frame", async () => {
    const machine = (await createHarnessZ88Machine({ backend: "wasm", audioSampleRate: 44_100 })) as Z88WasmV2Machine;
    machine.executeMachineFrame();
    const first = machine.getAudioSamples();
    // --- 5 ms of 44.1 kHz: 220 or 221 samples
    expect(first.length).toBeGreaterThanOrEqual(220);
    expect(first.length).toBeLessThanOrEqual(221);
    const firstSample = first[0];
    machine.executeMachineFrame();
    const second = machine.getAudioSamples();
    expect(second).toBe(first);
    expect(second[0]).toBe(firstSample);
    expect(second.length).toBe(machine.wasmV2Runtime!.exports.z88GetAudioSampleCount());
  });

  it("the sample rate is handed to the core at reset, as the TypeScript machine hands it to its beeper", async () => {
    const machine = (await createHarnessZ88Machine({ backend: "wasm", audioSampleRate: 44_100 })) as Z88WasmV2Machine;
    const w = machine.wasmV2Runtime!.exports;
    expect(w.z88GetAudioSampleRate()).toBe(44_100);
    machine.setMachineProperty(AUDIO_SAMPLE_RATE, 22_050);
    expect(w.z88GetAudioSampleRate()).toBe(44_100);
    machine.reset();
    expect(w.z88GetAudioSampleRate()).toBe(22_050);
  });

  it("the instant screen is the current picture: the core's buffer, no copy", async () => {
    const machine = (await createHarnessZ88Machine({ backend: "wasm" })) as Z88WasmV2Machine;
    expect(machine.renderInstantScreen()).toBe(machine.getPixelBuffer());
  });

  it("the sleep state follows the core after every frame", async () => {
    const session = await createZ88Session({ backend: "wasm" });
    const machine = session.machine as Z88WasmV2Machine;
    // --- HALT with I = $3F: sleep mode is detected at the start of the next frame
    await session.loadCode(`
      .org $8000
start: di
      halt
    `, { entry: "start" });
    session.setRegisters({ ir: 0x3f00 });
    session.runFrames(2);
    expect(machine.wasmV2Runtime!.exports.z88GetSleepMode()).toBe(1);
    expect(machine.isInSleepMode).toBe(true);
    machine.reset();
    expect(machine.isInSleepMode).toBe(false);
  });
});

describe("Cambridge Z88 WASM machine - lifecycle guard", () => {
  it("a machine that was never set up says so", () => {
    expect(() => new Z88WasmV2Machine().directReadMemory(0)).toThrow("call setup() first");
  });
});

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
import { Z88WasmV2Machine } from "@emu/machines/z88/Z88WasmV2Machine";
import { CardIds } from "@emu/machines/z88/CardIds";
import { Z88KeyCode } from "@emu/machines/z88/Z88KeyCode";
import { z88KeyMappings } from "@emu/machines/z88/Z88KeyMappings";
import {
  parseZ88PartitionLabel,
  Z88_NO_CODE_INJECTION,
  z88DisassemblySections,
  z88PartitionDescriptions,
  z88PartitionGroups,
  z88PartitionLabels,
  z88RomFlags
} from "@emu/machines/z88/z88MachineInfo";
import { z88InternalRamSizeInBytes } from "@emu/machines/z88/z88CardCatalog";
import {
  createHarnessZ88Machine,
  createZ88Session,
  HarnessFileProvider,
  ResolvingMessenger,
  z88WasmArtifactBytes
} from "../../harness/z88";
import { goldens } from "./z88-goldens";

/*
 * The WASM Cambridge Z88 as a machine (Steps 2-9 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`):
 * the host plumbing - identity, setup, cards, the IDE's questions - and how the adapter hands keys,
 * audio samples, the picture and the sleep state between the app and the core.
 *
 * Until the TypeScript machine was removed these were compared with it side by side; its answers are
 * now fixed values, or the goldens in `goldens/wasm-z88-machine.json` (`z88-goldens.ts`).
 */

const golden = goldens("wasm-z88-machine");

const SLOT = 0x10_0000;

function models(): string[] {
  return machineRegistry
    .find((m) => m.machineId === "z88")
    .models.map((m) => m.modelId);
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

describe("Cambridge Z88 WASM machine - identity and metadata", () => {
  const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
  const wasm = new Z88WasmV2Machine(model, model.config);

  it.each([
    ["machineId", "z88"],
    ["romId", "z88"],
    ["uiFrameFrequency", 8],
    ["softResetOnFirstStart", true],
    ["baseClockFrequency", 3_276_800],
    ["clockMultiplier", 1],
    ["delayedAddressBus", false],
    ["tactsInFrame", 16_384],
    ["isOsInitialized", true],
    ["isInSleepMode", false]
  ])("%s", (member, expected) => {
    expect((wasm as any)[member]).toEqual(expected);
  });

  it("answers the partition, ROM-page and disassembly questions from the shared machine info", () => {
    expect(wasm.getPartitionLabels()).toEqual(z88PartitionLabels());
    expect(wasm.getPartitionGroups()).toEqual(z88PartitionGroups());
    expect(wasm.getPartitionDescriptions()).toEqual(z88PartitionDescriptions());
    for (const [label, bank] of [
      ["0", 0x00],
      ["3f", 0x3f],
      ["FF", 0xff],
      ["100", undefined],
      ["x", undefined]
    ] as const) {
      expect(wasm.parsePartitionLabel(label)).toBe(bank);
      expect(parseZ88PartitionLabel(label)).toBe(bank);
    }
    expect(wasm.getRomFlags()).toEqual(z88RomFlags());
    expect(wasm.getSelectedRomPage()).toBe(0);
    expect(wasm.getSelectedRamBank()).toBe(0);
    for (const options of [{}, { ram: true }, { screen: true }, { ram: true, screen: true }]) {
      expect(wasm.getDisassemblySections(options)).toEqual(z88DisassemblySections(options));
      expect(wasm.getDisassemblySections(options)).toEqual([{ startAddress: 0x0000, endAddress: 0xffff, sectionType: 1 }]);
    }
  });

  it("uses the Z88 key codes and default key mapping", () => {
    expect(wasm.getKeyCodeSet()).toBe(Z88KeyCode);
    expect(wasm.getDefaultKeyMapping()).toBe(z88KeyMappings);
  });

  it("refuses code injection (follow-up F4: no delivery route on the Z88)", async () => {
    await expect(wasm.getCodeInjectionFlow("OZ50")).rejects.toThrow(Z88_NO_CODE_INJECTION);
    expect(() => wasm.injectCodeToRun({} as any)).toThrow(Z88_NO_CODE_INJECTION);
  });

  it("sizes the internal RAM from MC_Z88_INTRAM", () => {
    for (const mask of [0x01, 0x07, 0x1f, undefined]) {
      const machine = new Z88WasmV2Machine(model, { [MC_Z88_INTRAM]: mask });
      expect(machine.internalRam).toEqual({ kind: "RAM", sizeInBytes: z88InternalRamSizeInBytes(mask ?? 0x1f) });
    }
  });
});

describe("Cambridge Z88 WASM machine - setup", () => {
  it.each(models())("%s: loads the recorded slot-0 image, ROM properties and keyboard layout", async (model) => {
    const machine = await createHarnessZ88Machine({ model, rom: "model" });

    const romSize = machine.getMachineProperty(MC_Z88_INTROM) as number;
    golden.expect(`setup ${model}`, {
      intRom: romSize,
      useDefaultRom: machine.getMachineProperty(MC_Z88_USE_DEFAULT_ROM),
      settings: sentSettings(machine),
      romBanks: Array.from({ length: romSize / 0x4000 }, (_, bank) => machine.getMemoryPartition(bank))
    });
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

  it("a blank core holds the blank 512K ROM card in slot 0", async () => {
    const wasm = (await createHarnessZ88Machine()) as Z88WasmV2Machine;
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
    const wasm = (await createHarnessZ88Machine({ config, rom: "model" })) as Z88WasmV2Machine;

    expect([wasm.screenWidthInPixels, wasm.screenHeightInPixels]).toEqual([width, height]);
    expect(wasm.getPixelBuffer()).toHaveLength(width * height);
    expect(wasm.getPixelBufferBytes()).toHaveLength(width * height * 4);
    // --- A view of the core's buffer, not a copy
    expect(wasm.getPixelBuffer().buffer).toBe(wasm.wasmV2Runtime!.exports.memory.buffer);
  });
});

describe("Cambridge Z88 WASM machine - cards", () => {
  /** A file provider that also serves card images by name */
  class CardFiles extends HarnessFileProvider {
    constructor(private readonly files: Record<string, Uint8Array>) {
      super();
    }
    override async readBinaryFile(path: string): Promise<Uint8Array> {
      return this.files[path] ?? super.readBinaryFile(path);
    }
  }

  async function machineWith(slots: Record<string, unknown>, files: Record<string, Uint8Array>) {
    const model = machineRegistry.find((m) => m.machineId === "z88").models[0];
    const machine = (await createHarnessZ88Machine({
      model: model.modelId,
      rom: "model"
    })) as Z88WasmV2Machine;
    machine.setMachineProperty(FILE_PROVIDER, new CardFiles(files));
    machine.dynamicConfig = slots;
    return machine;
  }

  it("hot-plugs card images into the same physical memory", async () => {
    const ram = new Uint8Array(0x8000).map((_, i) => (i * 7) & 0xff);
    const rom = new Uint8Array(0x2_0000).map((_, i) => (i * 13 + 1) & 0xff);
    const wasm = await machineWith(
      {
        [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "ram.bin" },
        [MC_Z88_SLOT2]: { size: 128, cardType: "ROM", file: "rom.bin" }
      },
      { "ram.bin": ram, "rom.bin": rom }
    );
    await wasm.configure();

    for (const offset of [0, 1, 0x1234, 0x7fff]) {
      expect(wasm.directReadMemory(SLOT + offset)).toBe(ram[offset]);
    }
    for (const offset of [0, 0x1_0000, 0x1_ffff]) {
      expect(wasm.directReadMemory(2 * SLOT + offset)).toBe(rom[offset]);
    }
    const w = wasm;
    expect(w.getInsertedCard(1)).toEqual({ kind: "RAM", sizeInBytes: 0x8000 });
    expect(w.getInsertedCard(2)).toEqual({ kind: "ROM", sizeInBytes: 0x2_0000 });
    expect(w.getInsertedCard(3)).toBeUndefined();
  });

  it("an AMD flash card takes the chip's size, whatever the configuration says", async () => {
    const wasm = await machineWith({ [MC_Z88_SLOT3]: { size: 512, cardType: CardIds.AMDF29F080B } }, {});
    await wasm.configure();
    expect(wasm.getInsertedCard(3)).toEqual({
      kind: "AMD_FLASH_29F080B",
      sizeInBytes: 0x10_0000
    });
  });

  it("removing a card keeps its bytes in physical memory", async () => {
    const ram = new Uint8Array(0x8000).fill(0x5a);
    const wasm = await machineWith({ [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "ram.bin" } }, {
      "ram.bin": ram
    });
    await wasm.configure();
    wasm.dynamicConfig = { [MC_Z88_SLOT1]: { size: 0, cardType: "-" } };
    await wasm.configure();
    expect(wasm.getInsertedCard(1)).toBeUndefined();
    expect(wasm.directReadMemory(SLOT)).toBe(0x5a);
  });

  it.each([
    [
      "an image of the wrong size",
      { [MC_Z88_SLOT1]: { size: 32, cardType: CardIds.RAM32, file: "short.bin" } },
      "Invalid initial content size (100/32768)"
    ],
    [
      "an unknown card type",
      { [MC_Z88_SLOT2]: { size: 256, cardType: "EPROMUV512" } },
      "Unknown card type: EPROMUV512"
    ],
    [
      "an invalid card size",
      { [MC_Z88_SLOT2]: { size: 48, cardType: CardIds.RAM32 } },
      "Invalid card size: 48"
    ]
  ])("rejects %s", async (_what, slots, message) => {
    const wasm = await machineWith(slots, { "short.bin": new Uint8Array(100) });
    await expect(wasm.configure()).rejects.toThrow(message);
  });
});

describe("Cambridge Z88 WASM machine - reset and power-on", () => {
  it("hard reset clears the internal RAM, keeps and re-inserts the cards", async () => {
    const wasm = (await createHarnessZ88Machine({ model: "OZ40", rom: "model" })) as Z88WasmV2Machine;
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
    const wasm = (await createHarnessZ88Machine({ rom: "model" })) as Z88WasmV2Machine;
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
  /*
   * The core's tact counter is 32 bits and wraps after about 22 minutes. A keystroke queued just
   * before the wrap used to stay pressed for good - its end tact, computed in JS numbers, stayed
   * "ahead" of the wrapped counter - and one starting past 2^32 never began, blocking the queue
   * (issue #1374). The test machine's `tacts` is set to what the core's counter reports.
   */
  it("plays a keystroke across the 32-bit tact counter wrap", () => {
    const machine = new RecordingZ88WasmMachine();
    const WRAP = 2 ** 32;
    const start = WRAP - 16384 / 2; // --- half a frame before the wrap
    machine.tacts = start;
    machine.queueKeystroke(1, 2, Z88KeyCode.A);

    // --- Pressed from start + 1 frame (past the wrap), released after start + 3 frames
    machine.tacts = start + 16384 - 1 - WRAP;
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([]);

    machine.tacts = start + 16384 - WRAP;
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([`key ${Z88KeyCode.A} down`]);

    machine.tacts = start + 3 * 16384 + 1 - WRAP;
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([`key ${Z88KeyCode.A} down`, `key ${Z88KeyCode.A} up`]);
    expect(machine.getKeyQueueLength()).toBe(0);
  });

  it("releases a keystroke pressed before the wrap once the counter has wrapped", () => {
    const machine = new RecordingZ88WasmMachine();
    const WRAP = 2 ** 32;
    const start = WRAP - 3 * 16384;
    machine.tacts = start;
    machine.queueKeystroke(0, 2, Z88KeyCode.A);
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([`key ${Z88KeyCode.A} down`]);

    // --- The end (start + 2 frames) is before the wrap; the counter reads small numbers now
    machine.tacts = 100;
    machine.emulateKeystroke();
    expect(machine.calls).toEqual([`key ${Z88KeyCode.A} down`, `key ${Z88KeyCode.A} up`]);
  });

  it("queues and plays keystrokes (primary, secondary, release)", () => {
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
    const machine = (await createHarnessZ88Machine()) as Z88WasmV2Machine;
    const w = machine.wasmV2Runtime!.exports;
    machine.setKeyStatus(Z88KeyCode.A, true);
    expect(w.z88GetKeyLine(Z88KeyCode.A >> 3)).toBe(1 << (Z88KeyCode.A & 7));
    expect(w.z88GetKeyPressed()).toBe(1);
    machine.setKeyStatus(Z88KeyCode.A, false);
    expect(w.z88GetKeyLine(Z88KeyCode.A >> 3)).toBe(0);
    expect(w.z88GetKeyPressed()).toBe(0);
  });

  it("the audio samples are one frame's worth, in an array reused from frame to frame", async () => {
    const machine = (await createHarnessZ88Machine({ audioSampleRate: 44_100 })) as Z88WasmV2Machine;
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

  it("the samples keep coming when the 32-bit tact counter wraps (issue #1374)", async () => {
    // --- 2^32 tacts is about 22 minutes at 1x. Start the schedule just short of the wrap, as it
    // --- stands after that long a session, and run across it.
    const machine = (await createHarnessZ88Machine({ audioSampleRate: 44_100 })) as Z88WasmV2Machine;
    const w = machine.wasmV2Runtime!.exports;
    w.z88SetTacts(2 ** 32 - 3 * 16_384);
    w.z88SetAudioSampleRate(44_100, Math.exp((-2 * Math.PI * 1.4) / 44_100));
    for (let frame = 0; frame < 8; frame++) {
      machine.executeMachineFrame();
      const count = w.z88GetAudioSampleCount();
      expect(count, `frame ${frame}`).toBeGreaterThanOrEqual(220);
      expect(count, `frame ${frame}`).toBeLessThanOrEqual(221);
    }
    expect(w.z88GetTacts(), "the counter did wrap").toBeLessThan(8 * 16_384);
    expect(w.z88GetAudioOverflows()).toBe(0);
  });

  it("the sample rate is handed to the core at reset", async () => {
    const machine = (await createHarnessZ88Machine({ audioSampleRate: 44_100 })) as Z88WasmV2Machine;
    const w = machine.wasmV2Runtime!.exports;
    expect(w.z88GetAudioSampleRate()).toBe(44_100);
    machine.setMachineProperty(AUDIO_SAMPLE_RATE, 22_050);
    expect(w.z88GetAudioSampleRate()).toBe(44_100);
    machine.reset();
    expect(w.z88GetAudioSampleRate()).toBe(22_050);
  });

  it("the instant screen is the current picture: the core's buffer, no copy", async () => {
    const machine = (await createHarnessZ88Machine()) as Z88WasmV2Machine;
    expect(machine.renderInstantScreen()).toBe(machine.getPixelBuffer());
  });

  it("the sleep state follows the core after every frame", async () => {
    const session = await createZ88Session();
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

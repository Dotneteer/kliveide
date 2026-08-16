import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@common/messaging/messages-core";
import { MessengerBase } from "@common/messaging/MessengerBase";
import { OFFS_NEXT_RAM } from "@emu/machines/zxNext/MemoryDevice";
import {
  createOracleZxNextMachine,
  createTestZxNextRomSet,
  createTestZxNextWasmMachine,
  testRom
} from "./wasm-next-test-helpers";

const SCREEN_WIDTH = 720;
const DISPLAY_X = 96;
const DISPLAY_Y_50HZ = 48;
const BANK_5_BASE = OFFS_NEXT_RAM + 5 * 0x4000;
const LAYER2_PORT = 0x123b;

describe("ZX Spectrum Next WASM v2 early boot/storage/ULA smoke", () => {
  it("returns the TypeScript fallback value and records the owner step for unsupported ports", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);
    const wasm = wasmMachine.wasmV2Runtime!.exports;

    expect(wasm.zxnextReadPort(LAYER2_PORT)).toBe(oracleMachine.doReadPort(LAYER2_PORT));

    const diagnostics = wasmMachine.getWasmV2Diagnostics();
    expect(diagnostics.unsupportedPortReadCount).toBe(1);
    expect(diagnostics.unsupportedPortWriteCount).toBe(0);
    expect(diagnostics.firstUnsupportedPortAddress).toBe(LAYER2_PORT);
    expect(diagnostics.firstUnsupportedPortValue).toBe(0x00);
    expect(diagnostics.firstUnsupportedPortIsWrite).toBe(false);
    expect(diagnostics.firstUnsupportedPortOwnerStep).toBe(22);
    expect(diagnostics.diagnosticFlags & 0x01).toBe(0x01);
  });

  it("executes ROM frames, renders visible ULA pixels, and logs unsupported boot-time ports", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: testRom([
        0x31, 0xff, 0xff,       // LD SP,0xffff
        0x21, 0x00, 0x40,       // LD HL,0x4000
        0x36, 0x80,             // LD (HL),0x80
        0x21, 0x00, 0x58,       // LD HL,0x5800
        0x36, 0x47,             // LD (HL),0x47
        0x01, 0x3b, 0x12,       // LD BC,0x123b
        0xed, 0x78,             // IN A,(C)
        0xed, 0x79,             // OUT (C),A
        0xc3, 0x10, 0x00        // JP 0x0010
      ], 0x10000)
    }));

    machine.executeMachineFrame();

    const diagnostics = machine.getWasmV2Diagnostics();
    const displayPixel = DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X;
    expect(diagnostics.frames).toBe(1);
    expect(diagnostics.cpuPc).not.toBe(0);
    expect(diagnostics.screenRenderCount).toBe(1);
    expect(machine.getPixelBuffer()[displayPixel]).toBe(defaultUlaBgra(15));
    expect(diagnostics.unsupportedPortReadCount).toBeGreaterThan(0);
    expect(diagnostics.unsupportedPortWriteCount).toBeGreaterThan(0);
    expect(diagnostics.firstUnsupportedPortAddress).toBe(LAYER2_PORT);
    expect(diagnostics.firstUnsupportedPortOwnerStep).toBe(22);
    expect(machine.wasmV2Runtime!.diagnosticBuffer[1]).toBe(diagnostics.unsupportedPortReadCount);
    expect(machine.wasmV2Runtime!.diagnosticBuffer[2]).toBe(diagnostics.unsupportedPortWriteCount);
  });

  it("boots through a CPU-driven SD sector read and renders storage-backed ULA pixels", async () => {
    const machine = await createTestZxNextWasmMachine(createTestZxNextRomSet({
      next: buildStorageBootRom()
    }));
    const sector = new Uint8Array(512);
    sector[0] = 0x7e;
    const messenger = new BootStorageMessenger(sector);

    machine.executeMachineFrame();

    expect(machine.getFrameCommand()).toEqual({ command: "sd-read", sector: 2 });
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      frames: 1,
      sdCommandCount: 1,
      sdReadRequestCount: 1,
      sdPendingCommand: 1
    });

    await machine.processFrameCommand(messenger);
    machine.setFrameCommand(null);
    machine.executeMachineFrame();

    const diagnostics = machine.getWasmV2Diagnostics();
    expect(messenger.methodCalls).toEqual(["getSdCardInfo", "readSdCardSector"]);
    expect(messenger.readSectors).toEqual([2]);
    expect(machine.wasmV2Runtime!.exports.zxnextReadPhysical(BANK_5_BASE + 1)).toBe(0x7e);
    expect(diagnostics.frames).toBe(2);
    expect(diagnostics.sdPendingCommand).toBe(0);
    expect(diagnostics.sdCommandCount).toBe(1);
    expect(diagnostics.sdReadRequestCount).toBe(1);
    expect(diagnostics.unsupportedPortReadCount).toBe(0);
    expect(diagnostics.unsupportedPortWriteCount).toBe(0);
    expect(diagnostics.screenRenderCount).toBe(2);
    expect(diagnostics.screenNonBlankPixelCount).toBeGreaterThan(0);
    expect(machine.getPixelBuffer()[DISPLAY_Y_50HZ * SCREEN_WIDTH + DISPLAY_X + 18]).toBe(defaultUlaBgra(15));
  });
});

function buildStorageBootRom(): Uint8Array {
  const bytes: number[] = [];
  const labels = new Map<string, number>();
  const patches: Array<{ offsetIndex: number; label: string }> = [];
  const emit = (...values: number[]) => bytes.push(...values.map(value => value & 0xff));
  const label = (name: string) => labels.set(name, bytes.length);
  const jr = (opcode: number, target: string) => {
    emit(opcode, 0x00);
    patches.push({ offsetIndex: bytes.length - 1, label: target });
  };
  const outSpi = (value: number) => emit(0x3e, value, 0xed, 0x79); // LD A,value; OUT (C),A

  emit(
    0x31, 0xff, 0xff,       // LD SP,0xffff
    0x21, 0x00, 0x40,       // LD HL,0x4000
    0x36, 0x80,             // LD (HL),0x80
    0x21, 0x01, 0x40,       // LD HL,0x4001
    0x36, 0x00,             // LD (HL),0x00
    0x21, 0x00, 0x58,       // LD HL,0x5800
    0x36, 0x47,             // LD (HL),0x47
    0x21, 0x01, 0x58,       // LD HL,0x5801
    0x36, 0x47,             // LD (HL),0x47
    0x01, 0xe7, 0x00,       // LD BC,0x00e7
    0x3e, 0x02,             // LD A,0x02
    0xed, 0x79,             // OUT (C),A
    0x01, 0xeb, 0x00        // LD BC,0x00eb
  );
  for (const byte of [0x51, 0x00, 0x00, 0x00, 0x02, 0xff]) {
    outSpi(byte);
  }

  label("wait_response");
  emit(0xed, 0x78, 0xfe, 0xff); // IN A,(C); CP 0xff
  jr(0x28, "wait_response");    // JR Z,wait_response
  emit(0xed, 0x78);             // IN A,(C), consume 0xff gap byte

  label("wait_token");
  emit(0xed, 0x78, 0xfe, 0xfe); // IN A,(C); CP 0xfe
  jr(0x20, "wait_token");       // JR NZ,wait_token
  emit(
    0xed, 0x78,                 // IN A,(C), first sector byte
    0x32, 0x01, 0x40,           // LD (0x4001),A
    0x76                        // HALT
  );

  for (const patch of patches) {
    const target = labels.get(patch.label);
    if (target == null) throw new Error(`Missing label ${patch.label}`);
    const offset = target - (patch.offsetIndex + 1);
    if (offset < -128 || offset > 127) throw new Error(`JR offset out of range for ${patch.label}`);
    bytes[patch.offsetIndex] = offset & 0xff;
  }
  return testRom(bytes, 0x10000);
}

class BootStorageMessenger extends MessengerBase {
  readonly methodCalls: string[] = [];
  readonly readSectors: number[] = [];

  constructor(private readonly sector: Uint8Array) {
    super();
  }

  get requestChannel(): Channel {
    return "emu";
  }

  get responseChannel(): Channel {
    return "ide";
  }

  protected send(message: RequestMessage): void {
    const method = (message as any).method;
    const args = (message as any).args ?? [];
    this.methodCalls.push(method);
    let result: unknown;
    if (method === "getSdCardInfo") {
      result = { totalSectors: 4096 };
    } else if (method === "readSdCardSector") {
      this.readSectors.push(args[0]);
      result = this.sector;
    } else {
      result = { success: true, persistenceConfirmed: true };
    }
    this.processResponse({
      type: "ApiMethodResponse",
      correlationId: message.correlationId,
      result
    } as any);
  }
}

function defaultUlaBgra(index: number): number {
  return bgraFromRgb333(DEFAULT_ULA_COLORS[index & 0x0f]);
}

function bgraFromRgb333(rgb333: number): number {
  return (
    0xff000000 |
    (level(rgb333 & 0x07) << 16) |
    (level((rgb333 >> 3) & 0x07) << 8) |
    level((rgb333 >> 6) & 0x07)
  ) >>> 0;
}

function level(value: number): number {
  return [0, 36, 73, 109, 146, 182, 219, 255][value & 0x07];
}

const DEFAULT_ULA_COLORS = [
  0x000, 0x005, 0x140, 0x145, 0x028, 0x02d, 0x168, 0x16d,
  0x000, 0x007, 0x1c0, 0x1cf, 0x038, 0x03f, 0x1f8, 0x1ff
];

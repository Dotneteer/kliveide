import { describe, expect, it } from "vitest";

import type { Channel, RequestMessage } from "@common/messaging/messages-core";
import { MessengerBase } from "@common/messaging/MessengerBase";
import {
  createOracleZxNextMachine,
  createTestZxNextWasmMachine
} from "./wasm-next-test-helpers";

const SPI_CS_PORT = 0x00e7;
const SPI_DATA_PORT = 0x00eb;

describe("ZX Spectrum Next WASM v2 SD-card SPI", () => {
  it("matches TypeScript chip-select decoding through public ports", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);

    for (const [value, selected] of [
      [0b10, 0],
      [0b01, 1],
      [0b11, 0xff],
      [0xfb, 0xff],
      [0xf7, 0xff]
    ]) {
      wasmMachine.doWritePort(SPI_CS_PORT, value);
      oracleMachine.writeTestPort(SPI_CS_PORT, value);
      expect(wasmMachine.getWasmV2Diagnostics().sdSelectedCard).toBe(selected);
      expect(wasmMachine.getWasmV2Diagnostics().sdSelectedCard).toBe(oracleMachine.sdCardDevice.selectedCard);
    }
  });

  it("matches TypeScript responses for mounted-card initialization commands", async () => {
    const [wasmMachine, oracleMachine] = await Promise.all([
      createTestZxNextWasmMachine(),
      createOracleZxNextMachine()
    ]);
    const wasm = wasmMachine.wasmV2Runtime!.exports;
    wasm.zxnextSetSdCardInfo(0, 2048);
    oracleMachine.sdCardDevice.setCardInfo(2048);
    wasmMachine.doWritePort(SPI_CS_PORT, 0b10);
    oracleMachine.writeTestPort(SPI_CS_PORT, 0b10);

    expect(sendCommandAndRead(wasmMachine, [0x40, 0, 0, 0, 0, 0x95], 1)).toEqual(
      sendCommandAndRead(oracleMachine, [0x40, 0, 0, 0, 0, 0x95], 1)
    );
    expect(sendCommandAndRead(wasmMachine, [0x48, 0, 0, 1, 0xaa, 0x87], 5)).toEqual(
      sendCommandAndRead(oracleMachine, [0x48, 0, 0, 1, 0xaa, 0x87], 5)
    );
    expect(sendCommandAndRead(wasmMachine, [0x77, 0, 0, 0, 0, 0xff], 1)).toEqual(
      sendCommandAndRead(oracleMachine, [0x77, 0, 0, 0, 0, 0xff], 1)
    );
    expect(sendCommandAndRead(wasmMachine, [0x69, 0x40, 0, 0, 0, 0xff], 1)).toEqual(
      sendCommandAndRead(oracleMachine, [0x69, 0x40, 0, 0, 0, 0xff], 1)
    );
    expect(sendCommandAndRead(wasmMachine, [0x7a, 0, 0, 0, 0, 0xff], 5)).toEqual(
      sendCommandAndRead(oracleMachine, [0x7a, 0, 0, 0, 0, 0xff], 5)
    );
  });

  it("returns CSD and CID response frames from WASM", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    wasm.zxnextSetSdCardInfo(0, 2048);
    machine.doWritePort(SPI_CS_PORT, 0b10);

    const csd = sendCommandAndRead(machine, [0x49, 0, 0, 0, 0, 0xff], 19);
    expect(csd.slice(0, 3)).toEqual([0x00, 0xff, 0xfe]);
    expect(csd[3]).toBe(0x40);

    const cid = sendCommandAndRead(machine, [0x4a, 0, 0, 0, 0, 0xff], 21);
    expect(cid.slice(0, 3)).toEqual([0x00, 0xff, 0xfe]);
    expect(String.fromCharCode(...cid.slice(4, 9))).toBe("Klive");
  });

  it("publishes a frame command journal for CMD17 and accepts a read response", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    wasm.zxnextSetSdCardInfo(0, 2048);
    machine.doWritePort(SPI_CS_PORT, 0b10);

    sendCommand(machine, [0x51, 0, 0, 0x12, 0x34, 0xff]);

    expect(machine.getFrameCommand()).toEqual({ command: "sd-read", sector: 0x1234 });
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      sdPendingCommand: 1,
      sdPendingSector: 0x1234,
      sdReadRequestCount: 1
    });

    const sector = new Uint8Array(512);
    sector[0] = 0xab;
    sector[1] = 0xcd;
    await machine.processFrameCommand(new TestSdMessenger({ readSector: sector }));

    expect(readBytes(machine, 4)).toEqual([0x00, 0xff, 0xfe, 0xab]);
  });

  it("lazily loads SD card info before processing WASM frame commands", async () => {
    const machine = await createTestZxNextWasmMachine();
    machine.doWritePort(SPI_CS_PORT, 0b10);

    sendCommand(machine, [0x51, 0, 0, 0, 7, 0xff]);

    const messenger = new TestSdMessenger({ cardInfo: { totalSectors: 4096 } });
    await machine.processFrameCommand(messenger);

    expect(messenger.methodCalls).toEqual(["getSdCardInfo", "readSdCardSector"]);
    expect(sendCommandAndRead(machine, [0x40, 0, 0, 0, 0, 0x95], 1)).toEqual([0x01]);
  });

  it("preserves mounted-card state across reset", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    wasm.zxnextSetSdCardInfo(0, 2048);
    machine.reset();
    machine.doWritePort(SPI_CS_PORT, 0b10);

    expect(sendCommandAndRead(machine, [0x40, 0, 0, 0, 0, 0x95], 1)).toEqual([0x01]);
  });

  it("publishes a frame command journal for CMD24 writes", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    wasm.zxnextSetSdCardInfo(0, 2048);
    machine.doWritePort(SPI_CS_PORT, 0b10);
    sendCommand(machine, [0x58, 0, 0, 0, 3, 0xff]);
    expect(machine.doReadPort(SPI_DATA_PORT)).toBe(0x00);

    machine.doWritePort(SPI_DATA_PORT, 0xfe);
    for (let i = 0; i < 512; i++) {
      machine.doWritePort(SPI_DATA_PORT, i & 0xff);
    }
    machine.doWritePort(SPI_DATA_PORT, 0xff);
    machine.doWritePort(SPI_DATA_PORT, 0xff);

    const frameCommand = machine.getFrameCommand();
    expect(frameCommand.command).toBe("sd-write");
    expect(frameCommand.sector).toBe(3);
    expect(frameCommand.data).toBeInstanceOf(Uint8Array);
    expect(Array.from(frameCommand.data.slice(0, 4))).toEqual([0, 1, 2, 3]);
    expect(machine.getWasmV2Diagnostics().sdWriteRequestCount).toBe(1);

    await machine.processFrameCommand(new TestSdMessenger({ writeResult: { success: true, persistenceConfirmed: true } }));
    expect(readBytes(machine, 3)).toEqual([0x05, 0xff, 0xfe]);
  });

  it("returns a failed write response when sector persistence is not confirmed", async () => {
    const machine = await createTestZxNextWasmMachine();
    const wasm = machine.wasmV2Runtime!.exports;
    wasm.zxnextSetSdCardInfo(0, 2048);
    machine.doWritePort(SPI_CS_PORT, 0b10);
    sendCommand(machine, [0x58, 0, 0, 0, 5, 0xff]);
    expect(machine.doReadPort(SPI_DATA_PORT)).toBe(0x00);

    machine.doWritePort(SPI_DATA_PORT, 0xfe);
    for (let i = 0; i < 512; i++) {
      machine.doWritePort(SPI_DATA_PORT, 0xa5);
    }
    machine.doWritePort(SPI_DATA_PORT, 0xff);
    machine.doWritePort(SPI_DATA_PORT, 0xff);

    expect(machine.getFrameCommand()).toMatchObject({ command: "sd-write", sector: 5 });
    await machine.processFrameCommand(new TestSdMessenger({ writeResult: { success: true, persistenceConfirmed: false } }));
    expect(readBytes(machine, 3)).toEqual([0x0d, 0xff, 0xff]);
  });
});

function sendCommand(machine: { doWritePort: (address: number, value: number) => void }, bytes: number[]): void {
  for (const byte of bytes) {
    machine.doWritePort(SPI_DATA_PORT, byte);
  }
}

function readBytes(machine: { doReadPort: (address: number) => number }, count: number): number[] {
  return Array.from({ length: count }, () => machine.doReadPort(SPI_DATA_PORT));
}

function sendCommandAndRead(
  machine: { doWritePort: (address: number, value: number) => void; doReadPort: (address: number) => number },
  command: number[],
  responseLength: number
): number[] {
  sendCommand(machine, command);
  return readBytes(machine, responseLength);
}

class TestSdMessenger extends MessengerBase {
  readonly methodCalls: string[] = [];

  constructor(
    private readonly options: {
      cardInfo?: { totalSectors: number };
      readSector?: Uint8Array;
      writeResult?: { success: boolean; persistenceConfirmed: boolean };
    }
  ) {
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
    this.methodCalls.push(method);
    const result = method === "getSdCardInfo"
      ? this.options.cardInfo ?? { totalSectors: 2048 }
      : method === "readSdCardSector"
        ? this.options.readSector ?? new Uint8Array(512)
        : this.options.writeResult ?? { success: true, persistenceConfirmed: true };
    this.processResponse({
      type: "ApiMethodResponse",
      correlationId: message.correlationId,
      result
    } as any);
  }
}

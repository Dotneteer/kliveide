import { describe, expect, it } from "vitest";
import type { Channel, RequestMessage } from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";

import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";

import { createTestZxNextWasmMachine } from "./wasm-next-test-helpers";

const CMD17_SECTOR_5 = [0x51, 0x00, 0x00, 0x00, 0x05, 0xff];
const CMD24_SECTOR_7 = [0x58, 0x00, 0x00, 0x00, 0x07, 0xff];

/*
 * The SD-card frame-command handoff between the core and the host (IDE-facing, not covered by the
 * hardware harness). Response bytes: R1 $00, a $FF gap, the $FE data token, then the sector; a write
 * ends with the data response $05 (accepted). Values the SD protocol does not fix are pinned: they are
 * the ones both cores agreed on at tag `pre-zxnext-ts-removal-2026-09-19`.
 */
describe("ZX Spectrum Next WASM storage command handoff", () => {
  it("hands off a single-sector read command and becomes ready on the response", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(0, 4096);

    selectCard0(wasm);
    writeBytes(wasm, CMD17_SECTOR_5);

    expect(wasm.getFrameCommand()).toEqual({ command: "sd-read", sector: 5 });
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdHostCommand()).toBe(1);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdHostSector()).toBe(5);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdResponseReady(0)).toBe(0);

    const sector = Uint8Array.from({ length: 512 }, (_, index) => index & 0xff);
    const ptr = wasm.wasmV2Runtime!.exports.zxnextGetSdWriteBufferPtr();
    new Uint8Array(wasm.wasmV2Runtime!.memoryBuffer).set(sector, ptr);
    wasm.wasmV2Runtime!.exports.zxnextSetSdReadResponse(0, ptr, sector.length);
    wasm.wasmV2Runtime!.exports.zxnextClearSdHostCommand();
    wasm.setFrameCommand(null);

    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdResponseReady(0)).toBe(1);
    expect(readBytes(wasm, 8)).toEqual([0x00, 0xff, 0xfe, 0x00, 0x01, 0x02, 0x03, 0x04]);
  });

  it("hands off a write command with its buffer and returns the final write response", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();
    wasm.wasmV2Runtime!.exports.zxnextSetSdCardInfo(0, 4096);

    selectCard0(wasm);
    writeBytes(wasm, CMD24_SECTOR_7);
    // --- R1 = $00: CMD24 accepted
    expect(wasm.doReadPort(0xeb)).toBe(0x00);

    const block = Uint8Array.from({ length: 514 }, (_, index) => (index * 3) & 0xff);
    writeBytes(wasm, [0xfe, ...block]);

    expect(wasm.getFrameCommand().command).toBe("sd-write");
    expect(wasm.getFrameCommand().sector).toBe(7);
    expect(Array.from(wasm.getFrameCommand().data.slice(0, 8))).toEqual(Array.from(block.slice(0, 8)));
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdWriteBufferLength()).toBe(512);

    wasm.wasmV2Runtime!.exports.zxnextSetSdWriteResponse(0, 1);
    wasm.wasmV2Runtime!.exports.zxnextClearSdHostCommand();
    wasm.setFrameCommand(null);
    expect(readBytes(wasm, 3)).toEqual([0x05, 0xff, 0xfe]);
  });

  it("processes WASM read frame commands with lazy card info and sector data", async () => {
    const wasm = await createTestZxNextWasmMachine();
    wasm.hardReset();

    wasm.doWritePort(0xe7, 0x02);
    for (const byte of CMD17_SECTOR_5) wasm.doWritePort(0xeb, byte);
    expect(wasm.getFrameCommand()).toEqual({ command: "sd-read", sector: 5 });

    const messenger = new StorageMessenger();
    await wasm.processFrameCommand(messenger);

    expect(messenger.calls).toEqual(["getSdCardInfo", "readSdCardSector"]);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdHostCommand()).toBe(0);
    expect(wasm.wasmV2Runtime!.exports.zxnextGetSdResponseReady(0)).toBe(1);
    expect(readBytes(wasm, 8)).toEqual([0x00, 0xff, 0xfe, 0x05, 0x06, 0x07, 0x08, 0x09]);
  });
});

function selectCard0(wasm: ZxNextWasmV2Machine): void {
  wasm.doWritePort(0xe7, 0x02);
}

function writeBytes(wasm: ZxNextWasmV2Machine, bytes: number[]): void {
  for (const byte of bytes) wasm.doWritePort(0xeb, byte);
}

function readBytes(wasm: ZxNextWasmV2Machine, length: number): number[] {
  return Array.from({ length }, () => wasm.doReadPort(0xeb));
}

class StorageMessenger extends MessengerBase {
  readonly calls: string[] = [];

  protected send(message: RequestMessage): void {
    const method = String(message.method);
    this.calls.push(method);
    let result: unknown;
    if (method === "getSdCardInfo") {
      result = { totalSectors: 4096 };
    } else if (method === "readSdCardSector") {
      result = Uint8Array.from({ length: 512 }, (_, index) => (index + 5) & 0xff);
    } else if (method === "writeSdCardSector") {
      result = { success: true, persistenceConfirmed: true };
    }
    this.processResponse({
      type: "ApiMethodResponse",
      correlationId: message.correlationId,
      result
    });
  }

  get requestChannel(): Channel {
    return "EmuToMain";
  }

  get responseChannel(): Channel {
    return "EmuToMainResponse";
  }
}

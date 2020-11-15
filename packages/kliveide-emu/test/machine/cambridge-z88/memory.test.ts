import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../../src/native/api/api";
import { importObject } from "../../import-object";
import {
  CambridgeZ88,
  IntFlags,
  TmkFlags,
  TstaFlags,
} from "../../../src/native/api/CambridgeZ88";
import { MemoryHelper } from "../../../src/native/api/memory-helpers";
import { PAGE_INDEX_16 } from "../../../src/native/api/memory-map";

const buffer = fs.readFileSync(
  path.join(__dirname, "../../../build/spectrum.wasm")
);
let api: MachineApi;
let machine: CambridgeZ88;

describe("Cambridge Z88 - Memory", function () {
  before(async () => {
    const wasm = await WebAssembly.instantiate(buffer, importObject);
    api = (wasm.instance.exports as unknown) as MachineApi;
    machine = new CambridgeZ88(api);
  });

  beforeEach(() => {
    machine.reset();
  });

  it("SR register after init", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x1f); // Slot 0 RAM 512K
    machine.api.setSlotMask(1, 0x3f); // Slot 1 RAM 1M
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 1 RAM 1M

    const s = machine.getMachineState();

    expect(s.slotMask0).toBe(0x1f);
    expect(s.slotMask1).toBe(0x3f);
    expect(s.slotMask2).toBe(0x3f);
    expect(s.slotMask3).toBe(0x3f);
    expect(s.slotMask0Rom).toBe(0x1f);

    expect(s.slot0Offset).toBe(0x00_0000);
    expect(s.slot1Offset).toBe(0x10_0000);
    expect(s.slot2Offset).toBe(0x20_0000);
    expect(s.slot3Offset).toBe(0x30_0000);
  });

  it("SR0 write (512K, 1M, 1M, 1M", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x1f); // Slot 0 RAM 512K
    machine.api.setSlotMask(1, 0x3f); // Slot 1 RAM 1M
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 1 RAM 1M

    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 32; i++) {
        machine.api.writePortCz88(0xd0, j * 32 + i);

        const s = machine.getMachineState();

        expect(s.slot0Offset).toBe(i * 0x4000);
        expect(s.slot1Offset).toBe(0x10_0000);
        expect(s.slot2Offset).toBe(0x20_0000);
        expect(s.slot3Offset).toBe(0x30_0000);
      }
    }
  });
});

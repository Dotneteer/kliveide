import "mocha";
import * as expect from "expect";
import * as fs from "fs";
import * as path from "path";
import { MachineApi } from "../../../src/native/api/api";
import { importObject } from "../../import-object";
import { CambridgeZ88 } from "../../../src/native/api/CambridgeZ88";

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
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    const s = machine.getMachineState();

    expect(s.slotMask0).toBe(0x1f);
    expect(s.slotMask1).toBe(0x3f);
    expect(s.slotMask2).toBe(0x3f);
    expect(s.slotMask3).toBe(0x3f);
    expect(s.slotMask0Rom).toBe(0x1f);

    expect(s.s0Offset).toBe(0x00_0000);
    expect(s.s1Offset).toBe(0x00_0000);
    expect(s.s2Offset).toBe(0x00_0000);
    expect(s.s3Offset).toBe(0x00_0000);
  });

  it("Set SR0 (128K, 1M, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x3f); // Slot 1 RAM 1M
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd0, repeat * 0x08 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(maskedBank * 0x4000);
        expect(s.s1Offset).toBe(0x00_0000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$ff
    for (let maskedBank = 0x40; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd0, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(maskedBank * 0x4000);
      expect(s.s1Offset).toBe(0x00_0000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR0 (512K, 1M, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x1f); // Slot 0 RAM 512K
    machine.api.setSlotMask(1, 0x3f); // Slot 1 RAM 1M
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 2; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x20; maskedBank++) {
        machine.api.writePortCz88(0xd0, repeat * 0x20 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(maskedBank * 0x4000);
        expect(s.s1Offset).toBe(0x00_0000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$ff
    for (let maskedBank = 0x40; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd0, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(maskedBank * 0x4000);
      expect(s.s1Offset).toBe(0x00_0000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR1 (128K, 1M, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x3f); // Slot 1 RAM 1M
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);
        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$ff
    for (let maskedBank = 0x40; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd1, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(0x00_0000);
      expect(s.s1Offset).toBe(maskedBank * 0x4000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR1 (128K, 512K, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x1f); // Slot 1 RAM 512K
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);
        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$7f
    for (let repeat = 0; repeat < 0x02; repeat++) {
      for (let maskedBank = 0x40; maskedBank < 0x40; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x02 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $80-$ff
    for (let maskedBank = 0x80; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd1, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(0x00_0000);
      expect(s.s1Offset).toBe(maskedBank * 0x4000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR1 (128K, 256K, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x0f); // Slot 1 RAM 256K
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);
        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$7f
    for (let repeat = 0; repeat < 0x04; repeat++) {
      for (let maskedBank = 0x40; maskedBank < 0x20; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x04 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $80-$ff
    for (let maskedBank = 0x80; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd1, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(0x00_0000);
      expect(s.s1Offset).toBe(maskedBank * 0x4000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR1 (128K, 128K, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x07); // Slot 1 RAM 128K
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);
        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$7f
    for (let repeat = 0; repeat < 0x08; repeat++) {
      for (let maskedBank = 0x40; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $80-$ff
    for (let maskedBank = 0x80; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd1, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(0x00_0000);
      expect(s.s1Offset).toBe(maskedBank * 0x4000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR1 (128K, 64K, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x03); // Slot 1 RAM 64K
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);
        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$7f
    for (let repeat = 0; repeat < 0x10; repeat++) {
      for (let maskedBank = 0x40; maskedBank < 0x04; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x10 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $80-$ff
    for (let maskedBank = 0x80; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd1, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(0x00_0000);
      expect(s.s1Offset).toBe(maskedBank * 0x4000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });

  it("Set SR1 (128K, 32K, 1M, 1M, 512K)", () => {
    machine.reset();
    machine.api.setSlotMask(0, 0x07); // Slot 0 RAM 128K
    machine.api.setSlotMask(1, 0x01); // Slot 1 RAM 32K
    machine.api.setSlotMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setSlotMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setSlotMask(4, 0x1f); // Slot 4 ROM 512K

    // Banks $00-$3f
    for (let repeat = 0; repeat < 8; repeat++) {
      for (let maskedBank = 0x00; maskedBank < 0x08; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x08 + maskedBank);
        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $40-$7f
    for (let repeat = 0; repeat < 0x20; repeat++) {
      for (let maskedBank = 0x40; maskedBank < 0x02; maskedBank++) {
        machine.api.writePortCz88(0xd1, repeat * 0x20 + maskedBank);

        const s = machine.getMachineState();

        expect(s.s0Offset).toBe(0x00_0000);
        expect(s.s1Offset).toBe(maskedBank * 0x4000);
        expect(s.s2Offset).toBe(0x00_0000);
        expect(s.s3Offset).toBe(0x00_0000);
      }
    }

    // Banks $80-$ff
    for (let maskedBank = 0x80; maskedBank < 0x100; maskedBank++) {
      machine.api.writePortCz88(0xd1, maskedBank);

      const s = machine.getMachineState();

      expect(s.s0Offset).toBe(0x00_0000);
      expect(s.s1Offset).toBe(maskedBank * 0x4000);
      expect(s.s2Offset).toBe(0x00_0000);
      expect(s.s3Offset).toBe(0x00_0000);
    }
  });
});

import { describe, expect, it } from "vitest";

import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { MEDIA_TAPE } from "@common/structs/project-const";
import { TapeDevice } from "@emu/machines/tape/TapeDevice";

/*
 * A tape is a train of edges: every pulse flips the EAR level. The TypeScript tape player (and the
 * WASM one, `zx-spectrum-tape.c`, covered on the real machine by `turbo-block-playback.test.ts`)
 * sets absolute levels, which is right only after an odd pilot. After an even pilot - legal in a
 * TZX turbo block - SYNC1 made no edge and the ROM reported a loading error.
 */

function deviceWith(pilotCount: number) {
  const machine: any = {
    tacts: 0,
    pc: 0x056c,
    isSpectrum48RomSelected: true,
    baseClockFrequency: 3_500_000,
    machinePropertyChanged: { on: () => {} },
    getMachineProperty: () => false,
    setMachineProperty: () => {},
    beeperDevice: { setEarBit: () => {} }
  };
  const device = new TapeDevice(machine);
  const block = new TapeDataBlock();
  block.data = new Uint8Array([0xff, 0x00]);
  block.pilotPulseLength = 100;
  block.pilotPulseCount = pilotCount;
  block.sync1PulseLength = 30;
  block.sync2PulseLength = 40;
  block.zeroBitPulseLength = 50;
  block.oneBitPulseLength = 60;
  device.onMachinePropertiesChanged(device, { propertyName: MEDIA_TAPE, newValue: [block] });
  device.nextTapeBlock();
  /** The level at T-state `t` from the block's start */
  const levelAt = (t: number) => {
    machine.tacts = t;
    return device.getTapeEarBit();
  };
  return { levelAt, pilotEnd: pilotCount * 100 };
}

describe("TapeDevice pulse polarity", () => {
  it.each([3, 4, 3223, 3224])(
    "flips the level into SYNC1 and SYNC2 after a %i-pulse pilot",
    (count) => {
      const { levelAt, pilotEnd } = deviceWith(count);
      const lastPilot = levelAt(pilotEnd - 1);
      const sync1 = levelAt(pilotEnd + 10);
      const sync2 = levelAt(pilotEnd + 30 + 10);
      const firstBit = levelAt(pilotEnd + 70 + 10);
      expect(sync1).toBe(!lastPilot);
      expect(sync2).toBe(!sync1);
      expect(firstBit).toBe(!sync2);
    }
  );
});

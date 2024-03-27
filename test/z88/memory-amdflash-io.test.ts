import "mocha";
import { expect } from "expect";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import { Z88TestMachine } from "./Z88TestMachine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88AmdFlash29F040B } from "@emu/machines/z88/memory/Z88AmdFlash29F040B";
import { COMFlags } from "@emu/machines/z88/IZ88BlinkDevice";

const addrSR3: number[] = [
  // logical addresses for SR3 (16K range)
  0xc000, 0xc001, 0xcdef, 0xdfff, 0xefff, 0xfffe, 0xffff
];

describe("Z88 - AMD 29F040B Card Read / flash bytes", function () {
  addrSR3.forEach(addr => {
    it(`AMD 29F040B read pristine content (${addr}) in slot 3`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create a 512K AMD 29F040B Flash Card
      const amd29F040B = new Z88AmdFlash29F040B(m);
      // --- Insert 512K card in slot 3 (reset to FFh)
      mem.insertCard(3, amd29F040B);

      // bind bottom bank of slot 3 into logical address space (SR3)
      m.blinkDevice.setSR3(0xc0);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0xff);
      expect(amd29F040B.readArrayModeState()).toBe(true);

    });
  });

});

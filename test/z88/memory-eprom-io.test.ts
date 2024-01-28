import "mocha";
import { expect } from "expect";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import { Z88TestMachine } from "./Z88TestMachine";
import { Z88UvEpromMemoryCard } from "@emu/machines/z88/memory/Z88UvEpromMemoryCard";

describe("Z88 - Memory read (32K EPROM)", function () {

  const addresses: number[] = [
    // logical addresses for SR2, SR3
    0x8000, 0x89ab, 0x9fff, 0xa000, 0xbcde, 0xbfff, 0xc000, 0xcdef, 0xdfff
  ];

  addresses.forEach(addr => {
    it(`EPROM read (${addr}) after init`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();

      // --- Create 32K UV Eprom Card
      const uvepr32k = new Z88UvEpromMemoryCard(m, 0x00_8000);

      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Insert 32K Eprom card in slot 3
      mem.insertCard(3, uvepr32k);
      // bind top-two banks of slot 3 into logical address space
      m.blinkDevice.setSR2(0xfe);
      m.blinkDevice.setSR3(0xff);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0); // TO DO : this has to be FFh
    });
  });

  // TO DO : read test cases for UV Eprom 128K
  // const uvepr128k = new Z88UvEpromMemoryCard(m, 0x02_0000);
});

import "mocha";
import { expect } from "expect";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import { Z88TestMachine } from "./Z88TestMachine";
import { Z88UvEpromMemoryCard } from "@emu/machines/z88/memory/Z88UvEpromMemoryCard";
import { COMFlags } from "@emu/machines/z88/IZ88BlinkDevice";

const addr32K: number[] = [
  // logical addresses for SR2, SR3 (32K range)
  0x8000, 0x89ab, 0x9fff, 0xa000, 0xbcde, 0xbfff, 0xc000, 0xcdef, 0xdfff
];
const addrSR3: number[] = [
  // logical addresses for SR3 (16K range)
  0xc000, 0xc001, 0xcdef, 0xdfff, 0xefff, 0xfffe, 0xffff
];

describe("Z88 - UV EPROM Card Read / Blow bytes", function () {
  addr32K.forEach(addr => {
    it(`32K EPROM read pristine content (${addr})`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create 32K UV Eprom Card
      const uvepr32k = new Z88UvEpromMemoryCard(m, 0x00_8000);
      // --- Insert 32K Eprom card in slot 3 (reset to FFh)
      mem.insertCard(3, uvepr32k);

      // bind top-two banks of slot 3 into logical address space
      m.blinkDevice.setSR2(0xfe);
      m.blinkDevice.setSR3(0xff);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0xff);
    });
  });

  addr32K.forEach(addr => {
    it(`32K EPROM blow content (${addr})`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create 32K UV Eprom Card
      const uvepr32k = new Z88UvEpromMemoryCard(m, 0x00_8000);
      // --- Insert 32K Eprom card in slot 3 (reset to FFh)
      mem.insertCard(3, uvepr32k);

      // bind top-two banks of slot 3 into logical address space
      m.blinkDevice.setSR2(0xfe);
      m.blinkDevice.setSR3(0xff);

      // blowing 0 bits (from 1)...
      // (on real H/W, more than 70 iterations of PROGRAM and OVERP are done.
      //  here, we simply test that conditions are met, once)

      // VPP pin ON, then UV Eprom PROGRAM
      m.blinkDevice.setCOM(COMFlags.VPPON | COMFlags.PROGRAM);

      // define PROGRAM & OVERP characteristics for 32K UV EPROM
      m.blinkDevice.EPR = 0x48;

      m.memory.writeMemory(addr, 0xf0);
      const valuePROGRAM = m.memory.readMemory(addr);
      expect(valuePROGRAM).toBe(0xf0);

      // VPP pin ON, then UV Eprom OVERP
      m.blinkDevice.setCOM(COMFlags.VPPON | COMFlags.OVERP);
      m.memory.writeMemory(addr, 0x0f);
      const valueOVERP = m.memory.readMemory(addr);
      expect(valueOVERP).toBe(0x00);
    });
  });

  // begin read tests from bottom of slot 3 of 128K card (8 x 16K), upwards
  for (let bnk128K = 0xc0; bnk128K <= 0xc8; bnk128K++) {
    addrSR3.forEach(addr => {
      it(`128K EPROM (Bank ${bnk128K}) read pristine content (${addr})`, () => {
        // --- Create the machine
        const m = new Z88TestMachine();
        const mem = m.memory;
        const memt = mem as IZ88BankedMemoryTestSupport;

        // --- Create 128K UV Eprom Card
        const uvepr128k = new Z88UvEpromMemoryCard(m, 0x02_0000);
        // --- Insert 128K Eprom card in slot 3 (reset to FFh)
        mem.insertCard(3, uvepr128k);

        m.blinkDevice.setSR3(bnk128K);
        const value = m.memory.readMemory(addr);
        expect(value).toBe(0xff);
      });
    });
  }

  // begin blow byte tests from bottom of slot 3 of 128K card (8 x 16K), upwards
  for (let bnk128K = 0xc0; bnk128K <= 0xc8; bnk128K++) {
    addrSR3.forEach(addr => {
      it(`128K EPROM (Bank ${bnk128K}) blow content (${addr})`, () => {
        // --- Create the machine
        const m = new Z88TestMachine();
        const mem = m.memory;
        const memt = mem as IZ88BankedMemoryTestSupport;

        // --- Create 128K UV Eprom Card
        const uvepr128k = new Z88UvEpromMemoryCard(m, 0x02_0000);
        // --- Insert 128K Eprom card in slot 3 (reset to FFh)
        mem.insertCard(3, uvepr128k);

        m.blinkDevice.setSR3(bnk128K);

        // VPP pin ON, then UV Eprom PROGRAM
        m.blinkDevice.setCOM(COMFlags.VPPON | COMFlags.PROGRAM);

        // define PROGRAM & OVERP characteristics for 128K UV EPROM
        m.blinkDevice.EPR = 0x69;

        m.memory.writeMemory(addr, 0xf0);
        const valuePROGRAM = m.memory.readMemory(addr);
        expect(valuePROGRAM).toBe(0xf0);

        // VPP pin ON, then UV Eprom OVERP
        m.blinkDevice.setCOM(COMFlags.VPPON | COMFlags.OVERP);
        m.memory.writeMemory(addr, 0x0f);
        const valueOVERP = m.memory.readMemory(addr);
        expect(valueOVERP).toBe(0x00);
      });
    });
  }

});

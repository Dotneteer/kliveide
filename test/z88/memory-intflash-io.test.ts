import "mocha";
import { expect } from "expect";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import { Z88TestMachine } from "./Z88TestMachine";
import { CardType } from "@emu/machines/z88/memory/CardType";
import { Z88IntelFlashMemoryCard } from "@emu/machines/z88/memory/Z88IntelFlashMemoryCard";
import { COMFlags } from "@emu/machines/z88/IZ88BlinkDevice";

const addrSR3: number[] = [
  // logical addresses for SR3 (16K range)
  0xc000, 0xc001, 0xcdef, 0xdfff, 0xefff, 0xfffe, 0xffff
];

describe("Z88 - Intel I28F00XS5 Card Read / flash bytes", function () {
  addrSR3.forEach(addr => {
    it(`Intel i28F004S5 read pristine content (${addr}) in slot 3`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create a 512K Intel 28F004S5 Flash Card
      const i28F004S5 = new Z88IntelFlashMemoryCard(m, 0x8_0000);
      // --- Insert 512K card in slot 3 (reset to FFh)
      mem.insertCard(3, i28F004S5);

      // bind bottom bank of slot 3 into logical address space (SR3)
      m.blinkDevice.setSR3(0xc0);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0xff);

      // Get Manufacturer & Device code from chip
      m.memory.writeMemory(0xc800,0x90); // any (address) write to slot, execute Device ID command
      expect(i28F004S5.readArrayModeState()).toBe(false);
      const manCode= m.memory.readMemory(0xc000); // command mode: read Manufacturer Code from address 0x0000
      const devCode= m.memory.readMemory(0xc001); // command mode: read Device Code from address 0x0001
      expect(manCode).toBe(CardType.FlashIntel28F004S5 >> 8);
      expect(devCode).toBe(CardType.FlashIntel28F004S5 & 0xff);
      m.memory.writeMemory(0xc8ff,0xff); // any (address) write to slot, Back to Read Array Mode command
      expect(i28F004S5.readArrayModeState()).toBe(true);
    });
  });

  addrSR3.forEach(addr => {
    it(`Intel i28F008S5 read pristine content (${addr}) in slot 3`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create a 1Mb Intel 28F008S5 Flash Card
      const i28F008S5 = new Z88IntelFlashMemoryCard(m, 0x10_0000);
      // --- Insert 1Mb card in slot 3 (reset to FFh)
      mem.insertCard(3, i28F008S5);

      // bind bottom bank of slot 3 into logical address space (SR3)
      m.blinkDevice.setSR3(0xc0);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0xff);

      // Get Manufacturer & Device code from chip
      m.memory.writeMemory(0xc800,0x90); // any (address) write to slot, execute Device ID command
      expect(i28F008S5.readArrayModeState()).toBe(false);
      const manCode= m.memory.readMemory(0xc000); // command mode: read Manufacturer Code from address 0x0000
      const devCode= m.memory.readMemory(0xc001); // command mode: read Device Code from address 0x0001
      expect(manCode).toBe(CardType.FlashIntel28F008S5 >> 8);
      expect(devCode).toBe(CardType.FlashIntel28F008S5 & 0xff);
      m.memory.writeMemory(addr,0xff); // any (address) write to slot, Back to Read Array Mode command
      expect(i28F008S5.readArrayModeState()).toBe(true);
    });
  });

  addrSR3.forEach(addr => {
    it(`Intel i28F004S5 read pristine content (${addr}) in slot 2`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create a 512K Intel 28F004S5 Flash Card
      const i28F004S5 = new Z88IntelFlashMemoryCard(m, 0x8_0000);
      // --- Insert 512K card in slot 2 (reset to FFh)
      mem.insertCard(2, i28F004S5);

      // bind bottom bank of slot 2 into logical address space (SR3)
      m.blinkDevice.setSR3(0x80);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0xff);

      // Get Manufacturer & Device code from chip
      m.memory.writeMemory(0xc800,0x90); // any (address) write to slot, execute Device ID command
      expect(i28F004S5.readArrayModeState()).toBe(false);
      const manCode= m.memory.readMemory(0xc000); // read Manufacturer Code from address 0x0000
      const devCode= m.memory.readMemory(0xc001); // read Device Code from address 0x0001
      expect(manCode).toBe(CardType.FlashIntel28F004S5 >> 8);
      expect(devCode).toBe(CardType.FlashIntel28F004S5 & 0xff);
      m.memory.writeMemory(addr,0xff); // any (address) write to slot, Back to Read Array Mode command
      expect(i28F004S5.readArrayModeState()).toBe(true);
    });
  });

  addrSR3.forEach(addr => {
    it(`Intel I28F00XS5 flash byte at (${addr}) in slot 2`, () => {
      // --- Create the machine
      const m = new Z88TestMachine();
      const mem = m.memory;
      const memt = mem as IZ88BankedMemoryTestSupport;

      // --- Create a 512K Intel 28F004S5 Flash Card
      const i28F004S5 = new Z88IntelFlashMemoryCard(m, 0x8_0000);
      // --- Insert 512K card in slot 2 (reset to FFh)
      mem.insertCard(2, i28F004S5);

      // bind bottom bank of slot 2 into logical address space (SR3)
      m.blinkDevice.setSR3(0x80);

      const value = m.memory.readMemory(addr);
      expect(value).toBe(0xff);

      // --------------------------------------------------------------------------------------
      // Blow first byte 0x55 at address (from bits 1111 1111 -> 0101 0101)
      // --------------------------------------------------------------------------------------
      m.memory.writeMemory(addr,0x40); // at (address) execute Blow byte command
      expect(i28F004S5.readArrayModeState()).toBe(false);
      m.memory.writeMemory(addr,0x55); // at (address) blow bits 0b01010101
      m.memory.writeMemory(addr,0x70); // execute Read Status Register command
      const flashByteStatus = m.memory.readMemory(addr);
      expect(flashByteStatus).toBe(0x80); // Intel Flash command mode has returned "Ready" (byte was flashed)
      m.memory.writeMemory(addr,0xff); // put Intel Flash chip back to Read Array Mode
      expect(i28F004S5.readArrayModeState()).toBe(true);
      const flashedByte = m.memory.readMemory(addr); // back in read-array mode, read flashed byte from memory
      expect(flashedByte).toBe(0x55); // which should be 0xff -> 0x55 (0b01010101)

      // --------------------------------------------------------------------------------------
      // Blow second byte 0xaa (illegal! from 0 -> 1) at same address (from bits 0101 0101 -> 1010 1010)
      // --------------------------------------------------------------------------------------
      m.memory.writeMemory(addr,0x40); // at (address) execute Blow byte command
      expect(i28F004S5.readArrayModeState()).toBe(false);
      m.memory.writeMemory(addr,0xaa); // at (address) blow bits 0b10101010
      m.memory.writeMemory(addr,0x70); // execute Read Status Register command
      const flashByteStatus2 = m.memory.readMemory(addr);
      expect(flashByteStatus2).toBe(0x90); // Intel Flash command mode has returned "Program Error" (byte was not flashed)
      m.memory.writeMemory(addr,0xff); // put Intel Flash chip back to Read Array Mode
      expect(i28F004S5.readArrayModeState()).toBe(true);
      const flashedByte2 = m.memory.readMemory(addr); // back in read-array mode, read flashed byte from memory
      expect(flashedByte2).toBe(0x55); // which should be 0x55 (unchanged)

      // --------------------------------------------------------------------------------------
      // Blow third byte 0x00 at same address (from bits 0101 0101 -> 0000 0000)
      // --------------------------------------------------------------------------------------
      m.memory.writeMemory(addr,0x40); // at (address) execute Blow byte command
      expect(i28F004S5.readArrayModeState()).toBe(false);
      m.memory.writeMemory(addr,0x00); // at (address) blow bits 0b00000000
      m.memory.writeMemory(addr,0x70); // execute Read Status Register command
      const flashByteStatus3 = m.memory.readMemory(addr);
      expect(flashByteStatus3).toBe(0x80); // Intel Flash command mode has returned "Ready" (byte was flashed correctly)
      m.memory.writeMemory(addr,0xff); // put Intel Flash chip back to Read Array Mode
      expect(i28F004S5.readArrayModeState()).toBe(true);
      const flashedByte3 = m.memory.readMemory(addr); // back in read-array mode, read flashed byte from memory
      expect(flashedByte3).toBe(0x00); // which should be 0x00
    });
  });

});

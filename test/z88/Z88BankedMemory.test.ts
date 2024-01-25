import "mocha";
import { expect } from "expect";
import { Z88TestMachine } from "./Z88TestMachine";
import { IZ88BankedMemoryTestSupport } from "@emu/machines/z88/memory/Z88BankedMemory";
import { Z88RomMemoryCard } from "@emu/machines/z88/memory/Z88RomMemoryCard";

describe("Z88 - Banked Memory", function () {
  this.timeout(10_000);

  it("constructor works", () => {
    const m = new Z88TestMachine().z88Memory;
    const mt = m as IZ88BankedMemoryTestSupport;
    expect(m).toBeDefined();

    expect(mt.cards).toHaveLength(4);
    expect(mt.cards[0] instanceof Z88RomMemoryCard).toBeTruthy();
    expect(mt.cards[1]).toBeNull(); 
    expect(mt.cards[2]).toBeNull(); 
    expect(mt.cards[3]).toBeNull(); 

    expect(mt.bankData).toHaveLength(8);
    expect(mt.bankData[0].bank).toBe(0);
    expect(mt.bankData[0].offset).toBe(0);
    expect(mt.bankData[0].handler instanceof Z88RomMemoryCard).toBeTruthy();
    expect(mt.bankData[1].bank).toBe(0);
    expect(mt.bankData[1].offset).toBe(0);
    expect(mt.bankData[1].handler instanceof Z88RomMemoryCard).toBeTruthy();
    expect(mt.bankData[2].bank).toBe(0);
    expect(mt.bankData[2].offset).toBe(0);
    expect(mt.bankData[2].handler).toBeNull();
    expect(mt.bankData[3].bank).toBe(0);
    expect(mt.bankData[3].offset).toBe(0x2000);
    expect(mt.bankData[3].handler).toBeNull();
    expect(mt.bankData[4].bank).toBe(0);
    expect(mt.bankData[4].offset).toBe(0);
    expect(mt.bankData[4].handler).toBeNull();
    expect(mt.bankData[5].bank).toBe(0);
    expect(mt.bankData[5].offset).toBe(0x2000);
    expect(mt.bankData[5].handler).toBeNull();
    expect(mt.bankData[6].bank).toBe(0);
    expect(mt.bankData[6].offset).toBe(0);
    expect(mt.bankData[6].handler).toBeNull();
    expect(mt.bankData[7].bank).toBe(0);
    expect(mt.bankData[7].offset).toBe(0x2000);
    expect(mt.bankData[7].handler).toBeNull();

  });
});
import { describe, it, expect } from "vitest";

import { MemorySectionType } from "@abstractions/MemorySection";
import { sp128BankSpace, sp48BankSpace, nextBankSpace } from "@common/annotations/bankSpace";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { ZxSpectrum48CustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-48-disassembler";
import { gateOnRom } from "@renderer/appIde/disassemblers/z80-disassembler/rom-gated-disassembler";
import {
  annotateLiveListing,
  livePieces,
  partitionSite
} from "@renderer/appIde/annotations/liveAnnotatedDisassembly";
import { customDisassemblyContextFor } from "@renderer/appIde/annotations/romDisassemblyGate";
import { createAddressSymbols } from "@renderer/appIde/annotations/symbolResolver";
import type { ProgramAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import type { RomLayer } from "@renderer/appIde/annotations/romLayer";

/*
 * The live Disassembly view as an annotated listing
 * (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` §4.5, T7, T8).
 */

const PAGING_128 = [-1, -1, 5, 5, 2, 2, 7, 7];

async function plainListing(memory: Uint8Array, start: number, end: number) {
  const disassembler = new Z80Disassembler(
    [new MemorySection(start, end, MemorySectionType.Disassemble)],
    memory,
    undefined,
    { allowExtendedSet: false }
  );
  return (await disassembler.disassemble(start, end))?.outputItems ?? [];
}

const romLayer = (labels: { name: string; value: number }[], regions?: any[]): RomLayer => ({
  kind: "shipped",
  path: "roms/sp128-1.rom.dis",
  origin: "ROM: sp128-1.rom",
  page: 0,
  annotations: {
    schemaVersion: 3,
    machine: "rom",
    banks: {
      "0": {
        offsetIndex: 0,
        regions: regions ?? [{ start: 0, end: 0x3fff, type: "disassemble" }],
        localLabels: labels,
        lineAnnotations: { "0": { synopsis: "Power on", comment: "disable interrupts" } }
      }
    }
  }
});

describe("livePieces", () => {
  it("splits a 128K window where the memory behind it changes (T8)", () => {
    const pieces = livePieces(0x0000, 0xffff, sp128BankSpace, PAGING_128);
    expect(pieces.map((piece) => [piece.start, piece.end, piece.site])).toEqual([
      [0x0000, 0x3fff, { kind: "rom", partition: -1, offset: 0 }],
      [0x4000, 0x7fff, { kind: "bank", bank: 5, offset: 0 }],
      [0x8000, 0xbfff, { kind: "bank", bank: 2, offset: 0 }],
      [0xc000, 0xffff, { kind: "bank", bank: 7, offset: 0 }]
    ]);
  });

  it("splits a Next bank whose halves are paged apart", () => {
    const pieces = livePieces(0x4000, 0x7fff, nextBankSpace, [-1, -2, 10, 3, 4, 5, 11, 1]);
    expect(pieces.map((piece) => piece.site)).toEqual([
      { kind: "bank", bank: 5, offset: 0 },
      { kind: "bank", bank: 1, offset: 0x2000 }
    ]);
  });

  it("gives the whole partition's site to a bank view", () => {
    expect(partitionSite(7, sp128BankSpace)).toEqual({ kind: "bank", bank: 7, offset: 0 });
    expect(partitionSite(11, nextBankSpace)).toEqual({ kind: "bank", bank: 5, offset: 0x2000 });
    expect(partitionSite(-2, sp128BankSpace)).toEqual({ kind: "rom", partition: -2, offset: 0 });
  });
});

describe("annotateLiveListing", () => {
  it("lists each piece from its own bank's or ROM page's annotations", async () => {
    const memory = new Uint8Array(0x10000);
    memory[0x0000] = 0xf3; // di
    memory[0xc100] = 0xc9; // ret
    memory.fill(0x41, 0x8000, 0x8004);
    const annotations: ProgramAnnotations = {
      schemaVersion: 3,
      machine: "sp128",
      banks: {
        "2": {
          offsetIndex: 2,
          regions: [
            { start: 0, end: 3, type: "bytes" },
            { start: 4, end: 0x3fff, type: "disassemble" }
          ],
          localLabels: [{ name: "Table", value: 0 }]
        },
        "7": {
          offsetIndex: 3,
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
          localLabels: [{ name: "Bank7", value: 0x0100 }]
        },
        // --- Bank 0 is not paged: its label must not appear at $C100
        "0": {
          offsetIndex: 3,
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
          localLabels: [{ name: "Bank0", value: 0x0100 }]
        }
      }
    };
    const symbols = createAddressSymbols({
      bankSpace: sp128BankSpace,
      annotations,
      romLayersOf: (partition) => (partition === -1 ? [romLayer([{ name: "START", value: 0 }])] : [])
    });
    const items = await annotateLiveListing({
      items: await plainListing(memory, 0, 0xffff),
      memory,
      memoryBase: 0,
      ranges: [[0, 0xffff]],
      space: sp128BankSpace,
      slots: PAGING_128,
      symbols,
      decimalView: false,
      allowExtendedSet: false
    });

    const at = (address: number) => items.filter((item) => item.address === address && !item.isPrefixItem);
    expect(at(0x0000)[0]).toMatchObject({ formattedLabel: "START", instruction: "di", hardComment: "disable interrupts" });
    expect(at(0x0000)[0].annotation).toMatchObject({ site: "rom", partition: -1 });
    expect(items.find((item) => item.isPrefixItem && item.address === 0)?.prefixComment).toBe("Power on");
    expect(at(0x8000)[0]).toMatchObject({ formattedLabel: "Table", instruction: ".defb $41, $41, $41, $41" });
    expect(at(0x8000)[0].annotation).toMatchObject({ bank: 2, site: "bank" });
    expect(at(0xc100)[0]).toMatchObject({ formattedLabel: "Bank7", instruction: "ret" });
    expect(items.some((item) => item.formattedLabel === "Bank0")).toBe(false);
    // --- Every address listed once, in order
    const addresses = items.filter((item) => !item.isPrefixItem).map((item) => item.address);
    expect([...addresses].sort((a, b) => a - b)).toEqual(addresses);
  });

  it("does not decode a data region as code when the viewport starts inside it (T7)", async () => {
    // --- Follow-PC style: the listing starts at $8010, in the middle of a 32-byte table
    const memory = new Uint8Array(0x10000);
    memory.fill(0x21, 0x8000, 0x8020); // would decode as `ld hl,$2121`
    const annotations: ProgramAnnotations = {
      schemaVersion: 3,
      machine: "sp48",
      banks: {
        "2": {
          offsetIndex: 2,
          regions: [
            { start: 0, end: 0x1f, type: "bytes" },
            { start: 0x20, end: 0x3fff, type: "disassemble" }
          ]
        }
      }
    };
    const symbols = createAddressSymbols({ bankSpace: sp48BankSpace, annotations });
    const items = await annotateLiveListing({
      items: await plainListing(memory, 0x8010, 0x8030),
      memory,
      memoryBase: 0,
      ranges: [[0x8010, 0x8030]],
      space: sp48BankSpace,
      slots: [],
      symbols,
      decimalView: false,
      allowExtendedSet: false
    });
    const table = items.filter((item) => item.address >= 0x8010 && item.address < 0x8020);
    expect(table.every((item) => item.instruction?.startsWith(".defb"))).toBe(true);
    expect(table[0].address).toBe(0x8010);
    expect(items.find((item) => item.address === 0x8020)?.instruction).toBe("nop");
  });

  it("cuts a code region at the program counter", async () => {
    const memory = new Uint8Array(0x10000);
    memory[0x8000] = 0x21; // ld hl,nn - covers $8001-$8002
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      annotations: {
        schemaVersion: 3,
        machine: "sp48",
        banks: { "2": { offsetIndex: 2, regions: [{ start: 0, end: 0x3fff, type: "disassemble" }] } }
      }
    });
    const items = await annotateLiveListing({
      items: await plainListing(memory, 0x8000, 0x8008),
      memory,
      memoryBase: 0,
      ranges: [[0x8000, 0x8008]],
      space: sp48BankSpace,
      slots: [],
      symbols,
      decimalView: false,
      pc: 0x8002,
      allowExtendedSet: false
    });
    expect(items.some((item) => item.address === 0x8002)).toBe(true);
  });

  it("labels the rows of an unannotated piece through the resolver, with alternatives", async () => {
    const memory = new Uint8Array(0x10000);
    const symbols = createAddressSymbols({
      bankSpace: sp48BankSpace,
      buildLabels: [{ name: "Main", address: 0x8000 }],
      romLayersOf: () => [romLayer([{ name: "START", value: 0 }])],
      annotations: {
        schemaVersion: 3,
        machine: "sp48",
        globalLabels: [{ name: "Entry", value: 0x8000 }],
        banks: {}
      }
    });
    const items = await annotateLiveListing({
      items: await plainListing(memory, 0x8000, 0x8003),
      memory,
      memoryBase: 0,
      ranges: [[0x8000, 0x8003]],
      space: sp48BankSpace,
      slots: [],
      symbols,
      decimalView: false,
      allowExtendedSet: false
    });
    expect(items[0]).toMatchObject({
      formattedLabel: "Main",
      labelOrigin: "Build",
      labelSource: "build",
      labelAlternatives: ["Entry (Annotations)"]
    });
  });

  it("leaves the listing alone when nothing can name anything", async () => {
    const memory = new Uint8Array(0x10000);
    const plain = await plainListing(memory, 0, 0x10);
    const items = await annotateLiveListing({
      items: plain,
      memory,
      memoryBase: 0,
      ranges: [[0, 0x10]],
      space: sp48BankSpace,
      slots: [],
      symbols: createAddressSymbols({ bankSpace: sp48BankSpace }),
      decimalView: false,
      allowExtendedSet: false
    });
    expect(items).toBe(plain);
  });
});

describe("the ROM-gated custom disassembler", () => {
  async function listWith(memory: Uint8Array, start: number, end: number, inRom: (address: number) => boolean) {
    const disassembler = new Z80Disassembler(
      [new MemorySection(start, end, MemorySectionType.Disassemble)],
      memory,
      undefined,
      { allowExtendedSet: false }
    );
    disassembler.setCustomDisassembler(
      gateOnRom(new ZxSpectrum48CustomDisassembler(), { inDescribedRom: inRom }, 0x4000)
    );
    return (await disassembler.disassemble(start, end))?.outputItems ?? [];
  }

  it("decodes the byte after RST $08 in a 48K BASIC ROM page", async () => {
    const memory = new Uint8Array(0x10000);
    memory[0x0100] = 0xcf;
    memory[0x0101] = 0x0a;
    const items = await listWith(memory, 0x0100, 0x0101, () => true);
    expect(items[1]).toMatchObject({ address: 0x0101, instruction: ".defb $0A" });
  });

  it("leaves RST $08 in RAM, or in another ROM page, as code", async () => {
    const memory = new Uint8Array(0x10000);
    memory[0x8100] = 0xcf;
    memory[0x8101] = 0x00;
    const items = await listWith(memory, 0x8100, 0x8101, (address) => address < 0x4000);
    expect(items[1]).toMatchObject({ address: 0x8101, instruction: "nop" });
  });

  it("knows a 48K BASIC page by its bytes or its position", () => {
    const identity = (crc32: string) => ({ crc32, size: 0x4000 });
    // --- 128K: ROM 1 (partition -2) is 48K BASIC; ROM 0 (the editor) is not
    const ctx128 = (rom: number) =>
      customDisassemblyContextFor("sp128", sp128BankSpace, [rom, rom, 5, 5, 2, 2, 0, 0], (p) =>
        p === -2 ? identity("b96a36be") : identity("e76799d2")
      );
    expect(ctx128(-2).inDescribedRom(0x0100)).toBe(true);
    expect(ctx128(-1).inDescribedRom(0x0100)).toBe(false);
    expect(ctx128(-2).inDescribedRom(0x8100)).toBe(false);
    // --- An unknown ROM in the 48K BASIC position still counts (Q7)
    const custom = customDisassemblyContextFor("sp128", sp128BankSpace, [-2, -2, 5, 5, 2, 2, 0, 0], () =>
      identity("12345678")
    );
    expect(custom.inDescribedRom(0x0100)).toBe(true);
  });
});

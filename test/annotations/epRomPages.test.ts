import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { romDecoderFor } from "@renderer/appIde/annotations/romDecoder";
import { partitionSite } from "@renderer/appIde/annotations/liveAnnotatedDisassembly";
import { KNOWN_ROM_PAGES, knownRomPageKind, romKindOrigin, romPageIdentity } from "@common/roms/romIdentity";
import { epBankSpace, isRomPartitionOf, sp128BankSpace } from "@common/annotations/bankSpace";
import { customDisassemblyContextFor } from "@renderer/appIde/annotations/romDisassemblyGate";
import { machineRegistry } from "@common/machines/machine-registry";
import { CT_CUSTOM_DISASSEMBLER, MI_ENTERPRISE } from "@common/machines/constants";
import type { ICustomDisassembler } from "@renderer/appIde/disassemblers/z80-disassembler/custom-disassembly";
import { MemoryMap, MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";

/*
 * The Enterprise's ROMs as the ROM annotation tools read them (`.ai/rom-annotations/ep-authoring-guide.md`):
 * every 16K page known by its bytes and decoded at $C000, where EXOS runs it, with the function code after
 * `RST 30h` as data; and the bank space telling its ROM segments (positive partitions) from its RAM.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const rom = (name: string) => new Uint8Array(readFileSync(join(ROMS, name)));
const page = (name: string, n: number) => rom(name).subarray(n * 0x4000, (n + 1) * 0x4000);

describe("the Enterprise ROM pages", () => {
  it("are known by their bytes, each with its kind and run address", () => {
    const expected: [string, number, string][] = [
      ["ep-exos21.rom", 0, "ep-exos"],
      ["ep-exos21.rom", 1, "ep-exos-basic"],
      ["ep-exos20.rom", 0, "ep-exos"],
      ["ep-exos20.rom", 1, "ep-exos"],
      ["ep-basic21.rom", 0, "ep-basic"],
      ["ep-basic20.rom", 0, "ep-ext"],
      ["ep-exdos13.rom", 0, "ep-ext"],
      ["ep-exdos13.rom", 1, "ep-ext"]
    ];
    for (const [name, n, kind] of expected) {
      const identity = romPageIdentity(page(name, n));
      expect(knownRomPageKind(identity), `${name}:${n}`).toBe(kind);
      expect(KNOWN_ROM_PAGES[identity.crc32].file, `${name}:${n}`).toBe(name);
      expect(KNOWN_ROM_PAGES[identity.crc32].page ?? 0, `${name}:${n}`).toBe(n);
      expect(romKindOrigin(knownRomPageKind(identity)), `${name}:${n}`).toBe(0xc000);
    }
  });

  it("decodes EXOS at $C000 and counts its targets from there", async () => {
    const bytes = page("ep-exos21.rom", 0);
    // --- Offset 5: JP $C02E, the reset code's jump into page 3, is offset $002E
    expect(Array.from(bytes.subarray(5, 8))).toEqual([0xc3, 0x2e, 0xc0]);
    const decoded = await romDecoderFor("ep-exos")(bytes, 0, 0x40);
    expect(decoded.find((i) => i.offset === 5)?.target).toBe(0x2e);
  });

  it("decodes the byte after RST 30h as data", async () => {
    const bytes = page("ep-exos21.rom", 0);
    // --- $3FAD: RST 30h / $08 (write block). Read as code, the $08 would be EX AF,AF'
    expect(Array.from(bytes.subarray(0x3fad, 0x3faf))).toEqual([0xf7, 0x08]);
    const decoded = await romDecoderFor("ep-exos")(bytes, 0x3fad, 0x3fb3);
    expect(decoded.find((i) => i.offset === 0x3fad)?.length).toBe(1);
    expect(decoded.find((i) => i.offset === 0x3fae)).toBeDefined();
    expect(decoded.find((i) => i.offset === 0x3faf)).toBeDefined();
  });
});

describe("EXOS 2.1's segment 01h", () => {
  it("lists IS-BASIC's call list after RST 10h as data", async () => {
    const bytes = page("ep-exos21.rom", 1);
    // --- $0316: RST 10h / $8C $20 $00 (segment 1's entry 12, the BASIC ROM's entry 32, the end), then BIT 1,C
    expect(Array.from(bytes.subarray(0x316, 0x31c))).toEqual([0xd7, 0x8c, 0x20, 0x00, 0xcb, 0x49]);
    const decoded = await romDecoderFor("ep-exos-basic")(bytes, 0x316, 0x31c);
    expect(decoded.filter((i) => i.offset >= 0x317 && i.offset <= 0x319).map((i) => i.length)).toEqual([1, 1, 1]);
    expect(decoded.find((i) => i.offset === 0x31a)?.length).toBe(2);
  });

  it("lists the IS-BASIC cartridge's call lists as data too", async () => {
    const bytes = page("ep-basic21.rom", 0);
    // --- $0823: RST 10h / $BB $00 (segment 1's AUTO), then RET
    expect(Array.from(bytes.subarray(0x823, 0x827))).toEqual([0xd7, 0xbb, 0x00, 0xc9]);
    const decoded = await romDecoderFor("ep-basic")(bytes, 0x823, 0x827);
    expect(decoded.filter((i) => i.offset >= 0x824 && i.offset <= 0x825).map((i) => i.length)).toEqual([1, 1]);
    expect(decoded.find((i) => i.offset === 0x826)?.length).toBe(1);
  });

  it("keeps RST 10h an instruction on EXOS's segment 00h", async () => {
    const bytes = new Uint8Array(0x4000);
    // --- RST 10h / LD A,5: in a BASIC page the $3E would be a routine byte
    bytes.set([0xd7, 0x3e, 0x05, 0x00], 0x100);
    expect((await romDecoderFor("ep-exos")(bytes, 0x100, 0x103)).find((i) => i.offset === 0x101)?.length).toBe(2);
    expect((await romDecoderFor("ep-exos-basic")(bytes, 0x100, 0x103)).find((i) => i.offset === 0x101)?.length).toBe(1);
  });
});

describe("the live disassembly of segment 01h", () => {
  // --- What the Disassembly panel does: the machine's custom disassembler, gated by the context the
  // --- bank space and the ROM sources give for this paging (page 3 = segment 1, the others RAM)
  async function listAt(page3: number, start: number, end: number, bytesOf = page3) {
    const memory = new Uint8Array(0x10000);
    memory.set(page("ep-exos21.rom", bytesOf), 0xc000);
    const slots = [0xf8, 0xf8, 0xf9, 0xf9, 0xff, 0xff, page3, page3];
    const context = customDisassemblyContextFor(MI_ENTERPRISE, epBankSpace(true), slots, (rom) =>
      rom <= 1 ? romPageIdentity(page("ep-exos21.rom", rom)) : undefined
    );
    const factory = machineRegistry.find((m) => m.machineId === MI_ENTERPRISE)!.toolInfo![CT_CUSTOM_DISASSEMBLER] as (
      context?: unknown
    ) => ICustomDisassembler;
    const map = new MemoryMap();
    map.add(new MemorySection(start, end));
    const disassembler = new Z80Disassembler(map.sections, memory, undefined, { getRomPage: () => -1 });
    disassembler.setCustomDisassembler(factory(context));
    return (await disassembler.disassemble())!.outputItems.map((i) => i.instruction?.toLowerCase());
  }

  it("lists IS-BASIC's call lists as data when segment 1 is in page 3", async () => {
    // --- $C5F0: FP_EXP, RST 10h / $15 $92 $23 $0E $AE $0A $00, then JR Z
    expect((await listAt(1, 0xc5f0, 0xc5f8)).slice(0, 9)).toEqual([
      "rst $10",
      ".defb $15",
      ".defb $92",
      ".defb $23",
      ".defb $0e",
      ".defb $ae",
      ".defb $0a",
      ".defb $00",
      "jr z,lc603"
    ]);
  });

  it("keeps RST 10h an instruction when the paging shows segment 0", async () => {
    // --- The same bytes, but the slots say segment 0 is in page 3: no IS-BASIC decoding
    const listed = await listAt(0, 0xc5f0, 0xc5f2, 1);
    expect(listed.slice(0, 3)).toEqual(["rst $10", "dec d", "sub d"]);
  });
});

describe("the Enterprise bank space's ROM segments", () => {
  const space = epBankSpace(true);
  // --- Page 0 the null segment F8h, page 1 F9h, page 2 the system segment, page 3 EXOS's segment 1
  const slots = [0xf8, 0xf8, 0xf9, 0xf9, 0xff, 0xff, 0x01, 0x01];

  it("names a ROM segment a ROM page, though its partition is positive", () => {
    expect(space.siteAt(0xc123, slots)).toEqual({ kind: "rom", partition: 1, offset: 0x123 });
    expect(space.siteAt(0x4123, slots)).toEqual({ kind: "bank", bank: 0xf9, offset: 0x123 });
    for (const segment of [0x00, 0x01, 0x04, 0x10, 0x20, 0x21]) expect(isRomPartitionOf(space, segment)).toBe(true);
    expect(isRomPartitionOf(space, 0xf8)).toBe(false);
    expect(partitionSite(0x00, space)).toEqual({ kind: "rom", partition: 0, offset: 0 });
    expect(partitionSite(0xf8, space)).toEqual({ kind: "bank", bank: 0xf8, offset: 0 });
  });

  it("lists a ROM segment at $C000", () => {
    expect(space.romBase?.(0x00)).toBe(0xc000);
    expect(space.romBase?.(0x20)).toBe(0xc000);
    expect(space.romBase?.(0xf8)).toBeUndefined();
  });

  it("keeps the negative partitions as ROM elsewhere", () => {
    expect(isRomPartitionOf(sp128BankSpace, -1)).toBe(true);
    expect(isRomPartitionOf(sp128BankSpace, 3)).toBe(false);
  });
});

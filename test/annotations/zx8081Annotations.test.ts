import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { zx81SysVars } from "@emu/machines/zx8081/Zx81SysVars";
import { zx80SysVars } from "@emu/machines/zx8081/Zx80SysVars";
import { ZX81_D_FILE, ZX81_E_LINE, ZX81_MODE } from "@emu/machines/zx8081/zx8081MachineInfo";
import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";
import { machineCharSetOf } from "@renderer/appIde/annotations/machineCharSet";
import { customDisassemblyContextFor } from "@renderer/appIde/annotations/romDisassemblyGate";
import { zx8081BankSpace } from "@common/annotations/bankSpace";
import { KNOWN_ROM_PAGES, isZx81Rom, romCrc32 } from "@common/roms/romIdentity";
import { MI_ZX80, MI_ZX81 } from "@common/machines/constants";

/*
 * The ZX80 and ZX81 in the annotation model (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`
 * §4.7), and the ROM identity table the ROM annotations are found by (§5.3).
 */

describe("the ZX80/ZX81 system variables", () => {
  const byName = (vars: typeof zx81SysVars) => new Map(vars.map((v) => [v.name, v.address]));

  it("agree with the addresses the IDE already uses", () => {
    const zx81 = byName(zx81SysVars);
    expect(zx81.get("D_FILE")).toBe(ZX81_D_FILE);
    expect(zx81.get("E_LINE")).toBe(ZX81_E_LINE);
    expect(zx81.get("MODE")).toBe(ZX81_MODE);
    // --- A .p file starts at VERSN (`ZxPFile`)
    expect(zx81.get("VERSN")).toBe(0x4009);
    const zx80 = byName(zx80SysVars);
    // --- A .o file's VARS, E_LINE and D_FILE (`ZxPFile`)
    expect([zx80.get("VARS"), zx80.get("E_LINE"), zx80.get("D_FILE")]).toEqual([0x4008, 0x400a, 0x400c]);
  });

  it("are sorted, do not overlap, and name each variable once", () => {
    for (const vars of [zx81SysVars, zx80SysVars]) {
      const names = new Set<string>();
      let end = 0;
      for (const v of vars) {
        expect(names.has(v.name)).toBe(false);
        names.add(v.name);
        expect(v.address).toBeGreaterThanOrEqual(end);
        const size = v.length ?? (v.type === 2 ? 2 : 1);
        end = v.address + size;
        expect(v.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
    }
  });
});

describe("text regions", () => {
  const annotations = (type: "text") => ({
    schemaVersion: 3,
    machine: "zx81" as const,
    banks: {
      "1": {
        offsetIndex: 1 as const,
        regions: [
          { start: 0, end: 4, type },
          { start: 5, end: 0x3fff, type: "disassemble" as const }
        ]
      }
    }
  });

  it("decode with the ZX81's own character set, as .defb rows that reassemble", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0x2d, 0x2a, 0x31, 0x31, 0x34], 0); // HELLO in the ZX81 set
    const items = await createAnnotatedDisassemblyItems({
      annotations: annotations("text"),
      bank: 1,
      contents,
      disassOffset: 0x4000,
      allowExtendedSet: false,
      charSet: machineCharSetOf(MI_ZX81)
    });
    expect(items![0]).toMatchObject({
      address: 0x4000,
      instruction: ".defb $2D, $2A, $31, $31, $34",
      hardComment: '"HELLO"'
    });
  });

  it("decode with the ZX80's, whose letters are where the ZX81's are but whose symbols are not", () => {
    const zx80 = machineCharSetOf(MI_ZX80)!;
    const zx81 = machineCharSetOf(MI_ZX81)!;
    expect(zx80(0x26)).toBe("A");
    expect(zx81(0x26)).toBe("A");
    expect(zx80(0x01)).toBe('"');
    expect(zx81(0x0b)).toBe('"');
    // --- Inverse characters are bracketed
    expect(zx81(0x80 | 0x26)).toBe("[A]");
    expect(machineCharSetOf("sp48")).toBeUndefined();
  });

  it("decode as ASCII .defm on a Spectrum, with a bit-7 terminator on a row of its own", async () => {
    const contents = new Uint8Array(0x4000);
    contents.set([0x48, 0x49, 0x80 | 0x21], 0); // "HI!" with bit 7 on the last
    const items = await createAnnotatedDisassemblyItems({
      annotations: { ...annotations("text"), machine: "rom" as const },
      bank: 1,
      contents,
      disassOffset: 0,
      range: { start: 0, end: 2 }
    });
    expect(items!.map((item) => item.instruction)).toEqual(['.defm "HI"', ".defb $A1"]);
    expect(items![1].hardComment).toBe('"!" + $80');
  });
});

describe("the ZX81 calculator decoding", () => {
  const space = zx8081BankSpace("zx81", { ramKb: 16, rom8k: true });
  const identity = { crc32: "4b1dd6eb", size: 0x2000 };

  it("is gated on the ZX81 ROM: RAM bytes after RST $28 stay code", () => {
    const context = customDisassemblyContextFor(MI_ZX81, space, undefined, () => identity);
    expect(context.inDescribedRom(0x1000)).toBe(true);
    expect(context.inDescribedRom(0x3000)).toBe(true); // the ROM's mirror
    expect(context.inDescribedRom(0x4100)).toBe(false);
  });

  it("applies to a ZX80 with the 8K ROM, and not to the ZX80's own", () => {
    expect(isZx81Rom(MI_ZX80, identity)).toBe(true);
    expect(isZx81Rom(MI_ZX80, { crc32: "4c7fc597", size: 0x1000 })).toBe(false);
  });
});

describe("KNOWN_ROM_PAGES", () => {
  const ROMS = join(__dirname, "../../src/public/roms");

  it("is in step with the ROM files Klive ships", () => {
    for (const [crc, entry] of Object.entries(KNOWN_ROM_PAGES)) {
      const bytes = new Uint8Array(readFileSync(join(ROMS, entry.file)));
      expect(romCrc32(bytes), entry.file).toBe(crc);
    }
  });

  it("knows every Spectrum, ZX80 and ZX81 ROM page Klive ships", () => {
    const shipped = readdirSync(ROMS).filter((name) => /^(sp(48|128|p3)|zx8[01]).*\.rom$/.test(name) && name !== "sp48-alt1.rom");
    expect(shipped.length).toBeGreaterThan(20);
    const known = new Set(Object.values(KNOWN_ROM_PAGES).map((entry) => entry.file));
    for (const name of shipped) {
      const bytes = new Uint8Array(readFileSync(join(ROMS, name)));
      // --- spp3e-3 is byte-identical to spp3-40-3, so it is known by that file's entry
      expect(known.has(name) || !!KNOWN_ROM_PAGES[romCrc32(bytes)], name).toBe(true);
    }
  });
});

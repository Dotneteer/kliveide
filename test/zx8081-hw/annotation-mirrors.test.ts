import { describe, expect, it } from "vitest";

import {
  zx8081BankSpace,
  zx8081MemoryModelOf,
  zx8081RomAddresses
} from "@common/annotations/bankSpace";
import { ZX80_MODELS, ZX81_MODELS } from "@emu/machines/zx8081/zx8081MachineInfo";
import { createZx81Session } from "../harness/zx81";

/*
 * The ZX80/ZX81 bank spaces against the real core (`.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`
 * §4.7, T11): for every model, each address folds to the canonical address the core itself reads,
 * and every mirror the bank space reports for a site reads the same byte. A fold made without the
 * model would put a 1K program's label on a 64K machine's unrelated byte; this is what proves the
 * arithmetic follows the core rather than a second opinion about it.
 */

const MODELS = [
  ...ZX81_MODELS.map((model) => ({ machineId: "zx81" as const, model })),
  ...ZX80_MODELS.map((model) => ({ machineId: "zx80" as const, model }))
];

describe.each(MODELS)("$machineId $model.modelId", ({ machineId, model }) => {
  const memory = zx8081MemoryModelOf(machineId, model.config);
  const space = zx8081BankSpace(machineId, memory);

  it("folds every RAM address to the byte the core reads there", async () => {
    const s = await createZx81Session({ machineId, model: model.modelId });
    const ramBase = memory.ramKb === 64 ? 0x2000 : 0x4000;
    // --- A spread of addresses over the whole RAM area, mirrors included
    for (let address = ramBase; address <= 0xffff; address += 0x0123) {
      const canonical = space.canonicalAddress(address);
      // --- Mark the canonical byte, then read it back through the address
      const marker = (canonical * 7 + 1) & 0xff;
      s.poke(canonical, marker);
      expect(s.peek(address), `$${address.toString(16)} -> $${canonical.toString(16)}`).toBe(marker);
      // --- ...and the site it names maps back to the same canonical byte
      const site = space.siteAt(address, undefined);
      expect(site?.kind).toBe("bank");
      if (site?.kind === "bank") {
        expect(site.bank * 0x4000 + site.offset).toBe(canonical);
      }
    }
  });

  it("reports as mirrors exactly the addresses that read the canonical byte", async () => {
    const s = await createZx81Session({ machineId, model: model.modelId });
    const canonical = space.canonicalAddress(memory.ramKb === 64 ? 0x2082 : 0x4082);
    const site = space.siteAt(canonical, undefined);
    if (site?.kind !== "bank") throw new Error("not a bank site");
    const mirrors = space.addressesOf({ bank: site.bank, offset: site.offset }, undefined);
    expect(mirrors[0]).toBe(canonical);
    s.poke(canonical, 0xa5);
    for (const mirror of mirrors) expect(s.peek(mirror)).toBe(0xa5);
    // --- A byte that is not a mirror is a different byte
    s.poke(canonical, 0x5a);
    for (let address = 0x2000; address <= 0xffff; address += 0x0101) {
      if (mirrors.includes(address) || address < (memory.ramKb === 64 ? 0x2000 : 0x4000)) continue;
      if (space.canonicalAddress(address) === canonical) continue;
      expect(mirrors).not.toContain(address);
    }
  });

  it("finds the ROM at each of its mirrors below the RAM", async () => {
    const s = await createZx81Session({ machineId, model: model.modelId });
    for (const offset of [0x0000, 0x0123, memory.rom8k ? 0x1fff : 0x0fff]) {
      const addresses = zx8081RomAddresses(memory, offset);
      for (const address of addresses) {
        expect(s.peek(address)).toBe(s.peek(offset));
        expect(space.siteAt(address, undefined)).toEqual({ kind: "rom", partition: -1, offset });
      }
    }
  });

  it("names its ROM by identity: the ZX81 ROM (also the ZX80 upgrade) or the ZX80's", async () => {
    const s = await createZx81Session({ machineId, model: model.modelId });
    const sources = (s.machine as unknown as { getRomSources(): Record<number, { crc32: string; size: number; path?: string }> }).getRomSources();
    expect(Object.keys(sources)).toEqual(["-1"]);
    expect(sources[-1]).toMatchObject(
      memory.rom8k
        ? { crc32: "4b1dd6eb", size: 0x2000, path: "roms/zx81.rom" }
        : { crc32: "4c7fc597", size: 0x1000, path: "roms/zx80.rom" }
    );
  });
});

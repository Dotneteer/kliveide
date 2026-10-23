import { describe, expect, it } from "vitest";

import { knownRomPageKind, type RomSource } from "@common/roms/romIdentity";
import { bankSpaceFor } from "@common/annotations/bankSpace";
import { MI_HT1080Z } from "@common/machines/constants";
import { createHtSession } from "../harness/ht1080z";

/*
 * Where each HT-1080Z ROM page came from (`getRomSources`), on the real core: the BASIC and the
 * extension are two pages, each its own file, so each finds its own ROM annotations by CRC. The
 * BASIC's sidecar is `ht1080z-s1.rom.dis` on Series I and II, whose BASIC images are identical.
 */

const sourcesOf = (machine: unknown) =>
  (machine as { getRomSources(withBytes?: boolean): Record<number, RomSource> }).getRomSources();

describe("getRomSources on the HT-1080Z", () => {
  it.each([
    ["ht1080z-s1", "2bfef8f7", "ht1080z-s1", "2a851e33"],
    ["ht1080z-s2", "2bfef8f7", "ht1080z-s2", "07415ac6"],
    ["ht1080z-64", "48985a30", "ht1080z-s64", "fc12bd28"],
    ["ht1080z-s1-48k", "2bfef8f7", "ht1080z-s1", "2a851e33"]
  ])("%s reports the BASIC at -1 and the extension at -2", async (model, basicCrc, file, extCrc) => {
    const s = await createHtSession({ model });
    const sources = sourcesOf(s.machine);
    expect(Object.keys(sources).map(Number).sort((a, b) => a - b)).toEqual([-2, -1]);
    expect(sources[-1]).toEqual({ crc32: basicCrc, size: 0x3000, path: `roms/${file}.rom`, page: 0 });
    expect(sources[-2]).toEqual({ crc32: extCrc, size: 0x0800, path: `roms/${file}-ext.rom`, page: 0 });
    expect(knownRomPageKind(sources[-1])).toBe("ht1080z-basic");
  });

  it("places each page where the bank space says it is", async () => {
    const s = await createHtSession({ model: "ht1080z-s1" });
    const space = bankSpaceFor(MI_HT1080Z, { memSize: 16 })!;
    expect(space.siteAt(0x1c96, undefined)).toEqual({ kind: "rom", partition: -1, offset: 0x1c96 });
    expect(space.siteAt(0x3005, undefined)).toEqual({ kind: "rom", partition: -2, offset: 0x0005 });
    const ext = (s.machine as any).getRomSources(true)[-2].bytes as Uint8Array;
    expect(ext[5]).toBe(s.peek(0x3005));
  });
});

import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { CimFile } from "@main/fat32/CimFileManager";
import { NEXT_ROM_SETS } from "@common/zxnext/romSets";
import { NEXT_PROFILE_IDS, NEXT_PROFILES } from "@emu/machines/zxNext/nextProfiles";
import { createSession, type SdCardBacking } from "../../harness/zxnext";
import { REPO_ROOT } from "../../harness/zxnext/core/machines";

/*
 * Each Next model boots its own NextZXOS from its own base SD card (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md`
 * D6, D7, P5) and settles in the key-wait loop its ROM set's facts name: the point the code-injection
 * flow (`buildNextCodeInjectionFlow`) waits for before it types `.nexload`. A ROM set whose facts were
 * wrong would hang code injection; this catches it before a user does.
 *
 * The card is a copy of the committed base image: NextZXOS writes to it while it boots.
 */

const work = mkdtempSync(join(tmpdir(), "klive-nextzxos-boot-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));

/** A `.cim` image as the harness's SD card */
function cimCard(file: string): SdCardBacking & { close(): void } {
  const cim = new CimFile(file);
  const info = cim.cimInfo;
  return {
    totalSectors: (info.clusterCount * info.clusterSize * 128) / info.sectorSize,
    readSector: (sector) => cim.readSector(sector),
    writeSector: (sector, data) => cim.writeSector(sector, data),
    close: () => cim.close()
  };
}

describe.each(NEXT_PROFILE_IDS)("%s boots NextZXOS", (profileId) => {
  const profile = NEXT_PROFILES[profileId];
  const set = NEXT_ROM_SETS[profile.romSet];

  it(`from its NextZXOS ${set.nextZxOs} card, into the ROM set's key-wait loop`, async () => {
    const card = join(work, `${profileId}.cim`);
    copyFileSync(join(REPO_ROOT, "src/public", set.sdBaseImage.file), card);
    const sd = cimCard(card);
    try {
      const s = await createSession({ profile: profileId });
      s.attachSdCard(sd);
      const [from, to] = set.facts.keyWaitLoop;
      const inLoop = () => s.machine.pc >= from && s.machine.pc <= to;
      // --- Settled: in the loop at the end of 25 frames in a row
      let settled = 0;
      for (let frame = 0; frame < 2_000 && settled < 25; frame++) {
        await s.runFramesAsync(1);
        settled = inLoop() ? settled + 1 : 0;
      }
      expect(settled, `PC=$${s.machine.pc.toString(16)} after the boot`).toBe(25);
      expect(s.peek(set.facts.mainWaitingLoop), "HALT, read through ROM 0").toBe(0x76);
    } finally {
      sd.close();
    }
  }, 300_000);
});

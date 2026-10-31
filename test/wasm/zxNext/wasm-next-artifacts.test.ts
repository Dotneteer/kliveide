import { describe, expect, it } from "vitest";

import { NEXT_PROFILE_IDS, NEXT_PROFILES, nextProfileOf } from "@emu/machines/zxNext/nextProfiles";
import { MachineStateMismatchError } from "@emu/machines/state/wasmStateImage";
import { ZXNEXT_ARTIFACTS } from "../../../scripts/zxnext-artifacts.cjs";
import { createSession } from "../../harness/zxnext";

/*
 * One WASM artifact per Next model's hardware (`.plans/ZXNEXT_CORE_VERSIONS_PLAN.md` D3, P3): the
 * build's artifact list follows the profiles, each artifact loads with its own identity, and a state
 * saved on one model is refused by another with a message that names both models.
 */

describe("ZX Spectrum Next artifacts", () => {
  it("builds an artifact for every profile, with the profile's core version and board", () => {
    for (const id of NEXT_PROFILE_IDS) {
      const profile = NEXT_PROFILES[id];
      const entry = ZXNEXT_ARTIFACTS.find((a: { artifact: string }) => a.artifact === profile.wasmArtifact);
      expect(entry, id).toBeDefined();
      const [major, minor, sub] = profile.coreVersion;
      expect(entry.coreVersion, id).toBe(major * 10000 + minor * 100 + sub);
      expect(entry.boardIssue, id).toBe(profile.boardIssue);
    }
    // --- KS2 / 3.02.01 keeps the artifact name every earlier build packaged
    expect(nextProfileOf().wasmArtifact).toBe("zx-spectrum-next.wasm");
  });

  for (const profile of NEXT_PROFILE_IDS) {
    it(`${profile}: loads its own artifact, which reports its core version and board`, async () => {
      const s = await createSession({ profile });
      const [major, minor, sub] = NEXT_PROFILES[profile].coreVersion;
      expect(s.readNextReg(0x01)).toBe((major << 4) | minor);
      expect(s.readNextReg(0x0e)).toBe(sub);
      expect(s.readNextReg(0x0f)).toBe(NEXT_PROFILES[profile].boardIssue);
      expect(s.machine.profile.id).toBe(profile);
    });
  }

  it("refuses a state saved on another Next model, naming both models", async () => {
    const older = await createSession({ profile: "ks2-30201" });
    const newer = await createSession({ profile: "ks2-30204" });
    const saved = older.machine.saveMachineState();
    expect(saved.coreId).toBe("zxnext");
    let error: unknown;
    try {
      newer.machine.loadMachineState(saved);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(MachineStateMismatchError);
    expect(String((error as Error).message)).toContain("KS2, core 3.02.01");
    expect(String((error as Error).message)).toContain("KS2, core 3.02.04");
    // --- ...and the same model takes it back
    expect(() => older.machine.loadMachineState(saved)).not.toThrow();
  });
});

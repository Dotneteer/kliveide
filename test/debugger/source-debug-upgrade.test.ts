import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import { createSourceDebugSidecar, readSourceDebugSidecar } from "@common/utils/source-debug-sidecar";
import { upgradeActivationKind, upgradeSourceLevelDebug } from "@common/utils/source-debug-upgrade";

/**
 * The version-1 -> version-2 upgrade of the source-level debug model
 * (`.plans/SHARED_Z80_BACKEND_PLAN.md` §12.1, "Compatibility"). `goldens-v1/` holds what every
 * producer wrote before the model became language-neutral; upgraded, each must be exactly what the
 * producer writes now (`goldens/`, checked by `producer-goldens.test.ts`).
 */
const V1 = path.join(__dirname, "goldens-v1");
const V2 = path.join(__dirname, "goldens");
const read = (folder: string, file: string) => JSON.parse(readFileSync(path.join(folder, file), "utf8")) as SourceLevelDebugInfo;

describe("source-level debug model: the version-1 upgrade", () => {
  for (const file of readdirSync(V1).filter((f) => f.endsWith(".json"))) {
    it(`upgrades ${file} to what its producer writes now`, () => {
      expect(upgradeSourceLevelDebug(read(V1, file))).toEqual(read(V2, file));
    });
  }

  it("passes version-2 information through unchanged", () => {
    for (const file of readdirSync(V2).filter((f) => f.endsWith(".json"))) {
      expect(upgradeSourceLevelDebug(read(V2, file)), file).toEqual(read(V2, file));
    }
  });

  it("upgrades a version-1 sidecar as it reads it, and writes version 2", () => {
    const nex = new Uint8Array([1, 2, 3]);
    const v1 = JSON.parse(createSourceDebugSidecar(nex, read(V1, "kbasic-control-on-gosub-zxbas.json")));
    v1.version = 1;
    const result = readSourceDebugSidecar(JSON.stringify(v1), nex);
    expect("info" in result && result.info).toEqual(read(V2, "kbasic-control-on-gosub-zxbas.json"));
    expect(JSON.parse(createSourceDebugSidecar(nex, read(V2, "z88dk-zx-hello.json"))).version).toBe(2);
  });

  it("names activations in version 2's terms", () => {
    expect(["main", "routine", "gosub", "local"].map(upgradeActivationKind)).toEqual(["entry", "routine", "local", "local"]);
  });
});

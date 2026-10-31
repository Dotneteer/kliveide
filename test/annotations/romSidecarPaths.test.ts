import { describe, expect, it } from "vitest";

import {
  canonicalShippedSidecar,
  managedSidecarOf,
  shippedSidecarOfWorkingCopy,
  sidecarFileName,
  workingCopyRelativePath
} from "@common/roms/romSidecarPaths";

/*
 * Shipped sidecars are named by their path under src/public/roms; the nextzxos-2.08 set's working
 * copies stay flat in RomAnnotations/, where people's work predates the set folders.
 */

const NEXT = "zxnext/nextzxos-2.08/enNextZX.rom.dis";

describe("romSidecarPaths", () => {
  it("keeps the nextzxos-2.08 working copies flat, and every flat ROM's", () => {
    expect(workingCopyRelativePath(NEXT)).toBe("RomAnnotations/enNextZX.rom.dis");
    expect(workingCopyRelativePath("sp48.rom.dis")).toBe("RomAnnotations/sp48.rom.dis");
  });

  it("puts another set's working copies in its set folder", () => {
    expect(workingCopyRelativePath("zxnext/nextzxos-2.1x/enNextZX.rom.dis")).toBe(
      "RomAnnotations/zxnext/nextzxos-2.1x/enNextZX.rom.dis"
    );
  });

  it("reads a bare Next name as the nextzxos-2.08 set's", () => {
    expect(canonicalShippedSidecar("enNextZX.rom.dis")).toBe(NEXT);
    expect(canonicalShippedSidecar("sp48.rom.dis")).toBe("sp48.rom.dis");
    expect(workingCopyRelativePath("enNextZX.rom.dis")).toBe("RomAnnotations/enNextZX.rom.dis");
    expect(shippedSidecarOfWorkingCopy("enNextZX.rom.dis")).toBe(NEXT);
  });

  it("tells a shipped sidecar or a working copy from one beside a custom ROM", () => {
    expect(managedSidecarOf(`roms/${NEXT}`)).toEqual({ sidecar: NEXT, location: "shipped" });
    expect(managedSidecarOf(`/app/resources/roms/${NEXT}`)).toEqual({ sidecar: NEXT, location: "shipped" });
    expect(managedSidecarOf("/h/Klive/RomAnnotations/enNextZX.rom.dis")).toEqual({ sidecar: NEXT, location: "working" });
    expect(managedSidecarOf("/h/Klive/RomAnnotations/sp48.rom.dis")).toEqual({ sidecar: "sp48.rom.dis", location: "working" });
    expect(managedSidecarOf("/h/my/roms/sp48.rom.dis")).toBeUndefined();
    expect(managedSidecarOf("/h/my/game.rom.dis")).toBeUndefined();
    expect(sidecarFileName(NEXT)).toBe("enNextZX.rom.dis");
  });
});

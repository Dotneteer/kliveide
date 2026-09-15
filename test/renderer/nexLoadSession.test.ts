import { describe, it, expect, beforeEach } from "vitest";

import {
  clearNexLoad,
  describeNexBankProvenance,
  getNexLoad,
  recordNexLoad,
  resetNexLoadSessionForTests,
  type NexLoadSession
} from "@renderer/appIde/DocumentPanels/Next/nexLoadSession";

/*
 * Which NEX was launched, and which of the Memory Mapping panel's slots hold its banks.
 *
 * The interesting part is what this deliberately does *not* claim. RAM has no provenance: nothing in
 * the machine records that a bank was written by a NEX loader rather than by the program or by
 * another NEX loaded afterwards. So the wording is a fact about the *file*, and the tests below pin
 * that wording as much as the matching. See `.plans/NEX_DEBUGGING_PLAN.md` §11.5.
 */

beforeEach(() => resetNexLoadSessionForTests());

describe("the load session registry", () => {
  it("records the path, the file name and the banks", () => {
    recordNexLoad("/home/me/games/Game.nex", [5, 2, 20]);
    expect(getNexLoad()).toEqual({
      path: "/home/me/games/Game.nex",
      fileName: "Game.nex",
      banks: [5, 2, 20]
    });
  });

  it("takes the file name from either separator", () => {
    recordNexLoad("C:\\Projects\\Demo.nex", []);
    expect(getNexLoad()!.fileName).toEqual("Demo.nex");
  });

  it("replaces a previous record rather than accumulating", () => {
    // --- Two NEX files cannot both be the one that was launched, and leaving the old record would
    // --- attribute the new program's banks to the wrong file.
    recordNexLoad("/p/First.nex", [5]);
    recordNexLoad("/p/Second.nex", [6]);
    expect(getNexLoad()).toMatchObject({ fileName: "Second.nex", banks: [6] });
  });

  it("copies the bank list, so a caller cannot mutate it afterwards", () => {
    const banks = [5, 2];
    recordNexLoad("/p/Game.nex", banks);
    banks.push(99);
    expect(getNexLoad()!.banks).toEqual([5, 2]);
  });

  it("can be cleared", () => {
    recordNexLoad("/p/Game.nex", [5]);
    clearNexLoad();
    expect(getNexLoad()).toEqual(undefined);
  });

  it("starts with nothing", () => {
    expect(getNexLoad()).toEqual(undefined);
  });
});

describe("describeNexBankProvenance", () => {
  const loaded: NexLoadSession = {
    path: "/p/Game.nex",
    fileName: "Game.nex",
    banks: [0, 2, 5, 20]
  };

  it("names the file for a bank the file declares", () => {
    const text = describeNexBankProvenance(loaded, 5);
    expect(text).toContain("Game.nex");
  });

  it("says the bank may have changed, because that cannot be known from here", () => {
    // --- The whole reason the wording is about the file rather than about the slot's contents.
    expect(describeNexBankProvenance(loaded, 5)).toContain("may have changed it since");
    expect(describeNexBankProvenance(loaded, 5)).toContain("as launched");
  });

  it("says nothing for a bank the file does not declare", () => {
    expect(describeNexBankProvenance(loaded, 7)).toEqual(undefined);
  });

  it("says nothing when no NEX has been launched", () => {
    expect(describeNexBankProvenance(undefined, 5)).toEqual(undefined);
  });

  it("claims bank 0 when the file declares it", () => {
    // --- Bank 0 is falsy, and `includes` is the only test that survives that.
    expect(describeNexBankProvenance(loaded, 0)).toContain("Game.nex");
  });

  it("says nothing for a ROM page, which has no 16K bank", () => {
    // --- The emulator reports -1 and the panel renders `--`; there is no bank to attribute.
    expect(describeNexBankProvenance(loaded, -1)).toEqual(undefined);
    expect(describeNexBankProvenance(loaded, -7)).toEqual(undefined);
  });

  it("says nothing for the no-bank placeholder", () => {
    /*
     * `0xff` is what both machines write for an unpaged page. Excluded explicitly rather than by
     * relying on the lookup missing: a NEX cannot declare bank $FF (the format stops at 111), but
     * a placeholder that happened to collide with a real bank would attribute an empty slot.
     */
    expect(describeNexBankProvenance(loaded, 0xff)).toEqual(undefined);
  });

  it("says nothing for an absent bank", () => {
    expect(describeNexBankProvenance(loaded, null)).toEqual(undefined);
    expect(describeNexBankProvenance(loaded, undefined)).toEqual(undefined);
  });

  it("says nothing for a file that declares no banks at all", () => {
    const empty: NexLoadSession = { path: "/p/Empty.nex", fileName: "Empty.nex", banks: [] };
    expect(describeNexBankProvenance(empty, 5)).toEqual(undefined);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseZ88Snapshot } from "@common/z88/z88Snapshot";
import {
  parseZ88BankDocumentId,
  readZ88BankBytes,
  z88BankDumpId,
  z88BankDumpTitle
} from "@renderer/appIde/DocumentPanels/Z88/z88BankDocument";

/*
 * The identity of a `.z88` bank's pop-out document, and reading its bytes back from the file
 * (`.plans/Z88_SLOT_BROWSER_PLAN.md` §4.4).
 */

const SAMPLE_PATH = join(__dirname, "fixtures", "mm+jsw-oz5.z88");
const readFile = async (path: string) => new Uint8Array(readFileSync(path));

describe("Z88 bank documents", () => {
  it("are keyed by the full path, and titled relative to the project", () => {
    expect(z88BankDumpId("/p/games/mm.z88", 0x81)).toBe("z88BankDump/p/games/mm.z88:129");
    expect(z88BankDumpTitle("/p/games/mm.z88", 0x81, "/p")).toBe("games/mm.z88 - Bank $81");
    expect(z88BankDumpTitle("/elsewhere/mm.z88", 0x81, "/p")).toBe("/elsewhere/mm.z88 - Bank $81");
  });

  it("parse back to the file and bank they were opened for", () => {
    expect(parseZ88BankDocumentId(`memoryDump-${z88BankDumpId("C:\\Z88\\a.z88", 5)}`)).toEqual({
      path: "C:\\Z88\\a.z88",
      bank: 5
    });
    expect(parseZ88BankDocumentId("memoryDump-bankDump/p/a.nex:5")).toBeUndefined();
  });

  it("read a bank's bytes back from the file", async () => {
    const snapshot = parseZ88Snapshot(await readFile(SAMPLE_PATH));
    // --- Slot 2's 32K EPROM: bank $81 is its second 16K
    const card = snapshot.slots[2]!.bytes!;
    expect(await readZ88BankBytes(SAMPLE_PATH, 0x81, readFile)).toEqual(card.subarray(0x4000, 0x8000));
    expect(await readZ88BankBytes(SAMPLE_PATH, 0x21, readFile)).toEqual(
      snapshot.ram.subarray(0x4000, 0x8000)
    );
  });

  it("read nothing for a bank the file does not hold", async () => {
    expect(await readZ88BankBytes(SAMPLE_PATH, 0x40, readFile)).toBeUndefined();
  });
});

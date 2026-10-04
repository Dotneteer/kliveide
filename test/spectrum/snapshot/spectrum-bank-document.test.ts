import { describe, expect, it } from "vitest";

import {
  parseSpectrumBankDocumentId,
  readSpectrumBankBytes,
  spectrumBankDumpId,
  spectrumBankDumpTitle
} from "@renderer/appIde/DocumentPanels/Spectrum/spectrumBankDocument";
import { parseNexBankDocumentId } from "@renderer/appIde/navigation/addressNavigationAdapters";
import { parseZ88BankDocumentId } from "@renderer/appIde/DocumentPanels/Z88/z88BankDocument";
import { buildSna48, buildSzx, state128, state48 } from "./builders";

/*
 * The identity of a ZX Spectrum snapshot RAM bank's pop-out document, and reading its bytes back
 * from the file, so Go Back can reopen a closed bank document.
 */

describe("ZX Spectrum snapshot bank documents", () => {
  it("are keyed by the full path, and titled relative to the project", () => {
    expect(spectrumBankDumpId("/p/games/a.szx", 3)).toBe("spectrumBankDump/p/games/a.szx:3");
    expect(spectrumBankDumpTitle("/p/games/a.szx", 3, "/p")).toBe("games/a.szx - Bank 3");
    expect(spectrumBankDumpTitle("/elsewhere/a.szx", 3, "/p")).toBe("/elsewhere/a.szx - Bank 3");
  });

  it("parse back to the file and bank they were opened for, and are no other kind's", () => {
    const id = `memoryDump-${spectrumBankDumpId("C:\\Games\\a.z80", 7)}`;
    expect(parseSpectrumBankDocumentId(id)).toEqual({ path: "C:\\Games\\a.z80", bank: 7 });
    expect(parseNexBankDocumentId(id)).toBeUndefined();
    expect(parseZ88BankDocumentId(id)).toBeUndefined();
    expect(parseSpectrumBankDocumentId("memoryDump-z88BankDump/p/a.z88:5")).toBeUndefined();
  });

  it("read a bank's bytes back from the file, by its format", async () => {
    const t = state128();
    const files: Record<string, Uint8Array> = {
      "/p/a.szx": buildSzx(t, { machineId: 2 }),
      "/p/b.sna": buildSna48(state48())
    };
    const readFile = async (path: string) => files[path];
    expect(await readSpectrumBankBytes("/p/a.szx", 6, readFile)).toEqual(t.ram.get(6));
    expect(await readSpectrumBankBytes("/p/b.sna", 5, readFile)).toEqual(state48().ram.get(5));
    // --- A 48K snapshot has no bank 7
    expect(await readSpectrumBankBytes("/p/b.sna", 7, readFile)).toBeUndefined();
  });
});

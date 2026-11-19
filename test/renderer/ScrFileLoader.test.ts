import { describe, expect, it } from "vitest";

import { withHeader } from "@common/diskfs/plus3dos";
import { loadScrFileContents } from "@renderer/appIde/DocumentPanels/Next/ScrFileViewerPanel";

/* The `.scr` viewer's loader: a bare 6912-byte screen, or one after a 128-byte PLUS3DOS header. */

describe(".scr file loader", () => {
  it("reads a bare 6912-byte screen as it is", () => {
    const bytes = new Uint8Array(6912);
    bytes[0x1800] = 0x38;
    const { fileInfo } = loadScrFileContents(bytes);
    expect(fileInfo!.length).toBe(6912);
    expect(fileInfo![0x1800]).toBe(0x38);
  });

  it("skips the PLUS3DOS header a +3 BASIC or NextBASIC SAVE writes", () => {
    const screen = new Uint8Array(6912);
    screen[0] = 0xaa;
    screen[6911] = 0x47;
    const bytes = withHeader({ name: "PIC.SCR", kind: "code", data: screen, start: 0x4000 });
    expect(bytes.length).toBe(7040);
    const { fileInfo, error } = loadScrFileContents(bytes);
    expect(error).toBeUndefined();
    expect(fileInfo!.length).toBe(6912);
    expect(fileInfo![0]).toBe(0xaa);
    expect(fileInfo![6911]).toBe(0x47);
  });

  it("refuses a 7040-byte file whose header checksum is wrong", () => {
    const bytes = withHeader({ name: "PIC.SCR", kind: "code", data: new Uint8Array(6912), start: 0x4000 });
    bytes[127] ^= 0xff;
    expect(loadScrFileContents(bytes).error).toBeDefined();
    expect(loadScrFileContents(bytes).fileInfo).toBeUndefined();
  });

  it("refuses any other size", () => {
    expect(loadScrFileContents(new Uint8Array(6000)).fileInfo).toBeUndefined();
  });
});

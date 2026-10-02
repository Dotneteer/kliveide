import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initialHeaderField,
  tapeHeaderFields
} from "@renderer/appIde/DocumentPanels/Tape/tapeHeaderFields";

/*
 * The header byte explainer's model (`tapeHeaderFields.ts`): every byte of a header belongs to one
 * field, and each field says what it means for that header's type.
 */

const tap = new Uint8Array(readFileSync(resolve(__dirname, "../../testfiles/floatspy.tap")));
// --- floatspy.tap: a Program header at offset 2, a Bytes header after the 5,478-byte program block
const PROGRAM_HEADER = tap.subarray(2, 21);
const CODE_HEADER = tap.subarray(2 + 19 + 2 + 5478 + 2, 2 + 19 + 2 + 5478 + 2 + 19);

const byKey = (fields: ReturnType<typeof tapeHeaderFields>) =>
  Object.fromEntries(fields.map((f) => [f.key, f]));

describe("tapeHeaderFields", () => {
  it("covers all 19 bytes, each exactly once, in order", () => {
    for (const header of [PROGRAM_HEADER, CODE_HEADER]) {
      const covered = tapeHeaderFields(header).flatMap((f) =>
        Array.from({ length: f.last - f.first + 1 }, (_, i) => f.first + i)
      );
      expect(covered).toEqual(Array.from({ length: 19 }, (_, i) => i));
    }
  });

  it("explains a Program header", () => {
    const f = byKey(tapeHeaderFields(PROGRAM_HEADER, 1));
    expect(f.type.value).toBe("0 · Program");
    expect(f.name.value).toBe('"Float Spy"');
    expect(f.length.meaning).toMatch(/^How many bytes data block #1 holds\. 64 15 is \$1564/);
    expect(f.param1.name).toBe("Autostart");
    expect(f.param1.value).toBe("LINE 9996");
    expect(f.param1.meaning).toMatch(/runs from line 9996/);
    expect(f.param2.name).toBe("Program");
    expect(f.param2.meaning).toMatch(/there are no saved variables/);
    expect(f.checksum.value).toBe("$21 · OK");
  });

  it("explains a Bytes header", () => {
    const f = byKey(tapeHeaderFields(CODE_HEADER));
    expect(f.type.value).toBe("3 · Bytes");
    expect(f.param1.name).toBe("Start");
    expect(f.param1.value).toBe("$7FFC (32764)");
    expect(f.param1.meaning).toMatch(/FC 7F is \$7FFC/);
    expect(f.param2.name).toBe("Unused");
    expect(f.length.meaning).toMatch(/the data block that follows/);
  });

  it("says when there is no autostart, and when variables were saved", () => {
    const h = new Uint8Array(PROGRAM_HEADER);
    h[14] = 0x00;
    h[15] = 0x80; // --- autostart 32768: none
    h[16] = 0x00;
    h[17] = 0x10; // --- program 4096 of 5476: 1380 bytes of variables
    const f = byKey(tapeHeaderFields(h));
    expect(f.param1.value).toBe("none ($8000)");
    expect(f.param2.meaning).toMatch(/remaining 1,380 are its saved variables/);
    // --- The edits broke the checksum
    expect(f.checksum.value).toMatch(/should be \$/);
    expect(f.checksum.meaning).toMatch(/R Tape loading error/);
  });

  it("names an array and points out control codes in a name", () => {
    const h = new Uint8Array(CODE_HEADER);
    h[1] = 2;
    h[15] = 0xc1; // --- a$()
    h[2] = 0x16; // --- AT
    const f = byKey(tapeHeaderFields(h));
    expect(f.param1.name).toBe("Array");
    expect(f.param1.value).toBe("a$()");
    expect(f.name.meaning).toMatch(/control codes or tokens/);
  });

  it("explains the autostart or load address first", () => {
    expect(initialHeaderField(tapeHeaderFields(PROGRAM_HEADER))).toBe("param1");
    expect(initialHeaderField(tapeHeaderFields(CODE_HEADER))).toBe("param1");
  });
});

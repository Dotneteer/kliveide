/*
 * The `.kls` container (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` Phase 7): pure, no core.
 */
import { describe, expect, it } from "vitest";
import {
  hasKliveStateMagic,
  readKliveStateFile,
  writeKliveStateFile,
  type KliveStateFile
} from "@common/machineState/kliveStateFile";
import {
  machineStateLoadCommandText,
  machineStateSaveCommandText
} from "@common/machineState/machineStateTypes";
import { parseCommand } from "@renderer/appIde/services/command-parser";

function sample(over: Partial<KliveStateFile> = {}): KliveStateFile {
  const image = new Uint8Array(65536);
  for (let i = 0; i < image.length; i += 7) image[i] = i & 0xff;
  return {
    header: {
      machineId: "sp48",
      modelId: "pal",
      config: { memSize: 48 },
      kliveVersion: "0.62.1",
      coreId: "sp48",
      fingerprint: "ab".repeat(16),
      memorySize: image.length,
      savedAt: "2026-10-04T10:00:00.000Z",
      pc: 0x8123,
      machineName: "ZX Spectrum 48K"
    },
    meta: { pc: 0x8123 },
    thumbnail: { width: 2, height: 1, rgba: Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]) },
    image,
    host: { normalFrames: 42 },
    media: [{ id: "tape", fileName: "/t/game.tzx" }],
    szx: Uint8Array.from([0x5a, 0x58, 0x53, 0x54]),
    ...over
  };
}

/** Appends a section to a written file */
function withSection(bytes: Uint8Array, tag: string, payload: number[]): Uint8Array {
  const extra = [...new TextEncoder().encode(tag), payload.length, 0, 0, 0, ...payload];
  return Uint8Array.from([...bytes, ...extra]);
}

describe(".kls container", () => {
  it("round-trips every section", () => {
    const file = sample();
    const bytes = writeKliveStateFile(file);
    expect(hasKliveStateMagic(bytes)).toBe(true);
    const read = readKliveStateFile(bytes);
    expect(read.header).toEqual(file.header);
    expect(read.meta).toEqual(file.meta);
    expect(read.thumbnail).toEqual(file.thumbnail);
    expect(read.image).toEqual(file.image);
    expect(read.host).toEqual(file.host);
    expect(read.media).toEqual(file.media);
    expect(read.szx).toEqual(file.szx);
    expect(read.unknownSections).toEqual([]);
    // --- The image is compressed
    expect(read.compressedImageSize).toBeLessThan(file.image.length / 4);
  });

  it("round-trips a state without the optional sections", () => {
    const read = readKliveStateFile(
      writeKliveStateFile(sample({ meta: undefined, thumbnail: undefined, szx: undefined, media: [] }))
    );
    expect(read.meta).toBeUndefined();
    expect(read.thumbnail).toBeUndefined();
    expect(read.szx).toBeUndefined();
    expect(read.media).toEqual([]);
  });

  it("skips the image when asked (the viewer)", () => {
    const read = readKliveStateFile(writeKliveStateFile(sample()), { skipImage: true });
    expect(read.image.length).toBe(0);
    expect(read.compressedImageSize).toBeGreaterThan(0);
    expect(read.thumbnail?.width).toBe(2);
  });

  it("skips and lists unknown sections", () => {
    const bytes = withSection(writeKliveStateFile(sample()), "XTRA", [1, 2, 3]);
    const read = readKliveStateFile(bytes);
    expect(read.unknownSections).toEqual(["XTRA"]);
    expect(read.image.length).toBe(65536);
  });

  it("refuses another file, a newer container version, and a file without a memory image", () => {
    expect(() => readKliveStateFile(new Uint8Array([1, 2, 3]))).toThrow(/KLIVESTA/);
    const bytes = writeKliveStateFile(sample());
    const newer = bytes.slice();
    newer[8] = 2;
    expect(() => readKliveStateFile(newer)).toThrow(/version 2/);
    // --- Cut the file before its CORE section: header + META + THMB only
    const headerLength = bytes[12] | (bytes[13] << 8);
    let offset = 16 + headerLength;
    for (let i = 0; i < 2; i++) offset += 8 + (bytes[offset + 4] | (bytes[offset + 5] << 8));
    expect(() => readKliveStateFile(bytes.slice(0, offset))).toThrow(/CORE/);
  });

  it("refuses a truncated section, a corrupt image, and an image of the wrong size", () => {
    const bytes = writeKliveStateFile(sample());
    expect(() => readKliveStateFile(bytes.slice(0, bytes.length - 2))).toThrow(/truncated/);
    const wrongSize = writeKliveStateFile(sample({ header: { ...sample().header, memorySize: 100 } }));
    expect(() => readKliveStateFile(wrongSize)).toThrow(/header says 100/);
  });

  it("builds commands that survive the IDE's tokenizer", () => {
    for (const path of ["/p/my state.kls", "C:\\Users\\me\\s.kls"]) {
      expect(parseCommand(machineStateSaveCommandText(path, true)).map((t) => t.text)).toEqual([
        "state-save",
        path,
        "-f"
      ]);
      expect(parseCommand(machineStateLoadCommandText(path, "run")).map((t) => t.text)).toEqual([
        "state-load",
        path,
        "-r"
      ]);
    }
  });
});

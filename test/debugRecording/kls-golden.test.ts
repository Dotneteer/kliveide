import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readKliveStateFile, writeKliveStateFile, type KliveStateFile } from "@common/machineState/kliveStateFile";

/*
 * `.plans/DEBUG_SESSION_RECORDING_PLAN.md` D4: the `.kls` container moved onto the shared
 * `chunkedContainer.ts`, and its bytes must not change. The hash was taken from the writer before
 * the move.
 */

function fixture(): KliveStateFile {
  const image = new Uint8Array(70000);
  for (let i = 0; i < image.length; i++) image[i] = (i * 7 + (i >> 9)) & 0xff;
  const rgba = new Uint8Array(4 * 3 * 4);
  rgba.forEach((_, i) => (rgba[i] = i * 5));
  return {
    header: {
      machineId: "sp48",
      kliveVersion: "0.64.0",
      coreId: "sp48",
      fingerprint: "00112233445566778899aabbccddeeff",
      memorySize: image.length,
      savedAt: "2026-10-08T12:00:00.000Z",
      pc: 0x8000,
      machineName: "ZX Spectrum 48K"
    },
    meta: { pc: 0x8000 },
    thumbnail: { width: 4, height: 3, rgba },
    image,
    host: { frames: 12, tape: "a.tap" },
    media: [{ id: "tape", fileName: "a.tap" }],
    szx: Uint8Array.from([1, 2, 3, 4, 5])
  };
}

describe(".kls golden (D4)", () => {
  it("writes the same bytes as before the container moved", () => {
    const bytes = writeKliveStateFile(fixture());
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(GOLDEN);
    const read = readKliveStateFile(bytes);
    expect(read.image).toEqual(fixture().image);
    expect(read.szx).toEqual(Uint8Array.from([1, 2, 3, 4, 5]));
  });
});

const GOLDEN = "5c0070f42b48bbb631759e31c1785a87613d8734a540b2f8c56d943f9f9a6244";

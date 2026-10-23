import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { sniffFileContentKind } from "@main/sniff-content-kind";

/*
 * The main process reads the first bytes of a `.bas` to tell a tokenised HT-1080Z program from source
 * text (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D2).
 */
const dir = mkdtempSync(join(tmpdir(), "klive-sniff-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const DEMO = readFileSync(join(__dirname, "../../scripts/doc-shots/recipes/ht1080z-demo.bas"));

describe("sniffFileContentKind", () => {
  it("names a tokenised .bas, any case, and nothing else", () => {
    writeFileSync(join(dir, "demo.bas"), DEMO);
    writeFileSync(join(dir, "UPPER.BAS"), DEMO);
    writeFileSync(join(dir, "game.bas"), '10 PRINT "HI"\n');
    writeFileSync(join(dir, "demo.bin"), DEMO);
    expect(sniffFileContentKind(join(dir, "demo.bas"))).toBe("ht1080zBasic");
    expect(sniffFileContentKind(join(dir, "UPPER.BAS"))).toBe("ht1080zBasic");
    expect(sniffFileContentKind(join(dir, "game.bas"))).toBeUndefined();
    expect(sniffFileContentKind(join(dir, "demo.bin"))).toBeUndefined();
    expect(sniffFileContentKind(join(dir, "missing.bas"))).toBeUndefined();
  });

  it("reads only the start of a long program", () => {
    // --- The demo's lines repeated, relinked: longer than the sniff, still a chain
    const lines = DEMO.subarray(1, DEMO.length - 2);
    const out: number[] = [0xff];
    let address = 0x42e9;
    for (let copy = 0; copy < 40; copy++) {
      let pos = 0;
      while (pos < lines.length) {
        const next = lines[pos] | (lines[pos + 1] << 8);
        const length = next - (0x42e9 + pos);
        const line = Array.from(lines.subarray(pos, pos + length));
        address += length;
        line[0] = address & 0xff;
        line[1] = address >> 8;
        out.push(...line);
        pos += length;
      }
    }
    out.push(0, 0);
    writeFileSync(join(dir, "long.bas"), Uint8Array.from(out));
    expect(out.length).toBeGreaterThan(512);
    expect(sniffFileContentKind(join(dir, "long.bas"))).toBe("ht1080zBasic");
  });
});

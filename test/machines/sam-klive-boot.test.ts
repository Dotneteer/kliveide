import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { SAM_KLIVE_BOOT_IMAGE } from "@common/samcoupe/samKliveBootImage";

/*
 * Klive's SAM boot loader (`dev/plans/SAM_COUPE_PLAN.md` §9.3, D7): the shipped image
 * (`src/common/samcoupe/samKliveBootImage.ts`) is exactly what Klive's assembler makes of its source, the
 * file's data from 8009h. `SAM_BOOT_WRITE=1` writes the image module.
 */

const REPO = join(__dirname, "../..");
const SOURCE = join(REPO, "src/public/sam/sam-klive-boot.asm");
const MODULE = join(REPO, "src/common/samcoupe/samKliveBootImage.ts");

async function assemble(): Promise<Uint8Array> {
  const output = await new Z80Assembler().compile(readFileSync(SOURCE, "utf8"), new AssemblerOptions());
  if (output.errorCount) {
    throw new Error(output.errors.map((e) => `${e.line}: ${e.message}`).join("\n"));
  }
  let end = 0x8009;
  for (const segment of output.segments) end = Math.max(end, segment.startAddress + segment.currentOffset);
  const image = new Uint8Array(end - 0x8009);
  for (const segment of output.segments) {
    image.set(segment.emittedCode.slice(0, segment.currentOffset), segment.startAddress - 0x8009);
  }
  return image;
}

function moduleText(image: Uint8Array): string {
  const lines: string[] = [];
  for (let i = 0; i < image.length; i += 16) {
    lines.push("  " + Array.from(image.subarray(i, i + 16), (b) => `0x${b.toString(16).padStart(2, "0")}`).join(", "));
  }
  return (
    "/*\n" +
    " * Klive's SAM Coupé boot loader, assembled from `src/public/sam/sam-klive-boot.asm` (the file's data\n" +
    " * from 8009h). Generated: `SAM_BOOT_WRITE=1` with `test/machines/sam-klive-boot.test.ts`; do not edit.\n" +
    " */\n" +
    `export const SAM_KLIVE_BOOT_IMAGE = new Uint8Array([\n${lines.join(",\n")}\n]);\n`
  );
}

describe("Klive's SAM boot loader", () => {
  it("is its source, assembled", async () => {
    const image = await assemble();
    if (process.env.SAM_BOOT_WRITE) writeFileSync(MODULE, moduleText(image));
    expect(Array.from(SAM_KLIVE_BOOT_IMAGE)).toEqual(Array.from(image));
  });

  it("fits the boot sector, with BOOT at byte 256 (file data byte 247)", () => {
    expect(SAM_KLIVE_BOOT_IMAGE.length).toBeLessThanOrEqual(501);
    expect(String.fromCharCode(...SAM_KLIVE_BOOT_IMAGE.subarray(247, 251))).toBe("BOOT");
  });
});

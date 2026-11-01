import { describe, expect, it } from "vitest";

import { imageFromRomPage } from "@common/reverse/pipeline/image/romImage";
import { listImageBank } from "@common/reverse/pipeline/listing";
import { instructionEffects } from "@common/reverse/pipeline/preprocess/effects";

/*
 * The effects model (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` P2, D2): every opcode of the Z80 and
 * of the Z80N decodes to effects the model knows, and the common forms have the right ones.
 */

const PREFIXES = [[], [0xcb], [0xed], [0xdd], [0xfd], [0xdd, 0xcb, 0x05], [0xfd, 0xcb, 0x05]];

async function firstRow(bytes: number[], cpu: "z80" | "z80n") {
  const image = imageFromRomPage(new Uint8Array([...bytes, 0x12, 0x34, 0x56, 0x78]), { name: "t", cpu });
  return (await listImageBank(image, "0", 0, 0))[0];
}

describe("instructionEffects", () => {
  it.each(["z80", "z80n"] as const)("knows every opcode of the %s", async (cpu) => {
    const unknown: string[] = [];
    for (const prefix of PREFIXES) {
      for (let op = 0; op < 256; op++) {
        const row = await firstRow([...prefix, op], cpu);
        const effects = instructionEffects(row.text, row.bytes);
        if (effects.unknown) unknown.push(row.text);
      }
    }
    expect(unknown).toEqual([]);
  });

  it("decodes the Z80N's own opcodes only for z80n, and models each of them", async () => {
    const z80nOnly: string[] = [];
    for (let op = 0; op < 256; op++) {
      const [plain, next] = [await firstRow([0xed, op], "z80"), await firstRow([0xed, op], "z80n")];
      if (plain.text !== next.text) {
        z80nOnly.push(next.text.split(" ")[0]);
        expect(instructionEffects(next.text, next.bytes).unknown).toBeUndefined();
      }
    }
    expect(new Set(z80nOnly)).toEqual(
      new Set([
        "swapnib", "mirror", "test", "bsla", "bsra", "bsrl", "bsrf", "brlc", "mul", "add", "push", "outinb",
        "nextreg", "pixeldn", "pixelad", "setae", "jp", "ldix", "ldws", "lddx", "ldirx", "ldpirx", "lddrx"
      ])
    );
  });

  it("models the common forms", () => {
    expect(instructionEffects("ld a,($BF79)", [0x3a, 0x79, 0xbf])).toEqual({ reads: [], writes: ["A"], memRead: 0xbf79 });
    expect(instructionEffects("ld ($5000),hl", [0x22, 0x00, 0x50])).toEqual({ reads: ["H", "L"], writes: [], memWrite: 0x5000 });
    expect(instructionEffects("push bc", [0xc5]).stack).toEqual({ op: "push", pair: ["B", "C"] });
    expect(instructionEffects("ex (sp),hl", [0xe3]).stack).toEqual({ op: "exchange", pair: ["H", "L"] });
    expect(instructionEffects("ex af,af'", [0x08]).swap).toBe("af");
    expect(instructionEffects("add hl,de", [0x19])).toEqual({ reads: ["H", "L", "D", "E"], writes: ["H", "L", "F"] });
    // --- The Z80N's ADD rr,A leaves the flags alone
    expect(instructionEffects("add hl,a", [0xed, 0x31])).toEqual({ reads: ["H", "L", "A"], writes: ["H", "L"] });
    expect(instructionEffects("xor a", [0xaf])).toEqual({ reads: [], writes: ["A", "F"], known: { carry: 0, zero: 1, a: 0 } });
    expect(instructionEffects("or a", [0xb7])).toEqual({ reads: ["A"], writes: ["F"], known: { carry: 0 } });
    expect(instructionEffects("scf", [0x37])).toEqual({ reads: [], writes: ["F"], known: { carry: 1 } });
    expect(instructionEffects("ret nz", [0xc0]).reads).toEqual(["F"]);
    expect(instructionEffects("in a,($FE)", [0xdb, 0xfe])).toEqual({ reads: ["A"], writes: ["A"], portIn: 0xfe });
    expect(instructionEffects("out (c),a", [0xed, 0x79])).toEqual({ reads: ["B", "C", "A"], writes: [], portOut: "bc" });
    expect(instructionEffects("nextreg $07,a", [0xed, 0x92, 0x07])).toEqual({ reads: ["A"], writes: [], nextReg: 7 });
    expect(instructionEffects("ld (ix+$05),b", [0xdd, 0x70, 0x05]).reads).toEqual(["IXH", "IXL", "B"]);
    expect(new Set(instructionEffects("rlc (ix+$02),b", [0xdd, 0xcb, 0x02, 0x00]).writes)).toEqual(new Set(["B", "F"]));
    expect(instructionEffects("ld b,b", [0x40])).toEqual({ reads: [], writes: [] });
    expect(instructionEffects(".defb $1B", [0x1b])).toEqual({ reads: [], writes: [] });
  });
});

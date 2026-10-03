import { describe, expect, it } from "vitest";

import {
  extractSldInfo,
  sldAnnotations,
  sldSymbols,
  sldoptWarning,
  sourceHasLogpointComment
} from "@main/sjasmp-integration/SjasmPCompiler";
import { integerSymbolsOf } from "@common/utils/breakpoint-condition/integer-symbols";

/*
 * sjasmplus SLD data for logpoints (`.plans/LOGPOINTS_PLAN.md` §4.7, Phase 4): `K` lines become
 * `LOGPOINT` annotations, `L` lines become the build's symbols (Q7), a comment holding `|` survives,
 * and a source with LOGPOINT comments but no `K` lines gets the `SLDOPT` warning (Q6). The fixture
 * follows the format of sjasmplus's documentation (SLD version 1).
 */

const SLD = [
  "|SLD.data.version|1",
  "|| a comment line",
  "main.asm|1||0|-1|-1|Z|pages.size:16384,pages.count:8,slots.count:4,slots.adr:0,16384,32768,49152",
  "main.asm|4||0|2|32768|L|,DrawSprite,,+used",
  "main.asm|5||0|2|32768|T|",
  "main.asm|5||0|2|32768|K|; LOGPOINT [SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}",
  "main.asm|6||0|2|32769|T|",
  "main.asm|6||0|2|32769|K|; LOGPOINT or=${A | B}",
  "main.asm|7||0|2|32770|L|sprite,counter,,+used",
  "main.asm|8||0|2|32771|L|,DrawSprite,loop",
  "main.asm|9||0|-1|254|L|,PORT,,+equ",
  "main.asm|10||0|-1|0|L|,MyMacro,,+macro",
  "main.asm|11||0|2|32772|K|; WPMEM",
  "inc.asm|3:5:9||0|2|32773|K|; LOGPOINT from include"
].join("\n");

describe("SLD logpoints", () => {
  const lines = extractSldInfo(SLD);

  it("keeps a K line's comment whole, | included", () => {
    const or = lines.find((l) => l.type === "K" && l.line === 6)!;
    expect(or.data).toBe("; LOGPOINT or=${A | B}");
  });

  it("turns K lines with LOGPOINT into annotations at the T lines' addresses", () => {
    const files: string[] = [];
    const annotations = sldAnnotations(lines, (f) => {
      if (!files.includes(f)) files.push(f);
      return files.indexOf(f);
    });
    expect(annotations).toEqual([
      {
        kind: "LOGPOINT",
        fileIndex: 0,
        line: 5,
        address: 0x8000,
        text: "[SPRITES] Status=${A:hex8}, Counter=${b@(sprite.counter)}"
      },
      { kind: "LOGPOINT", fileIndex: 0, line: 6, address: 0x8001, text: "or=${A | B}" },
      { kind: "LOGPOINT", fileIndex: 1, line: 3, address: 0x8005, text: "from include" }
    ]);
  });

  it("produces symbols from L lines with their full dotted names", () => {
    const symbols = integerSymbolsOf(sldSymbols(lines));
    expect(symbols).toEqual({
      drawsprite: 0x8000,
      "sprite.counter": 0x8002,
      "drawsprite.loop": 0x8003,
      port: 254
    });
  });

  it("finds LOGPOINT in a source comment for the SLDOPT warning", () => {
    expect(sourceHasLogpointComment("  ld a,1 ; LOGPOINT x\n")).toBe(true);
    expect(sourceHasLogpointComment("  ld a,1 // LOGPOINT x")).toBe(true);
    expect(sourceHasLogpointComment("LOGPOINT: nop ; no keyword\n")).toBe(false);
    expect(sourceHasLogpointComment("  ld a,1 ; logpoint x")).toBe(false);
    const warning = sldoptWarning("main.asm");
    expect(warning.isWarning).toBe(true);
    expect(warning.message).toMatch(/SLDOPT COMMENT LOGPOINT/);
  });
});

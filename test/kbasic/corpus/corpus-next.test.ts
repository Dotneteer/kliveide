import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { describe, expect, it } from "vitest";

import { runBasicNext } from "../codegen/next-kit";

import { programs, readExpectations, reportChar } from "./expectations";

/**
 * The corpus on the ZX Spectrum Next (plan R10, Phase 6): every program built for the `next` target
 * runs on the Next harness and meets the same screen, memory and error expectations as on the 48K.
 * The runtime is the same; what differs is the Next's own ROM paging, the NEX layout and the
 * machine. Programs that hold keys run only on the 48K (the Next's keyboard is scanned differently
 * from the harness's held keys). Programs whose header says `'@target next` (CODEBANK, `codebank/`)
 * run only here; after a CODEBANK program the far-call runtime must be back where it started.
 */
const ROOT = __dirname;

describe("Klive BASIC corpus on the ZX Spectrum Next", () => {
  for (const file of programs(ROOT)) {
    const name = relative(ROOT, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    const expectations = readExpectations(source);
    if (expectations.some((e) => e.kind === "keys")) continue;
    for (const level of [0, 1, 2, 3])
      it(`${name} (optimize ${level})`, async () => {
        const error = expectations.find((e) => e.kind === "error");
        const frames = expectations.find((e) => e.kind === "frames");
        const r = await runBasicNext(source, {
          optimize: level,
          ...(error ? { expectEnd: false } : {}),
          ...(frames ? { frames: frames.count } : error ? { frames: 100 } : {})
        });
        expect(r.generated.debug.problems, "the debug-info validator").toEqual([]);
        // --- CODEBANK: control is back in resident code, so the far-call runtime is back where it started
        const codebank = r.generated.debug.sourceLevel.extensions?.codebank;
        if (codebank && !error) {
          expect(r.session.peek(codebank.currentBank), "the current bank").toBe(0);
          expect(r.session.peekWord(codebank.shadowStackPointer), "the shadow stack").toBe(
            codebank.shadowStack
          );
          expect(r.session.mmuPage(codebank.window >> 13), "the window's page").toBe(
            r.session.peek(r.program.symbol("core.FarPages"))
          );
        }
        for (const e of expectations) {
          switch (e.kind) {
            case "screen":
              expect(r.session.screenLine(e.row), `screen row ${e.row}`).toBe(e.text);
              break;
            case "byte":
              expect(r.byte(e.name), e.name).toBe(e.value);
              break;
            case "word":
              expect(r.word(e.name), e.name).toBe(e.value);
              break;
            case "peek":
              expect(r.session.peek(e.address), `PEEK ${e.address}`).toBe(e.value);
              break;
            case "peekw":
              expect(r.session.peekWord(e.address), `PEEK UInteger ${e.address}`).toBe(e.value);
              break;
            case "error":
              expect(r.session.screenLine(23), "the error report").toMatch(
                new RegExp(`^${reportChar(e.code)} `)
              );
              break;
          }
        }
      });
  }
});

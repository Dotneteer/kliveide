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
 * from the harness's held keys).
 */
const ROOT = __dirname;

describe("Klive BASIC corpus on the ZX Spectrum Next", () => {
  for (const file of programs(ROOT)) {
    const name = relative(ROOT, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    const expectations = readExpectations(source);
    if (expectations.some((e) => e.kind === "keys")) continue;
    it(name, async () => {
      const error = expectations.find((e) => e.kind === "error");
      const frames = expectations.find((e) => e.kind === "frames");
      const r = await runBasicNext(source, {
        ...(error ? { expectEnd: false } : {}),
        ...(frames ? { frames: frames.count } : error ? { frames: 100 } : {})
      });
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
            expect(r.session.screenLine(23), "the error report").toMatch(new RegExp(`^${reportChar(e.code)} `));
            break;
        }
      }
    });
  }
});

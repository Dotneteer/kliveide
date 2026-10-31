import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { TapeFileSystem } from "@common/diskfs/tapefs";
import { convertFile } from "@common/fileManager/fmTransfer";
import { createSp48Session } from "../harness/sp48";

/*
 * A tape the File Manager writes loads on a real ZX Spectrum 48K (.plans/FILE_MANAGER_PLAN.md,
 * Phase 6): a `.bas` and a `.bin` copied onto an empty `.tap` through the copy's own conversion
 * rules, then `LOAD ""` with the real ROM. The program loads its CODE and pokes what it read.
 */

describe("a tape written by the File Manager", () => {
  it("loads on the 48K: the BASIC auto-runs and LOADs its CODE", async () => {
    const tape = new TapeFileSystem(new Uint8Array(0), "tap");
    const program = new TextEncoder().encode('10 LOAD "" CODE\n20 POKE 40000,PEEK 32768\n');
    const code = Uint8Array.from([123, 1, 2, 3]);
    for (const out of [
      ...convertFile({ name: "loader.bas", data: program }, "host", "tape", { mode: "auto", autoRun: 10 }),
      ...convertFile({ name: "data.bin", data: code }, "host", "tape", { mode: "auto", codeStart: 32768 })
    ]) {
      tape.write({ name: out.name, kind: out.kind, data: out.data, start: out.start, variablesOffset: out.variablesOffset });
    }
    expect(tape.list().map((e) => [e.name, e.kind, e.start])).toEqual([["loader", "basic", 10], ["data", "code", 32768]]);

    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "klive-fmtape-")), "fm.tap");
    fs.writeFileSync(file, tape.image());
    const s = await createSp48Session();
    s.loadTap(file);
    s.runFrames(400);
    expect(s.peek(40000)).toBe(123);
  });
});

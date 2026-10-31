import { describe, expect, it } from "vitest";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import {
  EpTapeRecorder,
  buildEpteFile,
  epFileChunks,
  parseEpTapeFile,
  type EpSavedFile
} from "@emu/machines/enterprise/EpTapeFile";

/*
 * The Enterprise's cassette (`.plans/ENTERPRISE_PLAN.md` §9.3, `ep-tape.c`, `EpTapeFile.ts`) on the real
 * EXOS 2.1 and IS-BASIC: a SAVE recorded from the left D/A and published as an ep128emu `.tap`, LOADed
 * back in a fresh machine at fast and at real speed, a data file of several chunks written and read
 * back through an EPTE tape Klive's writer built, the motor stopping between chunks, a CRC error, the
 * header's protection byte, and Load and Run.
 */

const PROGRAM = '10 PRINT "HI THERE"\n';

/** The last non-empty screen row */
function lastLine(s: EpTestSession): string {
  return (
    s
      .screenText()
      .split("\n")
      .map((row) => row.trim())
      .filter((row) => row !== "")
      .pop() ?? ""
  );
}

/** Runs until IS-BASIC is back at its prompt with the motor off; returns the frames shown */
function runToPrompt(s: EpTestSession, maxFrames = 3000): number {
  let frames = 0;
  // --- The command must be taken first: its own line is the last one while it is typed
  s.runUntil(() => s.machine.getKeyQueueLength() === 0, { maxFrames: 1000 }, "typing");
  s.runUntil(
    () => {
      frames++;
      return !s.motorOn && lastLine(s) === "ok";
    },
    { maxFrames },
    "IS-BASIC's prompt"
  );
  return frames;
}

/** Counts the motor's starts while running until the prompt */
function runCountingMotorStarts(s: EpTestSession, maxFrames = 3000): { starts: number; motorFrames: number } {
  let starts = 0;
  let motorFrames = 0;
  let last = false;
  s.runUntil(() => s.machine.getKeyQueueLength() === 0, { maxFrames: 1000 }, "typing");
  s.runUntil(
    () => {
      if (s.motorOn) motorFrames++;
      if (s.motorOn && !last) starts++;
      last = s.motorOn;
      return starts > 0 && !s.motorOn && lastLine(s) === "ok";
    },
    { maxFrames },
    "the load"
  );
  return { starts, motorFrames };
}

/** Types a program, SAVEs it to tape, and returns what the machine published */
async function saveProgram(program: string, before = ""): Promise<{ name: string; contents: Uint8Array }> {
  const s = await createEpSession();
  s.bootToBasic();
  s.typeKeys(program + before);
  s.machine.typeText('SAVE "TAPE:HELLO"\n');
  let saved: { name: string; contents: Uint8Array } | undefined;
  s.runUntil(() => (saved = s.takeSavedTape()) !== undefined, { maxFrames: 2000 }, "the saved tape");
  return saved!;
}

/** Records what a running program writes to tape, decoded by the host's recorder */
function recordFiles(s: EpTestSession, maxFrames = 4000): EpSavedFile[] {
  const recorder = new EpTapeRecorder();
  recorder.sync(s.wasm.epTapeGetSavedLength());
  let files: EpSavedFile[] = [];
  s.runUntil(
    () => (files = recorder.feed(s.machine.wasmV2Runtime!.savedData, s.wasm.epTapeGetSavedLength())).length > 0,
    { maxFrames },
    "a whole file on tape"
  );
  return files;
}

const READ_PROGRAM = '10 OPEN #1:"TAPE:BIG"\n20 FOR I=1 TO 600\n30 INPUT #1:A$\n40 NEXT\n50 PRINT "READ ";I;A$\n60 CLOSE #1\n';

describe("Enterprise tape", () => {
  it("SAVE publishes an ep128emu tape that LOAD reads back, fast and at real speed", async () => {
    const saved = await saveProgram(PROGRAM);
    expect(saved.name).toBe("HELLO.tap");
    const tape = parseEpTapeFile(saved.contents);
    expect(tape.format).toBe("ep128emu");
    // --- An IS-BASIC program module (type 4)
    expect(tape.moduleType).toBe(4);

    const shown: number[] = [];
    for (const fastLoad of [true, false]) {
      const s = await createEpSession();
      s.insertTape(tape, { fastLoad });
      s.bootToBasic();
      s.machine.typeText("LOAD\n");
      const { starts, motorFrames } = runCountingMotorStarts(s);
      // --- The header chunk and one data chunk, the motor stopped between them
      expect(starts).toBe(2);
      shown.push(motorFrames);
      s.typeKeys("RUN\n", { settle: 20 });
      expect(s.screenText()).toMatch(/^HI THERE$/m);
    }
    // --- Fast load shows a fraction of the frames
    expect(shown[0] * 5).toBeLessThan(shown[1]);
  });

  it("RUN \"TAPE:\" loads and runs a program", async () => {
    const tape = parseEpTapeFile((await saveProgram(PROGRAM)).contents);
    const s = await createEpSession();
    s.insertTape(tape);
    s.bootToBasic();
    s.machine.typeText('RUN "TAPE:"\n');
    runToPrompt(s);
    expect(s.screenText()).toMatch(/^HI THERE$/m);
  });

  it("writes the header's protection byte from EXOS's PROTECT variable", async () => {
    const recordProtect = async (before: string) => {
      const s = await createEpSession();
      s.bootToBasic();
      s.typeKeys(PROGRAM + before);
      s.machine.typeText('SAVE "TAPE:P"\n');
      return recordFiles(s)[0];
    };
    // --- PROTECT is FFh (off) unless set: FFh on tape; TOGGLE turns it on (00h)
    expect((await recordProtect("")).protect).toBe(0xff);
    const file = await recordProtect("TOGGLE 34\n");
    expect(file.protect).toBe(0x00);
    // --- A protected file still loads and runs
    const s = await createEpSession();
    s.insertTape(parseEpTapeFile(file.tap));
    s.bootToBasic();
    s.machine.typeText("LOAD\n");
    runToPrompt(s);
    s.typeKeys("RUN\n", { settle: 20 });
    expect(s.screenText()).toMatch(/^HI THERE$/m);
  });

  it("writes a data file of several chunks and reads it back from an EPTE tape, the motor stopping between chunks", async () => {
    const s = await createEpSession();
    s.bootToBasic();
    s.typeKeys('10 OPEN #1:"TAPE:BIG" ACCESS OUTPUT\n20 FOR I=1 TO 600\n30 PRINT #1:"0123456789"\n40 NEXT\n50 CLOSE #1\n');
    s.machine.typeText("RUN\n");
    const [file] = recordFiles(s);
    expect(file.name).toBe("BIG");
    // --- 600 lines of 10 characters and CR LF: a 4 KB chunk and a shorter one after the header
    expect(file.chunks.map((c) => (c.header ? "H" : c.blocks.reduce((n, b) => n + b.length, 0)))).toEqual(["H", 4096, 3104]);
    expect(file.chunks.every((c) => c.crcOk)).toBe(true);
    expect(new TextDecoder().decode(file.payload)).toBe("0123456789\r\n".repeat(600));

    const t = await createEpSession();
    t.insertTape(parseEpTapeFile(buildEpteFile(epFileChunks("BIG", file.payload))));
    t.bootToBasic();
    t.typeKeys(READ_PROGRAM);
    t.machine.typeText("RUN\n");
    const { starts } = runCountingMotorStarts(t);
    expect(starts).toBe(3);
    expect(t.screenText()).toMatch(/^READ\s+601 0123456789$/m);
  });

  it("reports a CRC error", async () => {
    const epte = buildEpteFile(epFileChunks("BIG", new TextEncoder().encode("0123456789\r\n".repeat(600))));
    // --- A byte of the first data chunk's first block (after the 9-byte header chunk, its count and length)
    epte[512 + 9 + 60] ^= 0x10;
    const s = await createEpSession();
    s.insertTape(parseEpTapeFile(epte));
    s.bootToBasic();
    s.typeKeys(READ_PROGRAM);
    s.machine.typeText("RUN\n");
    s.runUntil(() => s.screenText().includes("Cassette CRC error"), { maxFrames: 2000 }, "the CRC error");
  });

  it("Load and Run boots to IS-BASIC and runs the program", async () => {
    const tape = parseEpTapeFile((await saveProgram(PROGRAM)).contents);
    const s = await createEpSession();
    s.insertTape(tape);
    s.machine.hardReset();
    playInjectionFlow(s.machine as unknown as FrameMachine, s.machine.getTapeLoadFlow());
    expect(s.machine.pendingLoadCommands).toEqual(["banner", 'RUN "TAPE:"\n']);
    s.runUntil(() => /^HI THERE$/m.test(s.screenText()), { maxFrames: 3000 }, "the program running");
    expect(s.machine.pendingLoadCommands).toEqual([]);
  });

  it("Load and Run refuses an empty deck", async () => {
    const s = await createEpSession();
    expect(() => s.machine.getTapeLoadFlow()).toThrow(/no Enterprise tape/);
  });
});

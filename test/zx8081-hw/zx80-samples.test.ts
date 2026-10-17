import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ZX8081_KEY } from "@emu/machines/zx8081/Zx8081KeyCode";
import { parseZxProgramFile } from "@emu/machines/zx8081/ZxPFile";
import { analyzeOFile } from "@renderer/appIde/DocumentPanels/PFile/oFileView";
import { createZx81Session, REPO_ROOT, type Zx81TestSession } from "../harness/zx81";

/*
 * The ZX80 sample programs in `_input/zx80-tapes/klive/` (its README lists them): made on Klive's own
 * ZX80 - the WASM core with the real 4K ROM - by typing each program and writing out memory from
 * $4000 up to E_LINE, the bytes a ZX80 SAVE writes. No third-party program is in them.
 *
 * `ZX80_SAMPLES_WRITE=1 npm test -- test/zx8081-hw/zx80-samples.test.ts` makes them again; every run
 * checks that the files there still load on the ROM and read in the `.O` viewer's model.
 */

const SAMPLES = join(REPO_ROOT, "_input/zx80-tapes/klive");
const E_LINE = 0x400a;
const VARS = 0x4008;

type Sample = {
  file: string;
  model: "zx80-1k" | "zx80-16k";
  /**
   * The program's lines as key chords: a key name per key (`O`, `1`, `SP` space, `NL` NEW LINE),
   * `S+` for SHIFT. K mode turns the line's first letter into its keyword (O PRINT, K LET, F FOR...).
   */
  lines: string[];
  /** RUN it before writing the file, so its variables are in it */
  run?: boolean;
  /** What the viewer's model must read */
  lineCount: number;
  variables?: string[];
};

const SAMPLES_TO_MAKE: Sample[] = [
  {
    // --- 10 PRINT "HELLO FROM KLIVE" / 20 GO TO 10
    file: "hello.o",
    model: "zx80-1k",
    lines: ["1 0 O S+Y H E L L O SP F R O M SP K L I V E S+Y NL", "2 0 G 1 0 NL"],
    lineCount: 2
  },
  {
    // --- 10 FOR I=1 TO 10 / 20 PRINT I,I*I / 30 NEXT I, run
    file: "squares.o",
    model: "zx80-16k",
    lines: ["1 0 F I S+L 1 S+4 1 0 NL", "2 0 O I S+Period I S+P I NL", "3 0 N I NL"],
    run: true,
    lineCount: 3,
    variables: ["I"]
  },
  {
    // --- A number-guessing game: RANDOMISE, RND, INPUT, IF ... THEN
    file: "guess.o",
    model: "zx80-16k",
    lines: [
      "1 0 J NL",
      "2 0 K N S+L R N D S+I 1 0 0 S+O NL",
      "3 0 O S+Y G U E S S SP 1 S+J 1 0 0 S+Y NL",
      "4 0 I G NL",
      "5 0 U G S+L N S+3 G 9 0 NL",
      "6 0 U G S+N N S+3 O S+Y H I G H E R S+Y NL",
      "7 0 U G S+M N S+3 O S+Y L O W E R S+Y NL",
      "8 0 G 4 0 NL",
      "9 0 O S+Y R I G H T S+Y NL"
    ],
    lineCount: 9
  },
  {
    // --- One variable of each kind, run: SCORE, L, W$, T(), and the FOR loop's K
    file: "vars.o",
    model: "zx80-16k",
    lines: [
      "1 0 K S C O R E S+L 1 0 0 0 NL",
      "2 0 K L S+L S+J 5 NL",
      "3 0 K W S+U S+L S+Y K L I V E S+Y NL",
      "4 0 D T S+I 9 S+O NL",
      "5 0 K T S+I 2 S+O S+L 7 7 NL",
      "6 0 F K S+L 1 S+4 5 NL",
      "7 0 N K NL"
    ],
    run: true,
    lineCount: 7,
    variables: ["SCORE", "L", "W$", "T()", "K"]
  }
];

/** Key chords from the compact form */
function chords(spec: string): number[][] {
  const name = (k: string) => ({ NL: "NewLine", SP: "Space" })[k] ?? (/^\d$/.test(k) ? `N${k}` : k);
  return spec
    .trim()
    .split(/\s+/)
    .map((k) => {
      const shifted = k.startsWith("S+");
      const code = ZX8081_KEY[name(shifted ? k.slice(2) : k)];
      if (code === undefined) throw new Error(`No key '${k}'`);
      return shifted ? [ZX8081_KEY.Shift, code] : [code];
    });
}

/** Types a line and waits until the ROM has entered it and shows the K cursor again */
function typeLine(s: Zx81TestSession, spec: string): void {
  s.typeChords(...chords(spec));
  s.runUntil(() => s.screenText()[23] === "[K]", { maxFrames: 300 }, spec);
}

/** What a ZX80 SAVE writes: memory from $4000 up to E_LINE */
function memoryFile(s: Zx81TestSession): Uint8Array {
  const bytes: number[] = [];
  for (let a = 0x4000; a < s.peekWord(E_LINE); a++) bytes.push(s.peek(a));
  return new Uint8Array(bytes);
}

async function makeSample(sample: Sample): Promise<Uint8Array> {
  const s = await createZx81Session({ machineId: "zx80", model: sample.model });
  s.bootToBasic();
  for (const line of sample.lines) typeLine(s, line);
  if (sample.run) {
    s.typeChords(...chords("R NL"));
    // --- The program runs and the ROM shows its report
    s.runFrames(150);
  }
  return memoryFile(s);
}

describe("ZX80 sample programs", () => {
  it.skipIf(!process.env.ZX80_SAMPLES_WRITE)(
    "makes them on the 4K ROM",
    async () => {
      mkdirSync(SAMPLES, { recursive: true });
      for (const sample of SAMPLES_TO_MAKE) {
        writeFileSync(join(SAMPLES, sample.file), await makeSample(sample));
      }
    },
    120_000
  );

  for (const sample of SAMPLES_TO_MAKE) {
    it(`${sample.file} loads on the ROM and reads in the viewer`, async () => {
      const path = join(SAMPLES, sample.file);
      expect(existsSync(path), path).toBe(true);
      const bytes = new Uint8Array(readFileSync(path));

      // --- The viewer's model: the listing and the variables
      const { analysis } = analyzeOFile(bytes);
      expect(analysis?.summary.layoutValid).toBe(true);
      expect(analysis!.summary.lineCount).toBe(sample.lineCount);
      expect(analysis!.summary.ramKb).toBe(sample.model === "zx80-1k" ? 1 : analysis!.summary.ramKb);
      if (sample.variables) expect(analysis!.variables.map((v) => v.name)).toEqual(sample.variables);

      // --- The ROM's LOAD takes it: the program is in memory afterwards
      const file = parseZxProgramFile(bytes, sample.file);
      expect(file?.isZx81).toBe(false);
      const s = await createZx81Session({ machineId: "zx80", model: sample.model });
      s.bootToBasic();
      s.loadProgram(file!, { autoRun: false, maxFrames: 1000 });
      const vars = bytes[VARS - 0x4000] | (bytes[VARS - 0x4000 + 1] << 8);
      const program = [...bytes.subarray(0x28, vars - 0x4000)];
      expect(program.map((_, i) => s.peek(0x4028 + i))).toEqual(program);
    }, 60_000);
  }
});

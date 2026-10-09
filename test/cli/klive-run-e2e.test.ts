import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { CliIo } from "../../src/cli/io";
import { runCli } from "../../src/cli/run-cli";
import { ZX81_CHARSET } from "@emu/machines/zx8081/ZxPFile";
import { compileNexFile } from "../harness/zxnext/core/compile-nex";
import { buildSp48Wasm } from "../../scripts/build-sp48-wasm.cjs";
import { buildSp128Wasm } from "../../scripts/build-sp128-wasm.cjs";
import { buildZx8081Wasm } from "../../scripts/build-zx8081-wasm.cjs";
import { buildZxNextWasmArtifact } from "../wasm/zxNext/wasm-next-test-helpers";

/*
 * `klive run` end to end (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` Phase 1, §6, D15, T10): the real
 * command line, in this process, on the real cores - a 48K, a 128K, a ZX81 and a Next - with every
 * stop condition, --keys, every output, the inputs (a project, a tape, a snapshot, a Klive state, a
 * NEX file, a ZX81 program), the exit codes 0/2/3/4/5 and two runs compared byte for byte.
 */

const FIXTURES = path.join(__dirname, "fixtures");
const REPO = path.join(__dirname, "../..");
let out: string;

type Run = { code: number; out: string[]; err: string[] };

async function klive(argv: string[], env: NodeJS.ProcessEnv = {}): Promise<Run> {
  const lines: string[] = [];
  const errors: string[] = [];
  const io: CliIo = {
    out: (t) => lines.push(t),
    err: (t) => errors.push(t),
    outBytes: () => {},
    writeFile: (file, data) => {
      const full = path.resolve(FIXTURES, file);
      fs.writeFileSync(full, data);
      return full;
    },
    env: { PATH: "", ...env },
    cwd: FIXTURES,
    isTty: false,
    waitForInterrupt: () => new Promise(() => {})
  };
  const code = await runCli(argv, io);
  return { code, out: lines, err: errors };
}

/** Runs with --json and returns the result */
async function kliveJson(argv: string[]): Promise<{ code: number; result: any; err: string[] }> {
  const run = await klive([...argv, "--json"]);
  return { code: run.code, result: run.out.length ? JSON.parse(run.out[run.out.length - 1]) : undefined, err: run.err };
}

const file = (name: string) => path.join(out, name);
const bytesOf = (name: string) => new Uint8Array(fs.readFileSync(file(name)));

/** A tape holding a BASIC program `10 POKE 32768,42` that runs itself from line 10 */
function basicPokeTape(): Uint8Array {
  const smallInt = (n: number) => [0x0e, 0x00, 0x00, n & 0xff, n >> 8, 0x00];
  const ascii = (t: string) => Array.from(t, (c) => c.charCodeAt(0));
  const text = [0xf4, ...ascii("32768"), ...smallInt(32768), ...ascii(","), ...ascii("42"), ...smallInt(42), 0x0d];
  const program = [0x00, 10, text.length & 0xff, text.length >> 8, ...text];
  const block = (flag: number, data: number[]) => {
    const body = [flag, ...data];
    const sum = body.reduce((a, b) => a ^ b, 0);
    const all = [...body, sum];
    return [all.length & 0xff, all.length >> 8, ...all];
  };
  const word = (n: number) => [n & 0xff, n >> 8];
  const header = [0x00, ...ascii("poke      "), ...word(program.length), ...word(10), ...word(program.length)];
  return new Uint8Array([...block(0x00, header), ...block(0xff, program)]);
}

/** The character in a 48K screen cell, recognised by the ROM's character set */
function spectrumChar(screen: Uint8Array, charset: Uint8Array, row: number, col: number): string | undefined {
  const cell = Array.from({ length: 8 }, (_, line) => screen[((row & 0x18) << 8) | (line << 8) | ((row & 0x07) << 5) | col]);
  for (let code = 32; code < 128; code++) {
    if (cell.every((b, line) => b === charset[(code - 32) * 8 + line])) return String.fromCharCode(code);
  }
  return undefined;
}

/** The ZX81's display file as text, from its RAM ($4000-) */
function zx81Screen(ram: Uint8Array): string[] {
  const peek = (a: number) => ram[a - 0x4000];
  let a = (peek(0x400c) | (peek(0x400d) << 8)) + 1;
  const lines: string[] = [];
  let line = "";
  while (lines.length < 24 && a < 0x8000) {
    const c = peek(a++);
    if (c === 0x76) {
      lines.push(line.trimEnd());
      line = "";
      continue;
    }
    const ch = (c & 0x7f) < 0x40 ? ZX81_CHARSET[c & 0x3f] : `{${c.toString(16)}}`;
    line += c & 0x80 && (c & 0x7f) < 0x40 ? `[${ch}]` : ch;
  }
  return lines;
}

beforeAll(async () => {
  buildSp48Wasm();
  buildSp128Wasm();
  buildZx8081Wasm();
  await buildZxNextWasmArtifact();
  out = fs.mkdtempSync(path.join(os.tmpdir(), "klive-run-"));
}, 300_000);

afterAll(() => {
  if (out) fs.rmSync(out, { recursive: true, force: true });
});

describe("klive run: stop conditions on the 48K", () => {
  it("runs to an address (a label of the build) and dumps memory and registers", async () => {
    const run = await klive(["run", "run48", "--until-pc", "Done", "--dump-mem", `Counter:1=${file("counter.bin")}`, "--dump-regs", file("regs.json")]);
    expect(run.code).toBe(0);
    expect(run.out[0]).toMatch(/^run48 \(code\/main\.kz80\.asm\): stopped at \$[0-9A-F]{4} \(address reached\) after \d+ frames?, [\d,]+ T-states$/);
    expect(bytesOf("counter.bin")).toEqual(new Uint8Array([10]));
    const regs = JSON.parse(fs.readFileSync(file("regs.json"), "utf8"));
    expect(regs.bc >> 8).toBe(0);
    expect(regs.halted).toBe(false);
  }, 60_000);

  it("stops at a conditional breakpoint", async () => {
    const { code, result } = await kliveJson(["run", "run48", "--bp", "Step -if B == 3", "--dump-mem", `Counter:1=${file("bp.bin")}`]);
    expect(code).toBe(0);
    expect(result.stop).toBe("breakpoint");
    expect(result.registers.bc >> 8).toBe(3);
    expect(bytesOf("bp.bin")).toEqual(new Uint8Array([8]));
  }, 60_000);

  it("stops at a dead HALT, after frames and at an exact T-state count", async () => {
    const halt = await kliveJson(["run", "run48", "--until-halt"]);
    expect(halt.code).toBe(0);
    expect(halt.result.stop).toBe("halt");
    expect(halt.result.registers.halted).toBe(true);
    expect(halt.result.registers.iff1).toBe(false);
    // --- Seen at the HALT, not when the default budget runs out
    expect(halt.result.frames).toBeLessThan(5);

    const frames = await kliveJson(["run", "run48", "--frames", "5"]);
    expect(frames.result.stop).toBe("frames");
    expect(frames.result.frames).toBe(5);

    const tstates = await kliveJson(["run", "run48", "--tstates", "50000"]);
    expect(tstates.result.stop).toBe("tstates");
    expect(tstates.result.tstates).toBeGreaterThanOrEqual(50000);
    // --- The first instruction boundary at or after the target: no Z80 instruction takes 24 T-states
    expect(tstates.result.tstates).toBeLessThan(50000 + 24);
  }, 60_000);

  it("exits 5 when --timeout runs out first", async () => {
    const run = await klive(["run", "run48", "--until-pc", "$0000", "--timeout", "0.1"]);
    expect(run.code).toBe(5);
    expect(run.out[0]).toMatch(/\(timed out\)/);
  }, 60_000);

  it("writes the picture as a PNG", async () => {
    const run = await klive(["run", "run48", "--until-halt", "--screenshot", file("shot.png")]);
    expect(run.code).toBe(0);
    const png = bytesOf("shot.png");
    expect(Array.from(png.subarray(1, 4), (c) => String.fromCharCode(c)).join("")).toBe("PNG");
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([352, 288]);
  }, 60_000);

  it("writes the picture the packaged smoke test expects", async () => {
    // --- release-artifacts.yml runs the same command with the packaged launcher and compares the
    // --- file with this golden; KLIVE_RUN_GOLDEN=1 rewrites it after a deliberate picture change
    const golden = path.join(FIXTURES, "run48/expected-frame10.png");
    const run = await klive(["run", "run48", "--frames", "10", "--screenshot", file("halt.png")]);
    expect(run.code).toBe(0);
    if (process.env.KLIVE_RUN_GOLDEN) fs.copyFileSync(file("halt.png"), golden);
    expect(Buffer.compare(Buffer.from(bytesOf("halt.png")), fs.readFileSync(golden))).toBe(0);
  }, 60_000);

  it("gives byte-identical outputs for identical runs (T10)", async () => {
    const outputs = async (tag: string) => {
      const names = [`mem-${tag}.bin`, `regs-${tag}.json`, `shot-${tag}.png`, `state-${tag}.kls`, `snap-${tag}.szx`];
      const run = await klive([
        "run", "run48", "--bp", "Step -hit 6",
        "--dump-mem", `$4000:$1B00=${file(names[0])}`,
        "--dump-regs", file(names[1]),
        "--screenshot", file(names[2]),
        "--save-state", file(names[3]),
        "--no-timestamp"
      ]);
      expect(run.code).toBe(0);
      const snap = await klive(["run", "run48", "--bp", "Step -hit 6", "--save-state", file(names[4])]);
      expect(snap.code).toBe(0);
      return names.map((n) => bytesOf(n));
    };
    const first = await outputs("a");
    const second = await outputs("b");
    first.forEach((bytes, i) => expect(Buffer.compare(Buffer.from(bytes), Buffer.from(second[i])), `output ${i}`).toBe(0));
  }, 120_000);
});

describe("klive run: inputs", () => {
  it("continues a Klive state and a .szx snapshot it saved", async () => {
    expect((await klive(["run", "run48", "--bp", "Step -hit 4", "--save-state", file("mid.kls"), "--no-timestamp"])).code).toBe(0);
    expect((await klive(["run", "run48", "--bp", "Step -hit 4", "--save-state", file("mid.szx")])).code).toBe(0);
    for (const name of ["mid.kls", "mid.szx"]) {
      const { code, result } = await kliveJson(["run", file(name), "--until-halt", "--dump-mem", `$8000:$40=${file(`${name}.bin`)}`]);
      expect(code, name).toBe(0);
      expect(result.machine).toBe("sp48");
      expect(result.stop).toBe("halt");
    }
    // --- Counter is the last byte of the program: ten loops, whichever file the run continued from
    const image = bytesOf("mid.kls.bin");
    expect(image).toEqual(bytesOf("mid.szx.bin"));
  }, 120_000);

  it("types at the keyboard after a program returns to BASIC", async () => {
    const run = await klive([
      "run", "returns48", "--wait-frames", "50", "--keys", "p1+1\\n", "--frames", "50",
      "--dump-mem", `$4000:$1800=${file("screen.bin")}`, "--dump-mem", `$3D00:768=${file("charset.bin")}`
    ]);
    expect(run.err.filter((l) => !l.startsWith("Wrote "))).toEqual([]);
    expect(run.code).toBe(0);
    // --- PRINT 1+1 printed 2 at the top left
    expect(spectrumChar(bytesOf("screen.bin"), bytesOf("charset.bin"), 0, 0)).toBe("2");
  }, 60_000);

  it("loads a tape with LOAD \"\" and runs the program on it", async () => {
    fs.writeFileSync(file("poke.tap"), basicPokeTape());
    const run = await klive(["run", file("poke.tap"), "--frames", "200", "--dump-mem", `$8000:1=${file("poke.bin")}`]);
    expect(run.code).toBe(0);
    expect(run.out[0]).toMatch(/^poke\.tap \(tape\): stopped/);
    expect(bytesOf("poke.bin")).toEqual(new Uint8Array([42]));
  }, 60_000);

  it("runs a 128K project through the 128K's menu", async () => {
    const { code, result } = await kliveJson(["run", "run128", "--until-halt", "--dump-mem", `Marker:1=${file("m128.bin")}`]);
    expect(code).toBe(0);
    expect(result.machine).toBe("sp128");
    expect(result.stop).toBe("halt");
    expect(bytesOf("m128.bin")).toEqual(new Uint8Array([0x5a]));
  }, 120_000);

  it("loads a ZX81 program file and lets it RUN", async () => {
    const program = path.join(REPO, "_input/zx81-tapes/basic/Characters.P");
    const run = await klive(["run", program, "--frames", "300", "--dump-mem", `$4000:$4000=${file("zx81.bin")}`]);
    expect(run.code).toBe(0);
    expect(run.out[0]).toMatch(/^Characters\.P \(ZX81 program\): stopped/);
    // --- The program prints the character set, each followed by its inverse
    expect(zx81Screen(bytesOf("zx81.bin"))[0].startsWith(" [ ]")).toBe(true);
  }, 120_000);

  it("runs a Next project and the same program as a .nex file", async () => {
    const project = await kliveJson(["run", "runnext", "--until-halt", "--dump-regs", file("next.json")]);
    expect(project.code).toBe(0);
    expect(project.result.machine).toBe("zxnext");
    expect(project.result.registers.af >> 8).toBe(4);
    expect(project.err.some((l) => l.startsWith("Note: The ZX Spectrum Next build was injected"))).toBe(true);

    const source = path.join(out, "next-src");
    fs.mkdirSync(source, { recursive: true });
    fs.copyFileSync(path.join(FIXTURES, "runnext/code/main.kz80.asm"), path.join(source, "main.kz80.asm"));
    const nex = await compileNexFile(path.join(source, "main.kz80.asm"));
    fs.writeFileSync(file("runnext.nex"), nex.bytes);
    const direct = await kliveJson(["run", file("runnext.nex"), "--until-halt"]);
    expect(direct.code).toBe(0);
    expect(direct.result.registers.af >> 8).toBe(4);
    expect(direct.err.some((l) => /started without NextZXOS/.test(l))).toBe(true);
  }, 120_000);
});

describe("klive run: exit codes", () => {
  it("exits 2 on build errors, with the errors in the gcc format", async () => {
    const run = await klive(["run", "build-error", "--frames", "1"]);
    expect(run.code).toBe(2);
    expect(run.err.some((l) => /main\.kz80\.asm:\d+:\d+: error: /.test(l))).toBe(true);
  }, 60_000);

  it("exits 3 for usage and input errors", async () => {
    expect((await klive(["run", "run48"])).err[0]).toMatch(/Say when the run stops/);
    expect((await klive(["run", "run48", "--frames", "x"])).code).toBe(3);
    expect((await klive(["run", path.join(FIXTURES, "run48/klive.project"), "--frames", "1"])).code).toBe(3);
    expect((await klive(["run", "run48", "--bp", "Nowhere"])).err[0]).toMatch(/neither a number nor a label/);
    const condition = await klive(["run", "run48", "--bp", "Step -if A ==", "--frames", "1"]);
    expect(condition.code).toBe(3);
    expect((await klive(["run", "run48", "--machine", "z88", "--frames", "1"])).code).toBe(3);
    expect((await klive(["run", "run48", "--keys", "~", "--frames", "1"])).err[0]).toMatch(/cannot type '~'/);
  }, 60_000);

  it("exits 4 when the machine core is missing", async () => {
    const run = await klive(["run", "run48", "--frames", "1"], { KLIVE_CLI_WASM_DIR: path.join(out, "no-cores") });
    expect(run.code).toBe(4);
    expect(run.err[0]).toMatch(/machine core was not found/);
  }, 60_000);
});

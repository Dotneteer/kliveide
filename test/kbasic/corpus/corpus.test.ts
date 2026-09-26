import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { runBasic, type Run } from "../codegen/run-kit";

/**
 * The Klive BASIC test corpus (plan R10): every `<area>/<name>.zxbas` below this folder is compiled,
 * run on the 48K harness and checked against the `'@expect` lines of its header comment block. The
 * compiler ignores those lines (`TEST_ONLY_OPTIONS`).
 *
 * | Expectation | Checks |
 * | --- | --- |
 * | `'@expect screen <row> "<text>"` | the screen row's text, trailing blanks removed |
 * | `'@expect byte <name> <value>` / `word <name> <value>` | a global variable (`_name`) |
 * | `'@expect peek <address> <value>` / `peekw <address> <value>` | a byte / word in memory |
 * | `'@expect error <code>` | the program stops with the report of ERR_NR code (2 is "3 Subscript wrong") |
 * | `'@expect heap <name> ...` | when the program ends the heap holds only these global Strings' values |
 * | `'@expect frames <n>` | run for at most n frames (default 500) |
 * | `'@expect keys <key> ...` | hold these keys (`SpectrumKeyCode` names) from the start |
 *
 * Numbers may be decimal or `$` hexadecimal.
 */
const ROOT = __dirname;

/** Optimisation levels to run: only level 0 exists until Phase 7 adds 1-3. */
const LEVELS = [0];

type Expectation =
  | { kind: "screen"; row: number; text: string }
  | { kind: "byte" | "word"; name: string; value: number }
  | { kind: "peek" | "peekw"; address: number; value: number }
  | { kind: "error"; code: number }
  | { kind: "heap"; names: string[] }
  | { kind: "frames"; count: number }
  | { kind: "keys"; keys: string[] };

function programs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? programs(join(dir, e.name)) : e.name.endsWith(".zxbas") ? [join(dir, e.name)] : []))
    .sort();
}

const num = (text: string) => (text.startsWith("$") ? parseInt(text.slice(1), 16) : Number(text));

export function readExpectations(source: string): Expectation[] {
  const out: Expectation[] = [];
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (!trimmed.startsWith("'")) break;
    const m = /^'\s*@expect\s+(\S+)\s*(.*)$/.exec(trimmed);
    if (!m) continue;
    const [, kind, rest] = m;
    const words = rest.split(/\s+/).filter(Boolean);
    switch (kind) {
      case "screen": {
        const s = /^(\d+)\s+"(.*)"$/.exec(rest);
        if (!s) throw new Error(`Bad screen expectation: ${trimmed}`);
        out.push({ kind, row: Number(s[1]), text: s[2] });
        break;
      }
      case "byte":
      case "word":
        out.push({ kind, name: words[0], value: num(words[1]) });
        break;
      case "peek":
      case "peekw":
        out.push({ kind, address: num(words[0]), value: num(words[1]) });
        break;
      case "error":
        out.push({ kind, code: num(words[0]) });
        break;
      case "heap":
        out.push({ kind, names: words });
        break;
      case "frames":
        out.push({ kind, count: num(words[0]) });
        break;
      case "keys":
        out.push({ kind, keys: words });
        break;
      default:
        throw new Error(`Unknown expectation '${kind}'`);
    }
  }
  return out;
}

/** The report character of an ERR_NR code: 0-8 are the digits 1-9, 9 onwards the letters A, B, ... */
function reportChar(code: number): string {
  return code < 9 ? String(code + 1) : String.fromCharCode(65 + code - 9);
}

function heapUsed(r: Run): number {
  const s = r.session;
  let free = 0;
  for (let p = s.peekWord(r.program.symbol("core.FreeList")); p !== 0; p = s.peekWord(p + 2)) free += s.peekWord(p);
  return r.program.symbol("core.HeapSize") - free;
}

/**
 * G4 (`.docs/kbasic-debug-builder.md` §7), checked on the run: inside a routine SP is IX minus the
 * frame at every statement entry; in the main program it is the first statement's SP minus two bytes
 * per GOSUB that has not returned yet. DATA items, which READ calls, are left out. A GOSUB or ON (which may or may not call) allows one level
 * more at the next main entry, a RETURN one level less; a SUB or FUNCTION call leaves it.
 */
function g4Problems(r: Run): string[] {
  const { mir } = r.generated;
  const problems: string[] = [];
  let baseline: number | undefined;
  let depths = new Set([0]);
  for (const v of r.entries) {
    const st = mir.statements[v.sid];
    const fn = mir.functions[st.functionIndex];
    // --- DATA items run as a call from READ, one level below the reading statement: not an activation of their own
    if (fn.kind === "data") continue;
    if (fn.kind !== "main") {
      const expected = (v.ix - 2 * Math.ceil(fn.frameSize / 2)) & 0xffff;
      if (v.sp !== expected) problems.push(`statement ${v.sid} in ${fn.name}: SP ${v.sp}, IX - frame ${expected}`);
      continue;
    }
    baseline ??= v.sp;
    const depth = (baseline - v.sp) / 2;
    if (!depths.has(depth)) {
      problems.push(`statement ${v.sid}: SP ${v.sp} is not the main baseline ${baseline} at GOSUB depth ${[...depths].join("/")}`);
      if (problems.length > 5) break;
    }
    depths =
      st.kind === "call" || st.kind === "switch" ? new Set([depth, depth + 1]) : st.kind === "return" ? new Set([depth - 1]) : new Set([depth]);
  }
  return problems;
}

const files = programs(ROOT);

describe("Klive BASIC corpus", () => {
  it("has the Phase 4 programs (60 from Phase 3, and 90 more)", () => {
    expect(files.length).toBeGreaterThanOrEqual(150);
  });

  for (const file of files) {
    const name = relative(ROOT, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    const expectations = readExpectations(source);
    for (const level of LEVELS) {
      it(`${name} (optimize ${level})`, async () => {
        expect(expectations.length, "the program states what it expects").toBeGreaterThan(0);
        const error = expectations.find((e) => e.kind === "error");
        const frames = expectations.find((e) => e.kind === "frames");
        const keys = expectations.find((e) => e.kind === "keys");
        const r = await runBasic(source, {
          optimize: level,
          ...(error ? { expectEnd: false } : {}),
          ...(frames ? { frames: frames.count } : error ? { frames: 100 } : {}),
          ...(keys ? { before: (s) => s.keyDown(...keys.keys) } : {}),
          traceEntries: true
        });
        expect(g4Problems(r), "G4: SP at statement entries").toEqual([]);
        expect(r.generated.debug.problems, "the debug-info validator").toEqual([]);
        for (const e of expectations) {
          switch (e.kind) {
            case "screen":
              expect(r.session.screenLine(e.row).trimEnd(), `screen row ${e.row}`).toBe(e.text);
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
            case "heap": {
              const held = e.names.reduce((n, v) => {
                const p = r.word(v);
                return n + (p ? r.session.peekWord(p - 2) : 0);
              }, 0);
              expect(heapUsed(r), "the heap holds only the named global Strings").toBe(held);
              break;
            }
          }
        }
      });
    }
  }
});

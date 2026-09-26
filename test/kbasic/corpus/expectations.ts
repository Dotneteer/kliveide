/**
 * The corpus programs' expectations (plan R10): the `'@expect` lines of a program's header comment
 * block, shared by the corpus runner and the behavioural oracle's runner (plan D12, R9).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

export type Expectation =
  | { kind: "screen"; row: number; text: string }
  | { kind: "byte" | "word"; name: string; value: number }
  | { kind: "peek" | "peekw"; address: number; value: number }
  | { kind: "error"; code: number }
  | { kind: "heap"; names: string[] }
  | { kind: "frames"; count: number }
  | { kind: "keys"; keys: string[] }
  | { kind: "oracle-differs"; entry: string };

/** The corpus programs below a folder, sorted. */
export function programs(dir: string): string[] {
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
      case "oracle-differs":
        out.push({ kind, entry: words[0] });
        break;
      default:
        throw new Error(`Unknown expectation '${kind}'`);
    }
  }
  return out;
}

/** The report character of an ERR_NR code: 0-8 are the digits 1-9, 9 onwards the letters A, B, ... */
export function reportChar(code: number): string {
  return code < 9 ? String(code + 1) : String.fromCharCode(65 + code - 9);
}

/**
 * What the behavioural oracle observed (plan D12): a corpus program compiled by upstream `zxbc` and
 * run on the 48K harness. Only observed results, never generated code.
 */
export type OracleResult = {
  program: string;
  zxbc: string;
  /** zxbc rejected the program (its first message line), e.g. for a Klive-only name. */
  compileError?: string;
  /** Screen rows 0-23, trailing blanks removed. */
  screen?: string[];
  /** Whether the program returned (false: it stopped with a report or was still running). */
  ended?: boolean;
  /** The bytes and words the program's `peek` / `peekw` expectations name. */
  peeks?: Record<string, number>;
};

/**
 * The expectations of a program on which Klive BASIC and the oracle disagree: the screen rows and
 * the error report its expectations check, compared as the oracle saw them. Empty when the oracle
 * could not compile the program.
 */
export function oracleDifferences(expectations: Expectation[], oracle: OracleResult): string[] {
  if (oracle.compileError || !oracle.screen) return [];
  const out: string[] = [];
  for (const e of expectations) {
    if (e.kind === "screen" && oracle.screen[e.row] !== e.text) {
      out.push(`screen row ${e.row}: Klive "${e.text}", zxbc "${oracle.screen[e.row]}"`);
    } else if (e.kind === "error" && !oracle.screen[23]?.startsWith(`${reportChar(e.code)} `)) {
      out.push(`error: Klive ${reportChar(e.code)}, zxbc "${oracle.screen[23]}"`);
    } else if ((e.kind === "peek" || e.kind === "peekw") && oracle.peeks?.[`${e.kind} ${e.address}`] !== e.value) {
      out.push(`${e.kind} ${e.address}: Klive ${e.value}, zxbc ${oracle.peeks?.[`${e.kind} ${e.address}`]}`);
    }
  }
  return out;
}

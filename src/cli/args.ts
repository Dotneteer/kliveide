import { usageError } from "./exit-codes";

/*
 * A small argument parser (`.plans/UNIT_TESTS_CLI_PLAN.md` D13: no new dependency).
 *
 * Long options only (`--json`, `--timeout 30`, `--timeout=30`). Single-dash words are positional:
 * they belong to the IDE command syntax that `klive ide cmd` and `klive ide bp set` pass through
 * (`bp set $8000 -if A == 1`), never to the CLI.
 */

export type OptionSpec = {
  /** Options without a value */
  flags?: string[];
  /** Options with a value */
  values?: string[];
  /** Value options that may repeat (collected into an array) */
  repeatable?: string[];
};

export type ParsedArgs = {
  positional: string[];
  options: Record<string, string | boolean | string[]>;
};

/**
 * Parses arguments. An unknown `--option` is a usage error; `--` ends option parsing.
 * @param argv The arguments
 * @param spec The options this command accepts
 * @param passthrough Leave unknown `--options` in the positional list instead of failing
 */
export function parseArgs(argv: string[], spec: OptionSpec, passthrough = false): ParsedArgs {
  const flags = new Set(spec.flags ?? []);
  const values = new Set([...(spec.values ?? []), ...(spec.repeatable ?? [])]);
  const repeatable = new Set(spec.repeatable ?? []);
  const positional: string[] = [];
  const options: ParsedArgs["options"] = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (!arg.startsWith("--") || arg.length === 2) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = arg.slice(2, eq < 0 ? undefined : eq);
    if (flags.has(name)) {
      if (eq >= 0) throw usageError(`--${name} takes no value.`);
      options[name] = true;
      continue;
    }
    if (values.has(name)) {
      let value: string;
      if (eq >= 0) {
        value = arg.slice(eq + 1);
      } else {
        if (i + 1 >= argv.length) throw usageError(`--${name} needs a value.`);
        value = argv[++i];
      }
      if (repeatable.has(name)) {
        const list = (options[name] as string[] | undefined) ?? [];
        list.push(value);
        options[name] = list;
      } else {
        options[name] = value;
      }
      continue;
    }
    if (passthrough) {
      positional.push(arg);
      continue;
    }
    throw usageError(`Unknown option --${name}.`);
  }
  return { positional, options };
}

/** A number in the IDE's notations: `$8000`, `0x8000`, `#8000`, `8000h`, `%1010` or decimal */
export function parseNumber(text: string): number | undefined {
  const t = text.trim().replace(/_/g, "");
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(?:\$|0x|#)([0-9a-f]+)$/i))) return parseInt(m[1], 16);
  if ((m = t.match(/^([0-9a-f]+)h$/i))) return parseInt(m[1], 16);
  if ((m = t.match(/^%([01]+)$/))) return parseInt(m[1], 2);
  if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
  return undefined;
}

/** A number within a range, or a usage error naming what it is */
export function parseNumberIn(text: string, what: string, min: number, max: number): number {
  const value = parseNumber(text);
  if (value === undefined) throw usageError(`${what} must be a number ($8000, 0x8000, %1010 or 32768): '${text}'.`);
  if (value < min || value > max) throw usageError(`${what} must be between ${min} and ${max}: '${text}'.`);
  return value;
}

/**
 * A memory location: `$5C00` (the CPU's view) or `B5:$0100` (a partition and an offset, as the
 * memory panel writes it; `.plans/COMMAND_LINE_AUTOMATION_PLAN.md` T8).
 */
export function parseLocation(text: string): { address: number } | { partition: string; offset: number } {
  const colon = text.indexOf(":");
  if (colon > 0) {
    const partition = text.slice(0, colon).trim();
    if (!/^[A-Za-z0-9]+$/.test(partition)) throw usageError(`Not a partition label: '${partition}'.`);
    return { partition: partition.toUpperCase(), offset: parseNumberIn(text.slice(colon + 1), "The offset", 0, 0x1ffff) };
  }
  return { address: parseNumberIn(text, "The address", 0, 0xffff) };
}

/** A timeout in seconds as milliseconds */
export function parseSeconds(text: string, what = "--timeout"): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) throw usageError(`${what} must be a positive number of seconds: '${text}'.`);
  return Math.round(value * 1000);
}

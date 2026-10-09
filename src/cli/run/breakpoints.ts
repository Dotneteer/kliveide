import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { ConditionSymbols } from "@common/utils/breakpoint-condition/condition-types";
import { parseHitSpec } from "@common/utils/breakpoint-filters";
import { parseNumber } from "../args";
import { usageError } from "../exit-codes";

/*
 * `klive run --bp` (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D15): a breakpoint in the IDE's `bp-set`
 * syntax, the part of it a headless run can use - an address or a label of the build, the access
 * kinds, a byte range, an I/O mask, a hit rule, a one-shot, a logpoint and a condition (last: it takes
 * the rest of the text). The conditions and log templates are the emulator's own; they are checked
 * when the breakpoint is set.
 */

export const BP_SYNTAX = "<address|label> [-r] [-w] [-i] [-o] [-m <mask>] [-len <bytes>] [-once] [-log \"<template>\"] [-hit <spec>] [-if <condition>]";

/** An address (`$8000`, `0x8000`, `32768`) or a label of the build */
export function resolveAddress(text: string, symbols: ConditionSymbols | undefined, what: string): number {
  const value = parseNumber(text);
  if (value !== undefined) {
    if (value > 0xffff) throw usageError(`${what} must be between 0 and $FFFF: '${text}'.`);
    return value;
  }
  const symbol = symbols && Object.entries(symbols).find(([name]) => name.toLowerCase() === text.toLowerCase());
  if (symbol) return symbol[1] & 0xffff;
  throw usageError(
    symbols
      ? `${what} is neither a number nor a label of the build: '${text}'.`
      : `${what} must be a number ($8000, 0x8000 or 32768); labels need a project build: '${text}'.`
  );
}

/** Splits at spaces, keeping "quoted text" whole (quotes removed, \" kept as ") */
function tokenize(text: string): { token: string; start: number }[] {
  const tokens: { token: string; start: number }[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    const start = i;
    let token = "";
    if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && text[i + 1] === '"') i++;
        token += text[i++];
      }
      if (i >= text.length) throw usageError(`An unclosed quote in --bp '${text}'.`);
      i++;
    } else {
      while (i < text.length && !/\s/.test(text[i])) token += text[i++];
    }
    tokens.push({ token, start });
  }
  return tokens;
}

/**
 * Parses one `--bp` value
 * @throws CliError (exit code 3) naming what is wrong
 */
export function parseBreakpointOption(text: string, symbols?: ConditionSymbols): BreakpointInfo {
  const tokens = tokenize(text);
  if (!tokens.length) throw usageError(`--bp needs an address: ${BP_SYNTAX}`);
  const bp: BreakpointInfo = { address: resolveAddress(tokens[0].token, symbols, "The breakpoint address") };
  let access = false;
  for (let i = 1; i < tokens.length; i++) {
    const { token, start } = tokens[i];
    const value = (what: string) => {
      if (i + 1 >= tokens.length) throw usageError(`--bp: ${token} needs ${what}.`);
      return tokens[++i].token;
    };
    switch (token) {
      case "-r":
        bp.memoryRead = access = true;
        break;
      case "-w":
        bp.memoryWrite = access = true;
        break;
      case "-i":
        bp.ioRead = access = true;
        break;
      case "-o":
        bp.ioWrite = access = true;
        break;
      case "-m": {
        const mask = parseNumber(value("a mask"));
        if (mask === undefined || mask > 0xffff) throw usageError(`--bp: -m takes a 16-bit mask: '${text}'.`);
        bp.ioMask = mask;
        break;
      }
      case "-len": {
        const length = parseNumber(value("a byte count"));
        if (length === undefined || length < 1 || length > 0x10000) throw usageError(`--bp: -len takes 1 to 65536 bytes: '${text}'.`);
        bp.length = length;
        break;
      }
      case "-once":
        bp.oneShot = true;
        break;
      case "-log":
        bp.logMessage = value("a message template");
        break;
      case "-hit": {
        const hit = parseHitSpec(value("a hit rule"));
        if ("error" in hit) throw usageError(`--bp: ${hit.error}.`);
        Object.assign(bp, hit);
        break;
      }
      case "-if": {
        // --- The rest of the text, as the IDE's -if takes the rest of the line
        const rest = text.slice(start + 3).trim();
        if (!rest) throw usageError("--bp: -if needs a condition after it.");
        bp.condition = rest;
        i = tokens.length;
        break;
      }
      default:
        throw usageError(`--bp: unknown option '${token}'. The syntax is ${BP_SYNTAX}`);
    }
  }
  if (bp.ioMask !== undefined && !(bp.ioRead || bp.ioWrite)) throw usageError("--bp: -m is the mask of an I/O breakpoint (-i or -o).");
  if (bp.length !== undefined && !(bp.memoryRead || bp.memoryWrite)) throw usageError("--bp: -len is the range of a memory breakpoint (-r or -w).");
  if (bp.oneShot && bp.logMessage !== undefined) throw usageError("--bp: a logpoint cannot be a one-shot (-once with -log).");
  if (!access) bp.exec = true;
  return bp;
}

import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CurrentStatementTracker,
  locateActivations,
  SourceDebugIndex
} from "@emu/machines/SourceStepDecision";
import { buildSourceCallStack } from "@renderer/appIde/debugger/source/call-stack-model";
import type { MemoryView } from "@renderer/appIde/debugger/source/value-decoder";
import {
  buildVariableSections,
  type VariableNode
} from "@renderer/appIde/debugger/source/variables-model";
import { evaluateWatch } from "@renderer/appIde/debugger/source/watch-expression";

import { startBasic } from "../codegen/run-kit";

import { isNextOnly, programs, readExpectations } from "./expectations";

/**
 * The source-level debugger on the whole corpus (plan Phase 5 exit: "call stack, Variables panel
 * and watches work on the corpus, 48K"). Each program runs in a debug run with a breakpoint on every
 * statement, the standard library's included (Just My Code off); at the first STOPS distinct statements it reaches, the panels' models are built from
 * the real machine and checked against each other:
 *
 * - the call stack ends in the main program, its innermost activation is the callable holding the
 *   statement, and every routine activation has its frame (IX) at a statement entry;
 * - the innermost row stands on the statement the machine stopped at;
 * - the Variables panel decodes every variable in scope, and a watch naming a scalar variable
 *   evaluates to exactly what its Variables row shows.
 */
const STOPS = 25;
const ROOT = __dirname;

const scalarRows = (nodes: VariableNode[] | undefined) =>
  (nodes ?? []).filter(
    (n) => !n.expand && n.address !== undefined && /^[A-Za-z_][A-Za-z0-9_]*\$?$/.test(n.name)
  );

describe("the source-level debugger on the corpus", () => {
  // --- Next-only programs (CODEBANK): their debugging is checked on the Next harness (codebank-step.test.ts)
  for (const file of programs(ROOT).filter((f) => !isNextOnly(readFileSync(f, "utf8")))) {
    const name = relative(ROOT, file).replace(/\\/g, "/");
    for (const level of [0, 1, 2])
      it(`${name} (optimize ${level})`, async () => {
        const source = readFileSync(file, "utf8");
        const expectations = readExpectations(source);
        const keys = expectations.find((e) => e.kind === "keys");
        const { session, generated, done } = await startBasic(source, { optimize: level });
        if (keys) session.keyDown(...keys.keys);
        const info = generated.debug.sourceLevel;
        // --- Just My Code off: the library's statements are checked like the user's
        const index = new SourceDebugIndex(info, false);
        const debugSupport = session.attachDebugSupport();
        debugSupport.statementTracker = new CurrentStatementTracker(index);
        // --- A program that raises an error ends at the error stop, not in the ROM's report loop
        const errorEntry = info.extensions!.errorEntry;
        debugSupport.errorStopAddress = errorEntry;
        for (const s of info.statements) {
          if (s.endAddress > s.startAddress)
            debugSupport.addBreakpoint({ address: s.startAddress, exec: true });
        }
        const mem: MemoryView = {
          byte: (a) => session.peek(a & 0xffff),
          word: (a) => session.peekWord(a & 0xffff)
        };
        const problems: string[] = [];
        let stops = 0;
        while (stops < STOPS) {
          let pc: number;
          try {
            pc = session.continueToBreakpoint({ returnTo: done, maxFrames: 200 });
          } catch {
            break; // --- The program ended, or waits for something no stop will come from
          }
          if (pc === errorEntry) break;
          stops++;
          debugSupport.removeBreakpoint({ address: pc, exec: true });
          const statement = index.entryAt(pc);
          const where = `line ${info.statements[statement]?.startLine}`;
          const view = {
            pc,
            sp: session.machine.sp,
            ix: session.machine.ix,
            readWord: (a: number) => session.peekWord(a)
          };
          const chain = locateActivations(index, view);
          const stop = { kind: "statement" as const, pc, statementIndex: statement, returned: [] };

          if (chain[chain.length - 1]?.kind !== "main")
            problems.push(`${where}: the call stack does not end in main`);
          const holder = index.callableAt(pc);
          if (
            holder !== undefined &&
            chain[0]?.callableIndex !== holder &&
            chain[0]?.kind !== "gosub"
          ) {
            problems.push(
              `${where}: innermost activation ${chain[0]?.callableIndex}, the statement is in ${holder}`
            );
          }
          chain.forEach((a, k) => {
            if (a.kind === "routine" && a.ix === undefined)
              problems.push(`${where}: frame ${k} has no IX`);
          });
          const rows = buildSourceCallStack(info, chain, stop);
          const top = rows[0];
          if (!top || "runtime" in top || top.line !== info.statements[statement].startLine) {
            problems.push(`${where}: the innermost call-stack row is not the stop's statement`);
          }

          chain.forEach((_, frame) => {
            const sections = buildVariableSections(info, chain, frame, stop, mem);
            const ctx = { info, chain, frame, mem };
            for (const row of [...scalarRows(sections.locals), ...scalarRows(sections.globals)]) {
              // --- A global hidden by a local of the same name is not what a watch of that name reads
              if (
                sections.locals?.some((l) => l.name === row.name) &&
                sections.globals.includes(row)
              )
                continue;
              const r = evaluateWatch(row.name, ctx);
              const text = "error" in r ? `error: ${r.error}` : r.text;
              if (text !== row.value)
                problems.push(
                  `${where}, frame ${frame}: watch ${row.name} = ${text}, Variables shows ${row.value}`
                );
            }
          });
          if (problems.length > 5) break;
        }
        expect(problems).toEqual([]);
        expect(stops, "the program reached a statement").toBeGreaterThan(0);
      });
  }
});

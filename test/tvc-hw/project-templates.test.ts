import { describe, expect, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { playInjectionFlow, type FrameMachine } from "@common/headless/frameRunner";
import { encodePng } from "@common/imaging/png";
import { parseTvcCasFile } from "@emu/machines/tvc/TvcCasFile";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { tvcExportFile } from "@renderer/appIde/utils/tvc-code";
import { createTvcSession, type TvcTestSession } from "../harness/tvc";

/**
 * The TVC project template (`.plans/VIDEOTON_TVC_PLAN.md` Phase 7) assembles without errors and does
 * what its comments say, run as the IDE runs it and loaded from its export. The pictures were checked
 * by eye (`TVC_TEMPLATE_PNG=<dir>` writes them); the test finds the template's two lines of text as the
 * rows of ink it has more than a program that prints nothing.
 */
const SOURCE = readFileSync(join(__dirname, "../../src/public/project-templates/tvc/default/code/code.kz80.asm"), "utf8");

/** A program in the template's place that prints nothing: what the template's text is measured against */
const SILENT = ".model TVC\n .org $1A30\n ret";

async function build(source = SOURCE): Promise<CodeToInject> {
  const out = await new Z80Assembler().compile(source);
  expect(out.errors).toEqual([]);
  return {
    model: "tvc",
    entryAddress: out.entryAddress,
    segments: out.segments.map((s) => ({ startAddress: s.startAddress, bankOffset: 0, emittedCode: s.emittedCode })),
    options: {}
  };
}

/** The picture rows that are not paper: the text the program and BASIC printed */
function inkRows(s: TvcTestSession): number {
  const pixels = s.screenPixels();
  const paper = pixels[60 * 608 + 300];
  let rows = 0;
  for (let y = 24; y < 264; y++) {
    for (let x = 48; x < 560; x++) {
      if (pixels[y * 608 + x] !== paper) {
        rows++;
        break;
      }
    }
  }
  return rows;
}

function save(s: TvcTestSession, name: string): void {
  const dir = process.env.TVC_TEMPLATE_PNG;
  if (dir) writeFileSync(join(dir, `${name}.png`), encodePng(s.screenPixels(), 608, 288));
}

/** Two lines of the ROM's characters: the template's text, with no other line moved */
const TWO_LINES = 2 * 7;

async function runAsIde(model: string, source: string, name: string): Promise<number> {
  const s = await createTvcSession({ model });
  playInjectionFlow(s.machine as unknown as FrameMachine, await s.machine.getCodeInjectionFlow("tvc"), {
    code: await build(source),
    maxFrames: 2000
  });
  s.runUntil(() => s.isWaitingForKey() && s.machine.getKeyQueueLength() === 0, { maxFrames: 600 }, "BASIC's prompt");
  s.runFrames(10);
  save(s, name);
  return inkRows(s);
}

async function loadExport(source: string, name: string): Promise<number> {
  const file = tvcExportFile(await build(source));
  if (!("data" in file)) throw new Error(file.error);
  const s = (await createTvcSession()).bootToBasic();
  s.insertTape(parseTvcCasFile(file.data, "code.cas"));
  s.typeKeys("LOAD\n", { settle: 5 });
  s.runWhileMotor();
  s.runUntil(() => s.isWaitingForKey(), { maxFrames: 600 }, "BASIC's prompt");
  s.runFrames(10);
  save(s, name);
  return inkRows(s);
}

describe("TVC project template", () => {
  it.each(["tvc64", "tvc64p"])("prints its welcome and returns to BASIC (%s)", async (model) => {
    const silent = await runAsIde(model, SILENT, `silent-run-${model}`);
    expect(await runAsIde(model, SOURCE, `template-run-${model}`)).toBeGreaterThanOrEqual(silent + TWO_LINES);
  });

  it("does the same loaded from its exported .cas", async () => {
    const silent = await loadExport(SILENT, "silent-load");
    expect(await loadExport(SOURCE, "template-load")).toBeGreaterThanOrEqual(silent + TWO_LINES);
  });
});

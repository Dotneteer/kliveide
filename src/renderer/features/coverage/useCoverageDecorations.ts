import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import type * as monacoEditor from "monaco-editor";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { hasMachineFeature } from "@common/features/advancedDebugging";
import { MF_PROFILE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { SETTING_IDE_COVERAGE_LINE_TINT } from "@common/settings/setting-const";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { buildCoverageModel, lineCoverage, type CoverageModel, type LineCoverage } from "@common/profile/coverageModel";

/*
 * The editor's coverage strip (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` D12): its own decorations
 * collection in `linesDecorationsClassName` - the narrow strip between the line numbers and the text
 * - so the glyph margin stays the breakpoints'. Covered, partial and not-covered lines; a line that
 * emitted no code has nothing. An optional line tint (a setting) gives DeZog's background too.
 *
 * It refreshes on `profileVersion` (throttled by the machine controller) and on a new compilation,
 * and asks the core only about the instruction starts of this file's lines.
 */

/** The strip's classes, from the editor's stylesheet */
export type CoverageClasses = {
  covered: string;
  partial: string;
  uncovered: string;
  lineTint: string;
};

/** Whether two paths name the same file (Windows paths compare without case) */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
  return norm(a) === norm(b);
}

/** The decorations of one file's line coverage (pure: the editor test checks them) */
export function coverageDecorations(
  lines: Map<number, LineCoverage> | undefined,
  classes: CoverageClasses,
  lineTint: boolean,
  lineCount: number
): monacoEditor.editor.IModelDeltaDecoration[] {
  const decorations: monacoEditor.editor.IModelDeltaDecoration[] = [];
  if (!lines) return decorations;
  for (const [line, c] of lines) {
    if (line < 1 || line > lineCount) continue;
    const cls = c.state === "covered" ? classes.covered : c.state === "partial" ? classes.partial : classes.uncovered;
    const tooltip =
      c.state === "uncovered"
        ? "Not executed"
        : c.hits !== undefined
          ? `Executed ${c.hits.toLocaleString("en-US")} time${c.hits === 1 ? "" : "s"}` +
            (c.state === "partial" ? ` (${c.executed} of ${c.total} instructions ran)` : "")
          : c.state === "partial"
            ? `${c.executed} of ${c.total} instructions ran`
            : "Executed";
    decorations.push({
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
      options: {
        isWholeLine: true,
        linesDecorationsClassName: cls,
        linesDecorationsTooltip: tooltip,
        ...(lineTint && c.state !== "uncovered" ? { className: classes.lineTint } : {})
      }
    });
  }
  return decorations;
}

/**
 * Keeps an editor's coverage strip current
 * @param editorReady Changes when the editor (re)mounts
 * @param fileName The document's full path
 */
export function useCoverageDecorations(
  editor: MutableRefObject<monacoEditor.editor.IStandaloneCodeEditor | null>,
  editorReady: number,
  fileName: string,
  classes: CoverageClasses
): void {
  const emuApi = useEmuApi();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const available = useSelector((s) =>
    hasMachineFeature(
      machineRegistry.find((m) => m.machineId === s.emulatorState?.machineId),
      MF_PROFILE,
      s
    )
  );
  const profileVersion = useSelector((s) => s.emulatorState?.profileVersion);
  const result = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  const lineTint = !!useGlobalSetting(SETTING_IDE_COVERAGE_LINE_TINT);
  const collection = useRef<monacoEditor.editor.IEditorDecorationsCollection | null>(null);

  // --- The compilation's model, and this file's part of it (rebuilt per build, not per refresh)
  const fileModel = useMemo((): CoverageModel | undefined => {
    if (!available || !result) return undefined;
    const model = buildCoverageModel(result, machineId);
    const fileIndex = model.files.findIndex((f) => samePath(f, fileName));
    if (fileIndex < 0) return undefined;
    const lines = model.lines.filter((l) => l.fileIndex === fileIndex);
    // --- Only this file's points, renumbered
    const used = new Map<number, number>();
    const points: CoverageModel["points"] = [];
    const renumbered = lines.map((l) => ({
      ...l,
      fileIndex: 0,
      points: l.points.map((p) => {
        let index = used.get(p);
        if (index === undefined) {
          index = points.length;
          used.set(p, index);
          points.push(model.points[p]);
        }
        return index;
      })
    }));
    return { points, lines: renumbered, files: [model.files[fileIndex]] };
  }, [available, result, machineId, fileName]);

  useEffect(() => {
    let cancelled = false;
    const clear = () => {
      collection.current?.clear();
      collection.current = null;
    };
    const ed = editor.current;
    if (!ed || !fileModel || !fileModel.points.length) {
      clear();
      return undefined;
    }
    void (async () => {
      const sample = await emuApi
        .getProfileSample(
          fileModel.points.map((p) => p.address),
          fileModel.points.map((p) => p.partition),
          true
        )
        .catch(() => undefined);
      if (cancelled || editor.current !== ed) return;
      // --- Nothing recorded yet: no strip at all, rather than every line "not executed"
      if (!sample || (!sample.info.enabled && sample.info.instructions === 0)) {
        clear();
        return;
      }
      const lines = lineCoverage(fileModel, sample.flags, sample.exec).get(fileModel.files[0]);
      const decorations = coverageDecorations(lines, classes, lineTint, ed.getModel()?.getLineCount() ?? 0);
      if (collection.current) collection.current.set(decorations);
      else collection.current = ed.createDecorationsCollection(decorations);
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, editorReady, fileModel, profileVersion, lineTint, emuApi, classes]);

  // --- Gone with the editor
  useEffect(
    () => () => {
      collection.current?.clear();
      collection.current = null;
    },
    []
  );
}

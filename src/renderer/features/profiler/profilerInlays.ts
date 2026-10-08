import { useEffect, useRef, type MutableRefObject } from "react";
import type * as monacoEditor from "monaco-editor";

import type { KliveCompilerOutput } from "@abstractions/CompilerInfo";
import { hasMachineFeature } from "@common/features/advancedDebugging";
import { MF_PROFILE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { SETTING_IDE_PROFILER_INLAYS } from "@common/settings/setting-const";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { useEmuApi } from "@renderer/core/EmuApi";
import { buildProfilerModel, readProfileSnapshot, type ProfilerModel } from "./profilerModel";

/*
 * The profiler's editor hints (`.plans/PROFILER_PLAN.md` D15): with a profile present and the
 * setting on (it is off by default), a Monaco inlay at the end of each routine's first line -
 * "9.4% · 1,204 calls". Nothing else in the editor changes.
 *
 * One provider per language (`registerProfilerInlayProvider`, from the Monaco bootstrap) serves
 * every editor; each editor's hook puts its file's hints in the store under its model's URI.
 */

/** Whether two paths name the same file (Windows paths compare without case) */
function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\\/g, "/").toLowerCase();
  return norm(a) === norm(b);
}

/** One file's hints: the routine's first line and its text (pure, so it is tested without Monaco) */
export function routineInlays(model: ProfilerModel, fileName: string): Map<number, string> {
  const hints = new Map<number, string>();
  for (const row of model.flat.rows) {
    if (row.pseudo || !row.file || !row.line || !samePath(row.file, fileName)) continue;
    // --- A routine that took no measurable share says nothing; one never called (jumped to) no count
    const pct = row.selfPct.toFixed(1);
    if (pct === "0.0") continue;
    const unit = row.callsFromGraph ? "call" : "entry";
    const count = row.calls
      ? ` · ${row.calls.toLocaleString("en-US")} ${row.calls === 1 ? unit : unit === "call" ? "calls" : "entries"}`
      : "";
    const text = `${pct}%${count}`;
    // --- Two routines on one line (a label and a proc): the bigger one speaks
    if (!hints.has(row.line)) hints.set(row.line, text);
  }
  return hints;
}

/** The hints per editor model (its URI) */
const store = new Map<string, Map<number, string>>();
const listeners = new Set<() => void>();

function setInlays(uri: string, hints: Map<number, string> | undefined): void {
  if (!hints?.size) {
    if (!store.delete(uri)) return;
  } else {
    store.set(uri, hints);
  }
  for (const fire of listeners) fire();
}

/** The language ids that get the provider: the Klive assembler, sjasmplus and Klive BASIC */
export const PROFILER_INLAY_LANGUAGES = ["kz80-asm", "sjasmp", "zxbas"];

/**
 * Registers the inlay provider for one language (the Monaco bootstrap calls it once per language).
 *
 * New hints re-register the provider rather than firing `onDidChangeInlayHints`: Monaco 0.55's
 * inlay controller adds its listener for that event to a store it resets on every request, yet
 * remembers the provider as watched, so after a second request the event is never heard again (the
 * hints of an editor opened before the profile existed never appeared). A registry change restarts
 * every editor's session, which always asks again.
 */
export function registerProfilerInlayProvider(monaco: typeof monacoEditor, languageId: string): void {
  const provider: monacoEditor.languages.InlayHintsProvider = {
    provideInlayHints(model, range) {
      const hints = store.get(model.uri.toString());
      if (!hints) return { hints: [], dispose: () => {} };
      const result: monacoEditor.languages.InlayHint[] = [];
      for (const [line, text] of hints) {
        if (line < range.startLineNumber || line > range.endLineNumber || line > model.getLineCount()) continue;
        result.push({
          label: text,
          position: { lineNumber: line, column: model.getLineMaxColumn(line) },
          kind: monaco.languages.InlayHintKind.Type,
          paddingLeft: true,
          tooltip: "The routine's share of the profile's time, and its calls (the Profiler)"
        });
      }
      return { hints: result, dispose: () => {} };
    }
  };
  if (typeof monaco.languages?.registerInlayHintsProvider !== "function") return;
  let registration = monaco.languages.registerInlayHintsProvider(languageId, provider);
  listeners.add(() => {
    registration.dispose();
    registration = monaco.languages.registerInlayHintsProvider(languageId, provider);
  });
}

/** At most one read of the profile per this long: it moves every 10 frames while running */
const REFRESH_INTERVAL_MS = 750;

/**
 * Keeps an editor's profiler hints current: on a profile move, a new build, and the setting. The
 * reads are throttled, not debounced - a running machine moves the profile every 10 frames, and a
 * debounce would never fire while it runs - and each read uses the values current when it fires.
 */
export function useProfilerInlays(
  editor: MutableRefObject<monacoEditor.editor.IStandaloneCodeEditor | null>,
  editorReady: number,
  fileName: string
): void {
  const emuApi = useEmuApi();
  const enabled = !!useGlobalSetting(SETTING_IDE_PROFILER_INLAYS);
  const available = useSelector((s) =>
    hasMachineFeature(
      machineRegistry.find((m) => m.machineId === s.emulatorState?.machineId),
      MF_PROFILE,
      s
    )
  );
  const profileVersion = useSelector((s) => s.emulatorState?.profileVersion);
  const result = useSelector((s) => s.compilation?.result) as KliveCompilerOutput | undefined;
  const uri = useRef<string | undefined>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>();
  const unmounted = useRef(false);

  // --- The read a timer fires: whatever editor, file and build are current then
  const refresh = useRef<() => Promise<void>>(async () => {});
  refresh.current = async () => {
    const modelUri = editor.current?.getModel()?.uri.toString();
    if (!modelUri || !enabled || !available || !result) return;
    const snapshot = await readProfileSnapshot(emuApi).catch(() => undefined);
    if (unmounted.current || editor.current?.getModel()?.uri.toString() !== modelUri) return;
    const model = snapshot && snapshot.status.timeTotal ? buildProfilerModel(snapshot, result) : undefined;
    setInlays(modelUri, model ? routineInlays(model, fileName) : undefined);
  };

  useEffect(() => {
    const modelUri = editor.current?.getModel()?.uri.toString();
    if (uri.current && uri.current !== modelUri) setInlays(uri.current, undefined);
    uri.current = modelUri;
    if (!modelUri || !enabled || !available || !result) {
      if (modelUri) setInlays(modelUri, undefined);
      clearTimeout(timer.current);
      timer.current = undefined;
      return;
    }
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = undefined;
      void refresh.current();
    }, REFRESH_INTERVAL_MS);
  }, [editor, editorReady, fileName, enabled, available, result, profileVersion, emuApi]);

  // --- Gone with the editor
  useEffect(
    () => () => {
      unmounted.current = true;
      clearTimeout(timer.current);
      if (uri.current) setInlays(uri.current, undefined);
    },
    []
  );
}

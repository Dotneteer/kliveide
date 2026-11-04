import fs from "fs";
import path from "path";

import type { BorielNexDebug } from "@common/messaging/BorielIntegration";
import { createSourceDebugSidecar, sidecarProgramOf } from "@common/utils/source-debug-sidecar";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { segmentOfPartition } from "./boriel-banked";
import { parseMemoryMap } from "./boriel-map";
import { programOf, readDebugFile } from "./BorielCompiler";
import { adaptBorielDebugInfo } from "./dbg-adapter";

/*
 * Source-level debugging for a `.nex` that zxbc built outside Klive: the `<name>.dbg` zxbc wrote
 * beside it (`--debug=`), with `<name>.map` (`-M`) when it is there, turned into the sidecar Klive
 * writes beside its own NEX exports, so `nex-run -d` debugs it the same way. The `.dbg` is used only
 * when the program it describes is the one the `.nex` loads (its length and checksum).
 *
 * zxbc puts the program's origin in the NEX header's PC (`-S`); the source files the `.dbg` names
 * relative to zxbc's working folder are taken relative to the `.dbg`'s folder.
 */

/** The `.dbg` beside a `.nex` (`program.nex` -> `program.dbg`). */
export function borielDbgPathFor(nexPath: string): string {
  return path.join(path.dirname(nexPath), `${path.basename(nexPath, path.extname(nexPath))}.dbg`);
}

/**
 * The sidecar text for `nexPath` from zxbc's `.dbg` beside it; why that `.dbg` cannot be used; or
 * undefined when there is none. `libraryFolder` is the installed kit's `lib/` (or empty).
 */
export function borielNexDebug(nexPath: string, libraryFolder: string): BorielNexDebug | undefined {
  const dbgFile = borielDbgPathFor(nexPath);
  if (!fs.existsSync(dbgFile)) return undefined;
  const fail = (error: string): BorielNexDebug => ({ dbgFile, error });

  const debugFile = readDebugFile(dbgFile);
  if (typeof debugFile === "string") return fail(debugFile);
  if (debugFile.architecture && debugFile.architecture !== "zxnext") {
    return fail(`it was written for ${debugFile.architecture}, not the ZX Spectrum Next`);
  }
  const nex = new Uint8Array(fs.readFileSync(nexPath));
  const loaded = loadNexFileContents(nex);
  if (!loaded.fileInfo) return fail(`the .nex cannot be read (${loaded.error})`);
  const origin = loaded.fileInfo.header.programCounter;
  const program = programOf(nex, "nex", origin, debugFile, "zxnext");
  if (typeof program === "string") return fail(`it belongs to another build of the program (${program})`);
  const { image, segments } = program;

  const mapFile = dbgFile.replace(/\.dbg$/, ".map");
  const folder = path.dirname(dbgFile);
  const debug = adaptBorielDebugInfo({
    dbg: debugFile,
    map: parseMemoryMap(fs.existsSync(mapFile) ? fs.readFileSync(mapFile, "utf8") : ""),
    arch: "zxnext",
    baseFolder: folder,
    libraryFolder,
    // --- The .dbg does not record zxbc's -O, and a build outside Klive has no other record of it
    optimizationLevel: 0,
    image: { bytes: image, origin },
    bankImages: segments
      .filter((s) => s.bank !== undefined)
      .map((s) => ({ partition: s.bank! * 2, bytes: s.emittedCode, origin: s.startAddress })),
    readFile: (file) => {
      try {
        return fs.readFileSync(file, "utf8");
      } catch {
        return undefined;
      }
    }
  });
  // --- A banked program's breakpoints need their bank, as in a build (BorielCompiler)
  if (segments.some((s) => s.bank !== undefined)) {
    for (const item of debug.listFileItems) item.segmentIndex = segmentOfPartition(segments, item.partition, "zxnext");
  }
  const entryAddress =
    debugFile.sourceLevelDebug?.callables?.find((c: any) => c.kind === "entrypoint")?.entryAddress ?? origin;
  const sidecarProgram = sidecarProgramOf({
    sourceFileList: debug.sourceFileList,
    listFileItems: debug.listFileItems,
    sourceMap: debug.sourceMap,
    segments,
    modelType: SpectrumModelType.Next,
    entryAddress
  });
  return { dbgFile, sidecar: createSourceDebugSidecar(nex, debug.sourceLevelDebug, sidecarProgram) };
}

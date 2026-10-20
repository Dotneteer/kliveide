import { useEffect, useMemo, useState } from "react";
import type { MainApi } from "@common/messaging/MainApi";
import type { IProjectService } from "@renderer/abstractions/IProjectService";

import type { AnnotationMachine } from "@common/annotations/bankSpace";
import type { ProgramAnnotations } from "./programAnnotations";
import { inheritedSidecarSource } from "./romAnnotationLoader";
import { inheritsOf, withInheritedEntries } from "./romInheritance";

/**
 * What a ROM page document lists: the sidecar it edits, with the entries of the sidecars it
 * `inherits` laid under its own wherever their bytes match this page — as the live Disassembly view
 * shows the page. Only the listing reads this; edits still go to the sidecar's own model, so an
 * inherited name is changed by giving the offset a label of the page's own.
 *
 * Anything that is not a ROM sidecar with `inherits` comes back unchanged.
 */
export function useInheritedRomAnnotations(
  annotations: ProgramAnnotations | undefined,
  machine: AnnotationMachine,
  bank: number | undefined,
  bytes: Uint8Array | undefined,
  mainApi: Pick<MainApi, "readTextFile" | "readBinaryFile" | "resolveKliveHomePath" | "canWriteBeside">,
  projectService: Pick<IProjectService, "readFileContent">
): ProgramAnnotations | undefined {
  const inherits = machine === "rom" && !!annotations && inheritsOf(annotations).length > 0;
  const source = useMemo(
    () => inheritedSidecarSource({ files: mainApi, projectService }),
    [mainApi, projectService]
  );
  const [merged, setMerged] = useState<{ from: ProgramAnnotations; to: ProgramAnnotations }>();

  useEffect(() => {
    if (!inherits || !annotations || bank === undefined || !bytes) return undefined;
    let cancelled = false;
    void withInheritedEntries(annotations, (page) => (page === bank ? bytes : undefined), source).then(
      (result) => {
        if (!cancelled) setMerged({ from: annotations, to: result.annotations });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [annotations, bank, bytes, inherits, source]);

  if (!inherits) return annotations;
  // --- Until the merge of this very model is ready, the last merged one (or the own entries)
  return merged?.to ?? annotations;
}

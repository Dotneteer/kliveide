import { useEffect } from "react";

/*
 * Files dropped onto the emulator window (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.10, D10). The
 * window takes the drop (so Electron does not navigate to the file) and hands the first file's path
 * to the main process, which routes it by extension (`droppedFileAction`) and reports problems.
 */

/** What the hook needs: the dropped file's path, and the main process call */
export type EmuFileDropPorts = {
  getPathForFile: ((file: File) => string) | undefined;
  openDroppedFile: (path: string) => Promise<string | undefined>;
};

/**
 * Handles a drop event: the first file, if it has a path on disk. Exported for the tests.
 * @returns The path handed on, if any
 */
export async function handleEmuFileDrop(
  event: Pick<DragEvent, "preventDefault" | "dataTransfer">,
  ports: EmuFileDropPorts
): Promise<string | undefined> {
  event.preventDefault();
  const file = event.dataTransfer?.files?.[0];
  if (!file || !ports.getPathForFile) return undefined;
  const path = ports.getPathForFile(file);
  if (!path) return undefined;
  await ports.openDroppedFile(path);
  return path;
}

/** Wires the window's drag-and-drop to `handleEmuFileDrop` */
export function useEmuFileDrop(openDroppedFile: (path: string) => Promise<string | undefined>): void {
  useEffect(() => {
    const dragOver = (event: DragEvent) => {
      if (event.dataTransfer?.types?.includes("Files")) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      void handleEmuFileDrop(event, {
        // --- Typed here: the node type-check project does not see the preload's `Window` typings
        getPathForFile: (window as unknown as { api?: { getPathForFile?: (file: File) => string } }).api
          ?.getPathForFile,
        openDroppedFile
      });
    };
    window.addEventListener("dragover", dragOver);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", dragOver);
      window.removeEventListener("drop", drop);
    };
  }, [openDroppedFile]);
}

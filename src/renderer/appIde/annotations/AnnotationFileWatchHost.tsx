import { useEffect } from "react";

import { useMainApi } from "@renderer/core/MainApi";

import { setAnnotationFileWatch } from "./annotationSession";

/**
 * Has the main process follow every annotation sidecar the IDE holds a session for, so a change
 * another program makes to one (an editor, a script, an assistant editing a ROM working copy) is
 * re-read and shown at once (`MainApi.watchAnnotationFile`, `IdeApi.annotationFileChanged`).
 *
 * Renders nothing.
 */
export function AnnotationFileWatchHost() {
  const mainApi = useMainApi();

  useEffect(() => {
    setAnnotationFileWatch({
      watch: (annotationPath) => {
        void mainApi.watchAnnotationFile(annotationPath).catch(() => false);
      },
      unwatch: (annotationPath) => {
        void mainApi.unwatchAnnotationFile(annotationPath).catch(() => undefined);
      }
    });
    return () => setAnnotationFileWatch(undefined);
  }, [mainApi]);

  return null;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@common/i18n/useT";
import { BUILD_FILE } from "@common/structs/project-const";
import { incBuildFileVersionAction } from "@common/state/actions";
import type { FloatSlot } from "@common/messaging/messages-core";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import type { EditorApi } from "@renderer/features/editor/monaco/MonacoEditor";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useDocumentHubServiceVersion } from "@renderer/appIde/services/DocumentServiceProvider";
import { useIdeStartup } from "@renderer/appIde/useIdeStartup";
import { useNavigationShortcuts } from "@renderer/features/navigation/useNavigationShortcuts";
import { IdeDialogBridge } from "@renderer/appIde/IdeDialogBridge";
import { buildProjectTree } from "@renderer/appIde/project/project-node";
import { restoreDocument } from "@renderer/appIde/restoreLastOpenDocuments";
import { DocumentAreaPane } from "@renderer/features/documents/DocumentAreaPane";
import {
  captureSavedDocument,
  saveDocumentBeforeTransfer
} from "@renderer/features/documents/floatingDocumentTransfer";
import { documentDisplayName } from "@renderer/features/documents/specialDocuments";
import { FloatHeader } from "./FloatHeader";
import { FloatCommandBar } from "./FloatCommandBar";
import { setSatelliteController } from "./satelliteController";
import styles from "./FloatApp.module.scss";

/**
 * How long the document's position and view state settle before main records them for the workspace
 */
const DOCUMENT_UPDATE_SETTLE_MS = 1000;

type Props = {
  slot: FloatSlot;
};

type LoadState = "loading" | "ready" | "unavailable";

/**
 * A floating document window (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.1): the IDE's own
 * services in satellite mode with one document hub, the document rendered through the same
 * `documentPanelRegistry` path as in the IDE, and Klive's header instead of a window frame. No activity
 * bar, side bar, tool area or status bar.
 */
const FloatApp = ({ slot }: Props) => {
  const t = useT();
  const dispatch = useDispatch();
  const appServices = useAppServices();
  const { projectService } = appServices;
  const mainApi = useMainApi();
  const { store, messenger } = useRendererContext();

  const entry = useSelector((s) => s.floatingDocuments?.[slot]);
  const folderPath = useSelector((s) => s.project?.folderPath);
  const explorerViewVersion = useSelector((s) => s.ideView?.explorerViewVersion);
  const excludedItems = useSelector((s) => s.project?.excludedItems);
  const isWindows = useSelector((s) => s.isWindows ?? false);
  const isProjectDebugging = useSelector((s) => s.emulatorState?.isProjectDebugging ?? false);
  // --- Re-render on the changes that move the header's marks
  useSelector((s) => s.project?.projectViewStateVersion);
  useSelector((s) => s.ideView?.editorVersion);

  // --- The window's one document hub, from the satellite's own ID range
  const hubRef = useRef<IDocumentHubService>();
  if (!hubRef.current) {
    hubRef.current = projectService.getActiveDocumentHubService() ?? projectService.createDocumentHubService();
  }
  const hub = hubRef.current;
  const hubVersion = useDocumentHubServiceVersion(hub);

  const [treeVersion, setTreeVersion] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [busy, setBusy] = useState(false);
  const openedRef = useRef(false);
  const leavingRef = useRef(false);

  // --- Go Back / Go Forward from the keyboard and the mouse's side buttons, through the IDE's history
  useNavigationShortcuts();

  useIdeStartup({
    appPath: "",
    appServices,
    dispatch,
    ideLoaded: false,
    isWindows,
    messenger,
    store,
    role: "satellite"
  });

  // --- The project tree: the satellite reads it from main, as the Explorer does, and follows the
  // --- Explorer's refreshes (plan §3.5)
  useEffect(() => {
    if (!folderPath) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const contents = await mainApi.getDirectoryContent(folderPath);
        if (cancelled) return;
        projectService.setProjectTree(buildProjectTree(contents, store));
        setTreeVersion((v) => v + 1);
      } catch (err) {
        console.error("Cannot read the project tree of the floating window:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [excludedItems, explorerViewVersion, folderPath, mainApi, projectService, store]);

  // --- Open the document once the tree is there (plan §3.4 step 2), through the workspace restore's
  // --- own code path so the position and view state come back the same way
  useEffect(() => {
    if (openedRef.current || !entry?.document || !folderPath || treeVersion === 0) return;
    openedRef.current = true;
    (async () => {
      const restored = restoreDocument(
        entry.document,
        folderPath,
        projectService,
        store.getState().workspaceSettings
      );
      if (!restored) {
        setLoadState("unavailable");
        return;
      }
      try {
        await hub.openDocument(restored.document, restored.viewState, false);
        setLoadState("ready");
      } catch (err) {
        console.error(`Cannot open ${entry.document.id} in the floating window:`, err);
        setLoadState("unavailable");
      }
    })();
  }, [entry, folderPath, hub, projectService, store, treeVersion]);

  const activeDocument: ProjectDocumentState | undefined = hub.getActiveDocument();

  // --- The window's title follows the document
  useEffect(() => {
    if (activeDocument) {
      window.document.title = documentDisplayName(activeDocument);
    }
  }, [activeDocument, hubVersion]);

  // --- Main records the document's position and view state, so the workspace saves what the window
  // --- shows (plan Q3)
  useEffect(() => {
    if (loadState !== "ready" || !activeDocument) return undefined;
    const timer = setTimeout(() => {
      if (leavingRef.current) return;
      void mainApi
        .updateFloatingDocument(slot, captureSavedDocument(hub, activeDocument))
        .catch(() => {});
    }, DOCUMENT_UPDATE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [activeDocument, hub, hubVersion, loadState, mainApi, slot]);

  // --- A document closed by any other path (`hide-memory`, a deleted file) takes its window along
  useEffect(() => {
    if (loadState !== "ready" || leavingRef.current) return;
    if (hub.getOpenDocuments().length === 0) {
      leavingRef.current = true;
      void mainApi.closeFloatingDocument(slot);
    }
  }, [hub, hubVersion, loadState, mainApi, slot]);

  // --- The build file saved here refreshes the IDE's build menu, as the IDE's own save does
  useEffect(() => {
    const onFileSaved = ({ file }: { file: string }) => {
      const project = store.getState().project;
      if (project?.isKliveProject && project.hasBuildFile && file === `${project.folderPath}/${BUILD_FILE}`) {
        store.dispatch(incBuildFileVersionAction(), "ide");
      }
    };
    projectService.fileSaved.on(onFileSaved);
    return () => projectService.fileSaved.off(onFileSaved);
  }, [projectService, store]);

  // --- Close: the tab's close path, with its prompts; then main destroys the window (plan §3.4)
  const closeWindow = useCallback(async (): Promise<boolean> => {
    if (leavingRef.current) return true;
    setBusy(true);
    try {
      await projectService.performAllDelayedSavesNow();
      const document = hub.getActiveDocument();
      if (document) {
        await hub.closeDocument(document.id);
        if (hub.isOpen(document.id)) return false;
      }
      leavingRef.current = true;
      await mainApi.closeFloatingDocument(slot);
      return true;
    } finally {
      setBusy(false);
    }
  }, [hub, mainApi, projectService, slot]);

  // --- Dock: the document goes back to the IDE with its current view state (plan §3.4 step 3)
  const dockWindow = useCallback(async () => {
    const document = hub.getActiveDocument();
    if (!document || leavingRef.current) return;
    setBusy(true);
    try {
      if (!(await saveDocumentBeforeTransfer(hub, document.id, projectService))) return;
      leavingRef.current = true;
      const docked = await mainApi.dockFloatingDocument(slot, captureSavedDocument(hub, document));
      if (!docked) leavingRef.current = false;
    } catch (err) {
      leavingRef.current = false;
      console.error("Cannot dock the document:", err);
    } finally {
      setBusy(false);
    }
  }, [hub, mainApi, projectService, slot]);

  // --- What main asks of this window (plan §3.3, the `float` class)
  useEffect(() => {
    setSatelliteController({
      reveal: async ({ documentId, line, column }) => {
        if (!hub.isOpen(documentId)) return;
        await hub.setActiveDocument(documentId);
        if (line === undefined) return;
        await hub.waitOpen(documentId, true);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const api = hub.getDocumentApi(documentId) as EditorApi | undefined;
        if (typeof api?.setPosition === "function") {
          api.setPosition(line, Math.max((column ?? 0) - 1, 0));
        }
      },
      renamed: async (oldId, newId) => {
        try {
          projectService.renameDocument(oldId, newId);
        } catch {
          // --- The tree was already re-read with the new name: the hub still follows below
        }
        hub.renameDocument(oldId, newId);
        const document = hub.getDocument(newId);
        if (document) document.path = newId;
      },
      requestClose: () => closeWindow()
    });
    return () => setSatelliteController(undefined);
  }, [closeWindow, hub, projectService]);

  const hasChanges =
    !!activeDocument && activeDocument.editVersionCount !== activeDocument.savedVersionCount;
  const isLocked =
    !!activeDocument && isProjectDebugging && projectService.getLockedFiles().includes(activeDocument.id);

  return (
    <FullPanel id="appFloat" dataAppReady={loadState === "ready" ? "true" : "false"}>
      <IdeDialogBridge />
      <FloatHeader
        document={activeDocument}
        hasChanges={hasChanges}
        isLocked={isLocked}
        busy={busy}
        commandBar={loadState === "ready" ? <FloatCommandBar hub={hub} /> : undefined}
        onDock={() => void dockWindow()}
        onClose={() => void closeWindow()}
      />
      {loadState === "ready" ? (
        <DocumentAreaPane hub={hub} showHeader={false} />
      ) : (
        <div className={styles.message}>
          {loadState === "loading" ? t("documents.float.loading") : t("documents.float.notAvailable")}
        </div>
      )}
    </FullPanel>
  );
};

export default FloatApp;

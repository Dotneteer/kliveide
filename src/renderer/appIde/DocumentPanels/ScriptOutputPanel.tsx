import styles from "./ScriptOutputPanel.module.scss";
import { useRef, useState, useEffect } from "react";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { Text } from "@renderer/controls/layout/Text";
import {
  useDispatch,
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { isScriptCompleted } from "@common/utils/script-utils";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@common/state/actions";
import { ConsoleOutput } from "./helpers/ConsoleOutput";
import { createSettingsReader } from "@common/utils/SettingsReader";
import { DataPanel, PanelHeader } from "@renderer/controls/data";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

type ScriptOutputPanelViewState = {
  topPosition?: number;
  locked?: boolean;
};

const ScriptOutputPanel = ({ document, contents }: DocumentProps) => {
  // --- Get the services used in this component
  const t = useT();
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const { ideCommandsService, scriptService } = useAppServices();

  // --- Obtain script information
  const scriptId = typeof contents === "string" ? parseInt(contents, 10) : -1;
  const scriptsInfo = useSelector(s => s.scripts);

  // --- Line number settings
  const { store } = useRendererContext();
  const showLineNo = !!createSettingsReader(store.getState()).readBooleanSetting(
    "scriptOutput.showLineNo"
  );

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(
      document.id
    ) as ScriptOutputPanelViewState) ?? {}
  );
  const topPosition = useRef(viewState.current?.topPosition ?? 0);

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.

  const [scriptBuffer, setScriptBuffer] = useState<OutputPaneBuffer>();
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptFileName, setScriptFileName] = useState<string>();
  const [scriptError, setScriptError] = useState<string>();
  const [scriptStatus, setScriptStatus] = useState<string>();
  const [scrollLocked, setLocked] = useState(
    viewState.current?.locked ?? false
  );
  /*
   * A bare re-render trigger: the value is never read, only bumped, so that the "Lines:" readout
   * below re-evaluates when the buffer changes.
   */
  const [, setVersion] = useState(0);

  // --- Subscribe to script output changes
  useEffect(() => {
    const buffer = scriptService.getScriptOutputBuffer(scriptId);
    if (!buffer) return;

    setScriptBuffer(buffer);
  }, [scriptId]);

  // --- Check if script is running
  useEffect(() => {
    const thisScript = scriptsInfo.find(s => s.id === scriptId);
    if (!thisScript) return;
    setScriptRunning(!isScriptCompleted(thisScript?.status));
    setScriptFileName(thisScript?.scriptFileName);
    setScriptError(thisScript?.error);
    setScriptStatus(thisScript?.status);
  }, [scriptsInfo]);

  // --- Save the view state whenever the lock state changes
  useEffect(() => {
    saveViewState();
  }, [scrollLocked]);

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: ScriptOutputPanelViewState = {
      topPosition: topPosition.current,
      locked: scrollLocked
    };
    documentHubService.setDocumentViewState(document.id, mergedState);
  };

  /*
   * Scrolling fires continuously, and every event wrote the whole view state through to the
   * document hub. Only the last position in a gesture matters, so coalesce them; the ref the save
   * reads is already up to date, so a trailing call writes the right value.
   */
  const saveHandle = useRef<ReturnType<typeof setTimeout>>();
  const saveViewStateSoon = () => {
    clearTimeout(saveHandle.current);
    saveHandle.current = setTimeout(saveViewState, 250);
  };
  useEffect(() => () => clearTimeout(saveHandle.current), []);

  let variant = "";
  let conclusion: MessageKey = "panels.doc.scriptOutput.statusRunning";
  if (scriptError) {
    variant = "error";
    conclusion = "panels.doc.scriptOutput.statusError";
  } else if (!scriptRunning) {
    if (scriptStatus === "stopped") {
      variant = "warning";
      conclusion = "panels.doc.scriptOutput.statusStopped";
    } else if (scriptStatus === "execError") {
      variant = "error";
      conclusion = "panels.doc.scriptOutput.statusError";
    } else {
      variant = "success";
      conclusion = "panels.doc.scriptOutput.statusCompleted";
    }
  }

  return (
    <DataPanel xclass={styles.panel}>
      <PanelHeader>
        <SmallIconButton
          iconName='stop'
          title={t("panels.doc.scriptOutput.stop")}
          enable={scriptRunning}
          clicked={async () => {
            await ideCommandsService.executeCommand(
              `script-cancel ${scriptId}`
            );
          }}
        />
        <SmallIconButton
          iconName='square-arrow-out-up-right'
          title={t("panels.doc.scriptOutput.openFile")}
          clicked={async () => {
            if (scriptFileName) {
              documentHubService.setPermanent(document.id);
              await ideCommandsService.executeCommand(
                `nav "${scriptFileName}"`
              );
            }
          }}
        />
        <ToolbarSeparator small={true} />
        <SmallIconButton
          iconName='clear-all'
          title={t("panels.doc.scriptOutput.clear")}
          clicked={() => {
            scriptBuffer?.clear();
          }}
        />
        <SmallIconButton
          iconName='copy'
          title={t("panels.doc.common.copyToClipboard")}
          clicked={() => {
            navigator.clipboard.writeText(scriptBuffer?.getBufferText());
            dispatch(
              setIdeStatusMessageAction(
                t("panels.doc.scriptOutput.copied"),
                true
              )
            );
            dispatch(incToolCommandSeqNoAction());
          }}
        />
        {/*
          * `scrollLocked` true means auto scrolling is OFF, so clicking turns it ON. The tooltip
          * said the opposite — "Turn auto scrolling off" at the moment the click would turn it on —
          * which is what a boolean you have to mentally negate eventually costs you. The state name
          * and its persisted `locked` key are left alone; renaming them would need a view-state
          * migration for no user-visible gain.
          */}
        <SmallIconButton
          iconName={scrollLocked ? "unlock" : "lock"}
          title={t(scrollLocked ? "panels.doc.scriptOutput.autoScrollOn" : "panels.doc.scriptOutput.autoScrollOff")}
          clicked={() => setLocked(!scrollLocked)}
        />
        <ToolbarSeparator small={true} />
        {/* --- `?? 0`: before the buffer resolves, this rendered the literal "Lines: undefined". */}
        <Text text={t("panels.doc.scriptOutput.lines", { count: scriptBuffer?.getContents()?.length ?? 0 })} />
        <ToolbarSeparator small={true} />
        <Text
          variant={variant}
          text={t(scriptRunning ? "panels.doc.scriptOutput.statusRunning" : conclusion)}
        />
      </PanelHeader>
      <ConsoleOutput
        buffer={scriptBuffer}
        initialTopPosition={topPosition.current}
        followTail={!scrollLocked}
        showLineNo={showLineNo}
        onTopPositionChanged={(position: number) => {
          topPosition.current = position;
          saveViewStateSoon();
        }}
        /*
         * `v => v + 1`, not `version + 1`.
         *
         * The counter exists only to re-render the "Lines:" readout below, and it captured a stale
         * `version` from the render that installed it. That was survivable while this fired once
         * per *span* written — something always re-rendered soon enough to paper over it — which is
         * the same firing rate that made a large script output crawl. Now that `contentsChanged` is
         * coalesced to roughly one notification per frame, this is a cheap, correct counter rather
         * than a re-render pump.
         */
        onContentsChanged={() => setVersion((v) => v + 1)}
      />
    </DataPanel>
  );
};

export const createScriptOutputPanel = ({
  document,
  contents
}: DocumentProps) => (
  <ScriptOutputPanel
    document={document}
    contents={contents}
    apiLoaded={() => {}}
  />
);

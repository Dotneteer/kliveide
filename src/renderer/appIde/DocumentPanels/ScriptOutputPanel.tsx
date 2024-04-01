import styles from "./ScriptOutputPanel.module.scss";
import { useRef, useState, useEffect } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { useAppServices } from "../services/AppServicesProvider";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { Text } from "@renderer/controls/generic/Text";
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

type ScriptOutputPanelViewState = {
  topPosition?: number;
  locked?: boolean;
};

const ScriptOutputPanel = ({ document, contents }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const { ideCommandsService, scriptService } = useAppServices();

  // --- Obtain script information
  const scriptId = typeof contents === "string" ? parseInt(contents, 10) : -1;
  const scriptsInfo = useSelector(s => s.scripts);

  // --- Line number settings
  const { store } = useRendererContext();
  const showLineNo = !!createSettingsReader(store).readBooleanSetting(
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
  const [version, setVersion] = useState(1);

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
    documentHubService.saveActiveDocumentState(mergedState);
  };

  let variant = "";
  let conclusion = "";
  if (scriptError) {
    variant = "error";
    conclusion = "Error";
  } else if (!scriptRunning) {
    if (scriptStatus === "stopped") {
      variant = "warning";
      conclusion = "Stopped";
    } else if (scriptStatus === "execError") {
      variant = "error";
      conclusion = "Error";
    } else {
      variant = "success";
      conclusion = "Completed";
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <SmallIconButton
          iconName='stop'
          title='Stop this script file'
          enable={scriptRunning}
          clicked={async () => {
            await ideCommandsService.executeCommand(
              `script-cancel ${scriptId}`
            );
          }}
        />
        <SmallIconButton
          iconName='pop-out'
          title='Open script file'
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
          title='Clear script output'
          clicked={() => {
            scriptBuffer?.clear();
          }}
        />
        <SmallIconButton
          iconName='copy'
          title='Copy to clipboard'
          clicked={() => {
            navigator.clipboard.writeText(scriptBuffer?.getBufferText());
            dispatch(
              setIdeStatusMessageAction(
                "Script output copied to the clipboard",
                true
              )
            );
            dispatch(incToolCommandSeqNoAction());
          }}
        />
        <SmallIconButton
          iconName={scrollLocked ? "unlock" : "lock"}
          title={`Turn auto scrolling ${scrollLocked ? "off" : "on"}`}
          clicked={() => setLocked(!scrollLocked)}
        />
        <ToolbarSeparator small={true} />
        <Text text={`Lines: ${scriptBuffer?.getContents()?.length}`} />
        <ToolbarSeparator small={true} />
        <Text
          variant={variant}
          text={`${scriptRunning ? "(Running)" : `(${conclusion})`}`}
        />
      </div>
      <ConsoleOutput
        buffer={scriptBuffer}
        initialTopPosition={topPosition.current}
        scrollLocked={scrollLocked}
        showLineNo={showLineNo}
        onTopPositionChanged={(position: number) => {
          topPosition.current = position;
          saveViewState();
        }}
        onContentsChanged={() => setVersion(version + 1)}
      />
    </div>
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

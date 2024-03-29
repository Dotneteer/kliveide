import styles from "./ScriptOutputPanel.module.scss";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { useRef, useState, useEffect } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { OutputLine } from "../ToolArea/OutputPanel";
import { useAppServices } from "../services/AppServicesProvider";
import { OutputContentLine } from "../ToolArea/abstractions";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { Text } from "@renderer/controls/generic/Text";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import { isScriptCompleted } from "@common/utils/script-utils";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@common/state/actions";
import { ScriptRunInfo } from "@abstractions/ScriptRunInfo";

const SCROLL_DELAY = 500;

type ScriptOutputPanelViewState = {
  topIndex?: number;
  locked?: boolean;
};

const ScriptOutputPanel = ({ document, contents }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();
  const { ideCommandsService, scriptService } = useAppServices();
  const scriptId = typeof contents === "string" ? parseInt(contents, 10) : -1;
  const mounted = useRef(false);

  const scriptsInfo = useSelector(s => s.scripts);

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(
      document.id
    ) as ScriptOutputPanelViewState) ?? {}
  );
  const topIndex = useRef(viewState.current?.topIndex ?? 0);

  // --- Use these options to set memory options. As memory view is async, we sometimes
  // --- need to use state changes not yet committed by React.

  const vlApi = useRef<VirtualizedListApi>(null);
  const [scriptOutput, setScriptOutput] = useState<OutputContentLine[]>([]);
  const [scrollVersion, setScrollVersion] = useState(0);
  const [scriptBuffer, setScriptBuffer] = useState<OutputPaneBuffer>();
  const [scriptRunning, setScriptRunning] = useState(false);
  const [scriptFileName, setScriptFileName] = useState<string>();
  const [scriptError, setScriptError] = useState<string>();
  const [scrollLocked, setLocked] = useState(
    viewState.current?.locked ?? false
  );

  const lastRefreshTimestamp = useRef(0);

  const refreshScriptOutput = () => {
    if (!scriptBuffer) return;
    setScriptOutput(scriptBuffer.getContents().slice());
    if (scrollLocked) return;

    const now = Date.now();
    if (now - lastRefreshTimestamp.current > SCROLL_DELAY) {
      lastRefreshTimestamp.current = now;
      vlApi.current?.scrollToEnd();
    } else {
      (async () => {
        // --- Delay 500ms
        await new Promise(resolve => setTimeout(resolve, SCROLL_DELAY));
        if (mounted.current) {
          vlApi.current?.scrollToEnd();
        }
      })();
    }
  };

  // --- Check if script is running
  useEffect(() => {
    const thisScript = scriptsInfo.find(s => s.id === scriptId);
    if (!thisScript) return;
    setScriptRunning(!isScriptCompleted(thisScript?.status));
    setScriptFileName(thisScript?.scriptFileName);
    setScriptError(thisScript?.error);
  }, [scriptsInfo]);

  // --- Subscribe to script output changes
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const buffer = scriptService.getScriptOutputBuffer(scriptId);
      buffer?.contentsChanged.on(refreshScriptOutput);
      setScriptBuffer(buffer);
    }
    return () => {
      if (mounted.current) {
        scriptBuffer?.contentsChanged.off(refreshScriptOutput);
        mounted.current = false;
      }
    };
  });

  // --- Initialize the script output
  useEffect(() => {
    refreshScriptOutput();
    setScrollVersion(scrollVersion + 1);
  }, [scriptBuffer]);

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    vlApi.current?.scrollToIndex(topIndex.current, {
      align: "start"
    });
  }, [scrollVersion]);

  // --- Save the view state whenever the lock state changes
  useEffect(() => {
    saveViewState();
  }, [scrollLocked]);

  // --- Save the current top addresds
  const storeTopAddress = () => {
    const range = vlApi.current.getRange();
    topIndex.current = range.startIndex;
  };

  // --- Save the new view state whenever the view is scrolled
  const scrolled = () => {
    if (!vlApi.current) return;

    storeTopAddress();
    saveViewState();
  };

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: ScriptOutputPanelViewState = {
      topIndex: topIndex.current,
      locked: scrollLocked
    };
    documentHubService.saveActiveDocumentState(mergedState);
  };

  return (
    mounted.current && (
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
          <Text
            variant={scriptError ? "error" : undefined}
            text={`Lines: ${scriptOutput?.length} ${
              scriptRunning
                ? "(Running)"
                : scriptError
                ? `, Error: ${scriptError}`
                : "(Completed)"
            }`}
          />
        </div>

        <div className={styles.listWrapper}>
          {scriptOutput && scriptOutput.length > 0 && (
            <VirtualizedListView
              items={scriptOutput ?? []}
              approxSize={24}
              fixItemHeight={false}
              scrolled={scrolled}
              vlApiLoaded={api => (vlApi.current = api)}
              itemRenderer={idx => {
                return <OutputLine spans={scriptOutput?.[idx]?.spans} />;
              }}
            />
          )}
        </div>
      </div>
    )
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

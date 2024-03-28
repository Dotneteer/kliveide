import styles from "./ScriptOutputPanel.module.scss";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { useRef, useState, useEffect } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { OutputLine } from "../ToolArea/OutputPanel";
import { useAppServices } from "../services/AppServicesProvider";
import { OutputContentLine } from "../ToolArea/abstractions";

const SCROLL_DELAY = 500;

type ScriptOutputPanelViewState = {
  topIndex?: number;
};

const ScriptOutputPanel = ({ document, contents }: DocumentProps) => {
  // --- Get the services used in this component
  const documentHubService = useDocumentHubService();
  const { scriptService } = useAppServices();
  const scriptId = typeof contents === "string" ? parseInt(contents, 10) : -1;
  const mounted = useRef(false);

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
  const lastRefreshTimestamp = useRef(0);

  const refreshScriptOutput = () => {
    if (!scriptBuffer) return;
    setScriptOutput(scriptBuffer.getContents().slice());
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

  useEffect(() => {
    refreshScriptOutput();
    setScrollVersion(scrollVersion + 1);
  }, [scriptBuffer]);

  // --- Initial view: refresh the disassembly lint and scroll to the last saved top position
  useInitializeAsync(async () => {
    setScrollVersion(scrollVersion + 1);
  });

  // --- Scroll to the desired position whenever the scroll index changes
  useEffect(() => {
    vlApi.current?.scrollToIndex(topIndex.current, {
      align: "start"
    });
  }, [scrollVersion]);

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
      topIndex: topIndex.current
    };
    documentHubService.saveActiveDocumentState(mergedState);
  };

  return (
    mounted.current && (
      <div className={styles.panel}>
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

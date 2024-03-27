import styles from "./ScriptOutputPanel.module.scss";
import { VirtualizedListApi } from "@controls/VirtualizedList";
import { useDispatch } from "@renderer/core/RendererProvider";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";
import { useRef, useState, useEffect } from "react";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { OutputPaneBuffer } from "../ToolArea/OutputPaneBuffer";
import { VirtualizedListView } from "@renderer/controls/VirtualizedListView";
import { OutputLine } from "../ToolArea/OutputPanel";

type ScriptOutputPanelViewState = {
  topIndex?: number;
};

const buffer = new OutputPaneBuffer();

for (let i = 0; i < 20; i++) {
  buffer.color("blue");
  buffer.writeLine(`Line ${i} in blue`);
  buffer.color("red");
  buffer.writeLine(`Line ${i} in red`);
  buffer.color("green");
  buffer.writeLine(`Line ${i} in green`);
}

const ScriptOutputPanel = ({ document }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();

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
  const [scriptOutput, setScriptOutput] = useState(buffer.getContents());
  const [scrollVersion, setScrollVersion] = useState(0);

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
    <div className={styles.panel}>
      <div className={styles.listWrapper}>
        <VirtualizedListView
          items={scriptOutput ?? []}
          approxSize={24}
          fixItemHeight={false}
          vlApiLoaded={api => (vlApi.current = api)}
          itemRenderer={idx => {
            return <OutputLine spans={scriptOutput?.[idx]?.spans} />;
          }}
        />
      </div>
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

import styles from "./CommandResult.module.scss";
import { SmallIconButton } from "@controls/IconButton";
import { LabelSeparator, Label } from "@controls/Labels";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { useDispatch } from "@renderer/core/RendererProvider";
import { setIdeStatusMessageAction } from "@state/actions";
import { useRef } from "react";
import { CommandResultData } from "../../abstractions/CommandResultData";
import { DocumentProps } from "../DocumentArea/DocumentsContainer";
import { useDocumentHubService } from "../services/DocumentServiceProvider";
import { ConsoleOutput } from "./helpers/ConsoleOutput";

type CommandResultViewState = {
  topPosition?: number;
};

const CommandResultPanel = ({ document, contents }: DocumentProps) => {
  // --- Get the services used in this component
  const dispatch = useDispatch();
  const documentHubService = useDocumentHubService();

  // --- Read the view state of the document
  const viewState = useRef(
    (documentHubService.getDocumentViewState(
      document.id
    ) as CommandResultViewState) ?? {}
  );
  const topPosition = useRef(viewState.current?.topPosition ?? 0);
  const title = (contents as CommandResultData)?.title;
  const buffer = (contents as CommandResultData)?.buffer;

  // --- Save the current view state
  const saveViewState = () => {
    const mergedState: CommandResultViewState = {
      topPosition: topPosition.current
    };
    documentHubService.saveActiveDocumentState(mergedState);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <SmallIconButton
          iconName='copy'
          title={"Copy to clipboard"}
          clicked={async () => {
            navigator.clipboard.writeText(buffer.getBufferText());
            dispatch(
              setIdeStatusMessageAction(
                "Command output text copied to the clipboard",
                true
              )
            );
          }}
        />
        <ToolbarSeparator small={true} />
        <LabelSeparator width={8} />
        <Label text={title} />
      </div>
      <ConsoleOutput
        buffer={buffer}
        initialTopPosition={topPosition.current}
        scrollLocked={true}
        showLineNo={false}
        onTopPositionChanged={(position: number) => {
          topPosition.current = position;
          saveViewState();
        }}
      />
    </div>
  );
};

export const createCommandResultPanel = ({ document, contents, viewState }: DocumentProps) => (
  <CommandResultPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

import styles from "./CommandResult.module.scss";
import { Label } from "@renderer/controls/layout/Label";
import { SmallIconButton } from "@controls/IconButton";
import { ToolbarSeparator } from "@controls/ToolbarSeparator";
import { useDispatch } from "@renderer/core/RendererProvider";
import { setIdeStatusMessageAction } from "@state/actions";
import { useRef } from "react";
import { CommandResultData } from "../../abstractions/CommandResultData";
import { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { ConsoleOutput } from "./helpers/ConsoleOutput";
import { DataPanel, EmptyState, PanelHeader } from "@renderer/controls/data";

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
    documentHubService.setDocumentViewState(document.id, mergedState);
  };

  /*
   * A command result with no buffer.
   *
   * `buffer` was read with `?.` and then called without one four lines later, so a document opened
   * with no buffer threw rather than saying anything. It cannot normally happen — the command that
   * opens this document supplies one — but the optional chain above says the author expected it to
   * be possible, and a thrown render is the worst way to be right about that.
   */
  if (!buffer) {
    return (
      <DataPanel xclass={styles.panel}>
        <PanelHeader>{title && <Label text={title} />}</PanelHeader>
        <EmptyState tone="error" motif={false} message="This command produced no output buffer." />
      </DataPanel>
    );
  }

  return (
    <DataPanel xclass={styles.panel}>
      <PanelHeader>
        <SmallIconButton
          iconName='copy'
          title={"Copy to clipboard"}
          clicked={async () => {
            // --- No `replaceAll("\xa0", " ")` any more: the buffer stores real spaces, so this
            // --- panel no longer has to undo a substitution the other two copy buttons never did.
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
        <Label text={title} />
      </PanelHeader>
      <ConsoleOutput
        buffer={buffer}
        initialTopPosition={topPosition.current}
        onTopPositionChanged={(position: number) => {
          topPosition.current = position;
          saveViewState();
        }}
      />
    </DataPanel>
  );
};

export const createCommandResultPanel = ({ document, contents, viewState }: DocumentProps) => (
  <CommandResultPanel document={document} contents={contents} viewState={viewState} apiLoaded={() => {}} />
);

import { TabButton, TabButtonSeparator, TabButtonSpace } from "@controls/TabButton";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { FileTypeEditor } from "@renderer/abstractions/FileTypePattern";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import styles from "./DocumentsHeader.module.scss";

type DocumentCommandBarProps = {
  activeFullPath?: string;
  editorInfo?: FileTypeEditor;
  selectedIsBuildRoot: boolean;
  onCloseAll: () => void;
};

export function DocumentCommandBar({
  activeFullPath,
  editorInfo,
  selectedIsBuildRoot,
  onCloseAll
}: DocumentCommandBarProps) {
  return (
    <div className={styles.commandBar}>
      {editorInfo && editorInfo.documentTabRenderer?.(activeFullPath)}
      {selectedIsBuildRoot && <BuildRootCommandBar />}
      <TabButtonSeparator />
      <TabButton
        iconName="close"
        title="Close all tabs"
        useSpace={true}
        clicked={onCloseAll}
      />
    </div>
  );
}

function BuildRootCommandBar() {
  const { outputPaneService, ideCommandsService } = useAppServices();
  const compiling = useSelector((s) => s.compilation?.inProgress ?? false);
  const [startedHere, setStartedHere] = useState(false);
  const [scriptId, setScriptId] = useState<number>();

  useEffect(() => {
    if (startedHere && !compiling) {
      setStartedHere(false);
    }
  }, [compiling, startedHere]);

  const runBuildFunction = async (functionName: string) => {
    const buildPane = outputPaneService.getOutputPaneBuffer(PANE_ID_BUILD);
    const result = await ideCommandsService.executeCommand(
      `run-build-function ${functionName}`,
      buildPane
    );
    setScriptId(result?.value);
    await ideCommandsService.executeCommand(`outp ${PANE_ID_BUILD}`);
  };

  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="combine"
        title="Compile code"
        disabled={compiling}
        clicked={async () => await runBuildFunction("buildCode")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="inject"
        title={"Inject code into\nthe virtual machine"}
        disabled={compiling}
        clicked={async () => await runBuildFunction("injectCode")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="play"
        title={"Inject code and start\nthe virtual machine"}
        disabled={compiling}
        clicked={async () => await runBuildFunction("runCode")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={"Inject code and start\ndebugging"}
        disabled={compiling}
        clicked={async () => await runBuildFunction("debugCode")}
      />
      <TabButtonSeparator />
      <TabButton
        iconName="pop-out"
        title={"Show script output"}
        disabled={compiling || !scriptId}
        clicked={async () => {
          if (scriptId > 0) {
            await ideCommandsService.executeCommand(`script-output ${scriptId}`);
          }
        }}
      />
    </>
  );
}

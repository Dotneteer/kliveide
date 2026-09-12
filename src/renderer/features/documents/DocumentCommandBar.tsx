import { TabButton, TabButtonSeparator, TabButtonSpace } from "@controls/TabButton";
import { PANE_ID_BUILD } from "@common/integration/constants";
import { FileTypeEditor } from "@renderer/abstractions/FileTypePattern";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { machineRegistry } from "@common/machines/machine-registry";
import { MF_INJECT_SUPPORT } from "@common/machines/constants";
import styles from "./DocumentsHeader.module.scss";

type DocumentCommandBarProps = {
  activeFullPath?: string;
  editorInfo?: FileTypeEditor;
  selectedIsBuildRoot: boolean;
};

/**
 * Renders active-editor and build-root commands beside the document tabs.
 */
export function DocumentCommandBar({
  activeFullPath,
  editorInfo,
  selectedIsBuildRoot
}: DocumentCommandBarProps) {
  if (!editorInfo && !selectedIsBuildRoot) return null;

  return (
    <div className={styles.commandBar}>
      {editorInfo && editorInfo.documentTabRenderer?.(activeFullPath)}
      {selectedIsBuildRoot && <BuildRootCommandBar />}
    </div>
  );
}

/**
 * Exposes build-root commands for the active document while compilation state
 * controls availability and the latest script output target.
 */
function BuildRootCommandBar() {
  const { outputPaneService, ideCommandsService } = useAppServices();
  const compiling = useSelector((s) => s.compilation?.inProgress ?? false);

  /*
   * Not every machine can take code injected into its memory — a ZX Spectrum Next build is a `.nex`
   * file the machine loads for itself. Run and debug still work there, by that route, so only the
   * plain Inject button goes; `?? true` keeps the button for any machine that has not declared
   * either way.
   */
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const supportsInject =
    machineRegistry.find((mi) => mi.machineId === machineId)?.features?.[MF_INJECT_SUPPORT] ?? true;
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
      {supportsInject && (
        <>
          <TabButtonSpace />
          <TabButton
            iconName="inject"
            title={"Inject code into\nthe virtual machine"}
            disabled={compiling}
            clicked={async () => await runBuildFunction("injectCode")}
          />
        </>
      )}
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

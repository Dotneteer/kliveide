import { useDispatch, useSelector, useStore } from "@renderer/core/RendererProvider";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import {
  activateOutputPaneAction,
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { useEffect, useRef, useState } from "react";
import { TabButton, TabButtonSpace } from "@controls/TabButton";
import { IOutputBuffer } from "./abstractions";
import styles from "./OutputPanel.module.scss";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { ConsoleOutput } from "../DocumentPanels/helpers/ConsoleOutput";
import Dropdown from "@renderer/controls/Dropdown";
import { HStack } from "@renderer/controls/new/Panels";

const OutputPanel = () => {
  const { outputPaneService } = useAppServices();
  const store = useStore();
  const tool = useRef<ToolInfo>();
  const activePane = useSelector((s) => s.ideView?.activeOutputPane);
  const [buffer, setBuffer] = useState<IOutputBuffer>();

  useEffect(() => {
    tool.current = store.getState().ideView?.tools.find((t) => t.id === "output") as ToolInfo;
    setBuffer(outputPaneService.getOutputPaneBuffer(activePane));
  }, [activePane]);

  return (
    <div className={styles.outputPanel}>
      {activePane && <ConsoleOutput buffer={buffer} scrollLocked={false} showLineNo={false} />}
    </div>
  );
};

export const outputPanelRenderer = () => <OutputPanel />;

export const outputPanelHeaderRenderer = () => {
  const dispatch = useDispatch();
  const { outputPaneService } = useAppServices();
  const panes = outputPaneService.getRegisteredOutputPanes().map((p) => ({
    value: p.id,
    label: p.displayName
  }));
  const activePane = useSelector((s) => s.ideView?.activeOutputPane);
  return (
    <>
      <Dropdown
        placeholder="Select..."
        options={panes}
        initialValue={activePane}
        width={140}
        onChanged={(option) => {
          dispatch(activateOutputPaneAction(option));
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="clear-all"
        title="Clear"
        clicked={() => {
          outputPaneService.getOutputPaneBuffer(activePane)?.clear();
          dispatch(incToolCommandSeqNoAction());
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="copy"
        title="Copy to clipboard"
        clicked={async () => {
          navigator.clipboard.writeText(
            outputPaneService.getOutputPaneBuffer(activePane).getBufferText()
          );
          dispatch(setIdeStatusMessageAction("Output copied to the clipboard", true));
          dispatch(incToolCommandSeqNoAction());
        }}
      />
    </>
  );
};

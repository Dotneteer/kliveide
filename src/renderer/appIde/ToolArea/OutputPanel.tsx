import {
  useDispatch,
  useGlobalSetting,
  useStore
} from "@renderer/core/RendererProvider";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { TabButton, TabButtonSpace } from "@controls/TabButton";
import { IOutputBuffer } from "./abstractions";
import styles from "./OutputPanel.module.scss";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { ConsoleOutput } from "../DocumentPanels/helpers/ConsoleOutput";
import Dropdown from "@renderer/controls/Dropdown";
import { SETTING_IDE_ACTIVE_OUTPUT_PANE } from "@common/settings/setting-const";
import { useMainApi } from "@renderer/core/MainApi";
import {
  PANE_ID_BUILD,
  PANE_ID_EMU,
  PANE_ID_SCRIPTIMG
} from "@common/integration/constants";

/**
 * What an empty pane says, per pane.
 *
 * Pane-specific on purpose: "nothing here yet" is true of all three and useful for none. What a
 * reader needs is the thing that would put something here, and that differs — the Emulator pane
 * fills itself, the other two want a command.
 */
const EMPTY_STATES: Record<string, { title: string; hint: ReactNode }> = {
  [PANE_ID_EMU]: {
    title: "No emulator output yet",
    hint: <>Messages from the running machine appear here as it starts, stops and loads media.</>
  },
  [PANE_ID_BUILD]: {
    title: "No build output yet",
    hint: (
      <>
        Run <code>compile</code>, or use the Build command. Output from the last build stays here
        until you clear it.
      </>
    )
  },
  [PANE_ID_SCRIPTIMG]: {
    title: "No script output yet",
    hint: (
      <>
        Run a script with <code>script-run &lt;file&gt;</code>. Anything it writes to the console
        arrives here.
      </>
    )
  }
};

export const OutputPanel = () => {
  const { outputPaneService } = useAppServices();
  const store = useStore();
  const tool = useRef<ToolInfo>();
  const activePane = useGlobalSetting(SETTING_IDE_ACTIVE_OUTPUT_PANE);
  const [buffer, setBuffer] = useState<IOutputBuffer>();
  // --- Drives the watermark only; `ConsoleOutput` decides for itself when to show `emptyState`.
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    tool.current = store.getState().ideView?.tools.find((t) => t.id === "output") as ToolInfo;
    const paneBuffer = outputPaneService.getOutputPaneBuffer(activePane);
    setBuffer(paneBuffer);
    setIsEmpty((paneBuffer?.getContents()?.length ?? 0) === 0);
  }, [activePane]);

  const paneName = outputPaneService
    .getRegisteredOutputPanes()
    .find((p) => p.id === activePane)?.displayName;
  const empty = EMPTY_STATES[activePane];

  return (
    <div className={styles.outputPanel}>
      {activePane && (
        <ConsoleOutput
          buffer={buffer}
          followTail
          /*
           * The line-number gutter has been supported by `ConsoleOutput` all along and switched on
           * by nothing. It earns its column here: build output is the one console whose lines get
           * referred to ("the error on line 12"), and it is long enough to want the scale.
           */
          showLineNo
          emptyState={
            empty && (
              <div className={styles.emptyState}>
                <div className={styles.emptyBox}>
                  <div className={styles.emptyTitle}>{empty.title}</div>
                  <div className={styles.emptyHint}>{empty.hint}</div>
                </div>
              </div>
            )
          }
          onContentsChanged={() =>
            setIsEmpty((buffer?.getContents()?.length ?? 0) === 0)
          }
        />
      )}
      {/* Suppressed while empty: the empty state already names the pane. */}
      {!isEmpty && paneName && <div className={styles.watermark}>{paneName}</div>}
    </div>
  );
};

export const OutputPanelHeader = () => {
  const dispatch = useDispatch();
  const mainApi = useMainApi();
  const { outputPaneService } = useAppServices();
  const panes = outputPaneService.getRegisteredOutputPanes().map((p) => ({
    value: p.id,
    label: p.displayName
  }));
  const activePane = useGlobalSetting(SETTING_IDE_ACTIVE_OUTPUT_PANE);
  return (
    <>
      <Dropdown
        placeholder="Select..."
        options={panes}
        initialValue={activePane}
        width={140}
        onChanged={async (option) => {
          await mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_OUTPUT_PANE, option);
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

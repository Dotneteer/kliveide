import {
  useDispatch,
  useGlobalSetting,
  useSelector,
  useStore
} from "@renderer/core/RendererProvider";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useT, type TFunction } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { TabButton, TabButtonSpace } from "@controls/TabButton";
import { IOutputBuffer } from "./abstractions";
import styles from "./OutputPanel.module.scss";
import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { ConsoleOutput } from "../DocumentPanels/helpers/ConsoleOutput";
import Dropdown from "@renderer/controls/Dropdown";
import { SETTING_IDE_ACTIVE_OUTPUT_PANE } from "@common/settings/setting-const";
import { useMainApi } from "@renderer/core/MainApi";
import {
  PANE_ID_AUTOMATION,
  PANE_ID_BUILD,
  PANE_ID_EMU,
  PANE_ID_LOG,
  PANE_ID_SCRIPTIMG
} from "@common/integration/constants";

/**
 * What an empty pane says, per pane.
 *
 * Pane-specific on purpose: "nothing here yet" is true of all three and useful for none. What a
 * reader needs is the thing that would put something here, and that differs — the Emulator pane
 * fills itself, the other two want a command.
 */
const EMPTY_STATES: Record<string, { titleKey: MessageKey; hintKey: MessageKey; code?: Record<string, string> }> = {
  [PANE_ID_EMU]: {
    titleKey: "panels.output.empty.emulator.title",
    hintKey: "panels.output.empty.emulator.hint"
  },
  [PANE_ID_BUILD]: {
    titleKey: "panels.output.empty.build.title",
    hintKey: "panels.output.empty.build.hint",
    code: { command: "compile" }
  },
  [PANE_ID_LOG]: {
    titleKey: "panels.output.empty.log.title",
    hintKey: "panels.output.empty.log.hint",
    code: { command: 'bp-set <address> -log "A={A}"', marker: "LOGPOINT" }
  },
  [PANE_ID_AUTOMATION]: {
    titleKey: "panels.output.empty.automation.title",
    hintKey: "panels.output.empty.automation.hint",
    code: { cli: "klive ide", command: "set -u automation.enabled 1" }
  },
  [PANE_ID_SCRIPTIMG]: {
    titleKey: "panels.output.empty.script.title",
    hintKey: "panels.output.empty.script.hint",
    code: { command: "script-run <file>" }
  }
};

// --- Marks a code placeholder in a translated hint, so the hint can be split around it
const CODE_MARK = "\u0001";

/** A translated hint whose `code` placeholders render as `<code>` */
function renderHint(t: TFunction, key: MessageKey, code: Record<string, string> = {}): ReactNode {
  const marks: Record<string, string> = {};
  for (const name of Object.keys(code)) marks[name] = `${CODE_MARK}${name}${CODE_MARK}`;
  const parts = t(key, marks).split(new RegExp(`${CODE_MARK}(\\w+)${CODE_MARK}`));
  return parts.map((part, i) =>
    i % 2 === 1 ? <code key={i}>{code[part]}</code> : <Fragment key={i}>{part}</Fragment>
  );
}

export const OutputPanel = () => {
  const t = useT();
  const { outputPaneService } = useAppServices();
  const store = useStore();
  const tool = useRef<ToolInfo>();
  const activePane = useGlobalSetting(SETTING_IDE_ACTIVE_OUTPUT_PANE);
  const [buffer, setBuffer] = useState<IOutputBuffer>();
  // --- Drives the watermark only; `ConsoleOutput` decides for itself when to show `emptyState`.
  const [isEmpty, setIsEmpty] = useState(true);

  // --- `commandSeqNo` is in the deps because the header's Clear button empties the buffer by a
  // --- path that never reaches `onContentsChanged`; see the note on that button.
  const commandSeqNo = useSelector((s) => s.ideView?.toolCommandSeqNo);

  useEffect(() => {
    tool.current = store.getState().ideView?.tools.find((t) => t.id === "output") as ToolInfo;
    const paneBuffer = outputPaneService.getOutputPaneBuffer(activePane);
    setBuffer(paneBuffer);
    setIsEmpty((paneBuffer?.getContents()?.length ?? 0) === 0);
  }, [activePane, commandSeqNo]);

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
                  <div className={styles.emptyTitle}>{t(empty.titleKey)}</div>
                  <div className={styles.emptyHint}>{renderHint(t, empty.hintKey, empty.code)}</div>
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
  const t = useT();
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
        placeholder={t("panels.output.selectPane")}
        options={panes}
        initialValue={activePane}
        // --- A control's width, not a tabular column: M2 governs columns, and px is right here.
        // --- (Whether the app wants a shared control-width scale is §4's open question.)
        width={140}
        onChanged={async (option) => {
          await mainApi.setGlobalSettingsValue(SETTING_IDE_ACTIVE_OUTPUT_PANE, option);
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="clear-all"
        title={t("panels.toolArea.clear")}
        clicked={() => {
          /*
           * `clear()` empties the buffer without going through `onContentsChanged`, which is what
           * the body's `isEmpty` is driven by — so the watermark stayed on over a pane the user had
           * just emptied. Bumping the command sequence number re-runs the body's effect, which
           * re-reads the buffer and settles both.
           */
          outputPaneService.getOutputPaneBuffer(activePane)?.clear();
          dispatch(incToolCommandSeqNoAction());
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName="copy"
        title={t("panels.toolArea.copyToClipboard")}
        clicked={async () => {
          navigator.clipboard.writeText(
            outputPaneService.getOutputPaneBuffer(activePane).getBufferText()
          );
          dispatch(setIdeStatusMessageAction(t("panels.toolArea.outputCopied"), true));
          dispatch(incToolCommandSeqNoAction());
        }}
      />
    </>
  );
};

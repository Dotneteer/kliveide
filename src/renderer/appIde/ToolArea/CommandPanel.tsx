import { useAppServices } from "@appIde/services/AppServicesProvider";
import React, { useEffect, useRef, useState } from "react";
import styles from "./CommandPanel.module.scss";
import classnames from "classnames";
import { useDispatch, useSelector } from "@renderer/core/RendererProvider";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { TabButton, TabButtonSpace } from "@controls/TabButton";
import { ConsoleOutput } from "../DocumentPanels/helpers/ConsoleOutput";

/**
 * The prompt sigil, and the prefix every executed command is echoed with.
 *
 * One constant because the two must match: the strip shows it live, and `executeCommand` writes it
 * into the buffer as the echo of what you ran. They were both `$` and would otherwise drift.
 *
 * It is also what the Copy-to-clipboard button puts on each echoed line. `\u276f` rather than `$`
 * is deliberate there too — these are Klive commands, not shell commands, and a `$` prefix invites
 * pasting them somewhere they will not run.
 */
const PROMPT_SIGIL = "\u276f";

export const CommandPanel = () => {
  const dispatch = useDispatch();
  const { ideCommandsService } = useAppServices();
  const inputRef = useRef<HTMLInputElement>();
  const buffer = ideCommandsService.getBuffer();
  const [executing, setExecuting] = useState(false);
  const commandSeqNo = useSelector(s => s.ideView?.toolCommandSeqNo);

  const historyIndex = useRef(-1);

  // --- Set the focus to the input element when the commands panel is activated, or a new
  // --- header command has been executed
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef.current, commandSeqNo]);

  return (
    <div
      className={styles.commandPanel}
      tabIndex={0}
      onFocus={() => inputRef?.current.focus()}
    >
      <div className={styles.outputWrapper}>
      <ConsoleOutput buffer={buffer} followTail />
      </div>
      {/*
        * `executing` sits on the strip, not on the input: the rail and the placeholder are both
        * driven from it, and the rail is drawn by the strip's own ::before.
        */}
      <div
        className={classnames(styles.promptWrapper, {
          [styles.executing]: executing
        })}
      >
        <span className={styles.promptPrefix} aria-hidden="true">
          {PROMPT_SIGIL}
        </span>
        <input
          ref={inputRef}
          className={styles.prompt}
          aria-label="Interactive command prompt"
          placeholder={
            executing ? "Executing command..." : "Type ? + Enter for help"
          }
          spellCheck={false}
          onKeyDown={processKey}
        />
      </div>
    </div>
  );

  // --- Process the pressed key
  async function processKey (e: React.KeyboardEvent): Promise<void> {
    const input = e.target as HTMLInputElement;
    switch (e.code) {
      case "Enter":
        const command = input.value;
        input.value = "";
        if (command.trim()) {
          await executeCommand(command);
        }
        break;

      case "ArrowUp":
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        const historyLength =
          ideCommandsService.getCommandHistoryLength();
        if (historyLength > 0) {
          historyIndex.current += e.key === "ArrowUp" ? 1 : -1;
          if (historyIndex.current === -1) {
            input.value = "";
          } else {
            historyIndex.current =
              (historyIndex.current + historyLength) % historyLength;
            input.value = ideCommandsService.getCommandFromHistory(
              historyIndex.current
            );
          }
        }
        break;
    }
  }

  // --- Execute the specified command
  async function executeCommand (command: string): Promise<void> {
    setExecuting(true);
    dispatch(setIdeStatusMessageAction("Executing command"));
    buffer.resetStyle();
    buffer.writeLine(`${PROMPT_SIGIL} ${command}`);
    const result = await ideCommandsService.executeInteractiveCommand(
      command,
      buffer
    );
    if (result.success) {
      dispatch(setIdeStatusMessageAction("Command executed", true));
    } else {
      dispatch(setIdeStatusMessageAction("Command executed with error", false));
    }
    setExecuting(false);
  }
};

export const CommandPanelHeader = () => {
  const dispatch = useDispatch();
  const { ideCommandsService: interactiveCommandsService } = useAppServices();
  return (
    <>
      <TabButtonSpace />
      <TabButton
        iconName='clear-all'
        title='Clear'
        clicked={() => {
          interactiveCommandsService.getBuffer().clear();
          dispatch(incToolCommandSeqNoAction());
        }}
      />
      <TabButtonSpace />
      <TabButton
        iconName='copy'
        title='Copy to clipboard'
        clicked={async () => {
          navigator.clipboard.writeText(
            interactiveCommandsService.getBuffer().getBufferText()
          );
          dispatch(
            setIdeStatusMessageAction("Output copied to the clipboard", true)
          );
          dispatch(incToolCommandSeqNoAction());
        }}
      />
    </>
  );
};

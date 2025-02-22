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

const CommandPanel = () => {
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
      <ConsoleOutput
          buffer={buffer}
          scrollLocked={false}
          showLineNo={false}
        />
      </div>
      <div className={styles.promptWrapper}>
        <span className={styles.promptPrefix}>$</span>
        <input
          ref={inputRef}
          className={classnames(styles.prompt, {
            [styles.executing]: executing
          })}
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
    buffer.writeLine(`$ ${command}`);
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

export const commandPanelRenderer = () => <CommandPanel />;

export const commandPanelHeaderRenderer = () => {
  const dispatch = useDispatch();
  const { ideCommandsService: interactiveCommandsService } = useAppServices();
  return (
    <>
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

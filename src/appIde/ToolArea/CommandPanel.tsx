import { useAppServices } from "@/appIde/services/AppServicesProvider";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { VirtualizedListApi } from "../../controls/VirtualizedList";
import { IOutputBuffer, OutputContentLine } from "./abstractions";
import styles from "./CommandPanel.module.scss";
import { OutputLine } from "./OutputPanel";
import classnames from "@/utils/classnames";
import { useDispatch, useSelector } from "@/core/RendererProvider";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { TabButton, TabButtonSpace } from "@/controls/TabButton";
import { VirtualizedListView } from "@/controls/VirtualizedListView";

const CommandPanel = () => {
  const dispatch = useDispatch();
  const { ideCommandsService } = useAppServices();
  const inputRef = useRef<HTMLInputElement>();
  const buffer = useRef<IOutputBuffer>(ideCommandsService.getBuffer());
  const [contents, setContents] = useState<OutputContentLine[]>(
    buffer.current.getContents()
  );
  const [executing, setExecuting] = useState(false);
  const commandSeqNo = useSelector(s => s.ideView?.toolCommandSeqNo);

  const api = useRef<VirtualizedListApi>();
  const historyIndex = useRef(-1);

  // --- Set the focus to the input element when the commands panel is activated, or a new
  // --- header command has been executed
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef.current, commandSeqNo]);

  // --- Respond to output buffer content changes
  useEffect(() => {
    const handleChanged = () => {
      setContents((buffer?.current?.getContents() ?? []).slice(0));
    };

    if (buffer.current) {
      buffer.current.contentsChanged.on(handleChanged);
    }

    return () => buffer.current?.contentsChanged?.off(handleChanged);
  }, [buffer.current]);

  // --- Automatically scroll to the end of the output buffer whenever the contents changes
  useLayoutEffect(() => {
    api.current?.scrollToEnd();
  }, [contents]);

  return (
    <div
      className={styles.commandPanel}
      tabIndex={0}
      onFocus={() => inputRef?.current.focus()}
    >
      <div className={styles.outputWrapper}>
        <VirtualizedListView
          items={contents ?? []}
          approxSize={20}
          fixItemHeight={false}
          vlApiLoaded={vlApi => (api.current = vlApi)}
          itemRenderer={idx => {
            return <OutputLine spans={contents?.[idx]?.spans} />;
          }}
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
    const output = buffer.current;
    setExecuting(true);
    dispatch(setIdeStatusMessageAction("Executing command"));
    output.resetStyle();
    output.writeLine(`$ ${command}`);
    setContents(buffer.current.getContents().slice(0));
    const result = await ideCommandsService.executeInteractiveCommand(
      command,
      output
    );
    if (result.success) {
      dispatch(setIdeStatusMessageAction("Command executed", true));
    } else {
      if (result.finalMessage) {
        output.color("bright-red");
        output.writeLine(result.finalMessage);
        output.resetStyle();
      }
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

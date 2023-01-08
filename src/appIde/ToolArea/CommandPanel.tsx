import { useAppServices } from "@/appIde/services/AppServicesProvider";
import { useEffect, useRef, useState } from "react";
import {
  VirtualizedList,
  VirtualizedListApi
} from "../../controls/common/VirtualizedList";
import { IOutputBuffer, OutputContentLine } from "./abstractions";
import styles from "./CommandPanel.module.scss";
import { OutputLine } from "./OutputPanel";
import classnames from "@/utils/classnames";
import { useDispatch, useSelector } from "@/core/RendererProvider";
import {
  incToolCommandSeqNoAction,
  setIdeStatusMessageAction
} from "@state/actions";
import { TabButton, TabButtonSeparator } from "@/controls/common/TabButton";

const CommandPanel = () => {
  const dispatch = useDispatch();
  const { interactiveCommandsService } = useAppServices();
  const inputRef = useRef<HTMLInputElement>();
  const buffer = useRef<IOutputBuffer>(interactiveCommandsService.getBuffer());
  const [contents, setContents] = useState<OutputContentLine[]>(
    buffer.current.getContents()
  );
  const [executing, setExecuting] = useState(false);
  const commandSeqNo = useSelector(s => s.ideView?.toolCommandSeqNo);

  const api = useRef<VirtualizedListApi>();

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
  useEffect(() => {
    if (api.current) {
      setTimeout(() => {
        api.current.scrollToEnd();
      }, 200);
    }
  }, [contents]);

  return (
    <div
      className={styles.component}
      tabIndex={0}
      onFocus={() => inputRef?.current.focus()}
    >
      <div className={styles.outputWrapper}>
        <VirtualizedList
          items={contents ?? []}
          approxSize={20}
          fixItemHeight={false}
          apiLoaded={vlApi => (api.current = vlApi)}
          itemRenderer={idx => {
            return <OutputLine spans={contents?.[idx]?.spans} />;
          }}
        />
      </div>
      <div className={styles.promptWrapper}>
        <span className={styles.promptPrefix}>$</span>
        <input
          ref={inputRef}
          className={classnames(
            styles.prompt,
            executing ? styles.executing : ""
          )}
          placeholder={
            executing ? "Executing command..." : "Type ? + Enter for help"
          }
          spellCheck={false}
          onKeyDown={async e => {
            const input = e.target as HTMLInputElement;
            if (e.code === "Enter") {
              const command = input.value;
              input.value = "";
              await executeCommand(command);
            }
          }}
        />
      </div>
    </div>
  );

  // --- Execute the specified command
  async function executeCommand (command: string): Promise<void> {
    const output = buffer.current;
    setExecuting(true);
    dispatch(setIdeStatusMessageAction("Executing command"));
    output.resetColor();
    output.writeLine(`$ ${command}`);
    setContents(buffer.current.getContents().slice(0));
    const result = await interactiveCommandsService.executeCommand(
      command,
      output
    );
    if (result.success) {
      dispatch(setIdeStatusMessageAction("Command executed", true));
    } else {
      if (result.finalMessage) {
        output.color("bright-red");
        output.writeLine(result.finalMessage);
        output.resetColor();
      }
      dispatch(setIdeStatusMessageAction("Command executed with error", false));
    }
    setExecuting(false);
  }
};

export const commandPanelRenderer = () => <CommandPanel />;

export const commandPanelHeaderRenderer = () => {
  const dispatch = useDispatch();
  const { interactiveCommandsService } = useAppServices();
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
      <TabButtonSeparator />
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

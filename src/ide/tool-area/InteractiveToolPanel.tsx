import * as React from "react";
import { createRef, CSSProperties, useRef } from "react";

import {
  getCommandService,
  getInteractivePaneService,
  getToolAreaService,
} from "@core/service-registry";
import {
  VirtualizedList,
  VirtualizedListApi,
} from "@components/VirtualizedList";
import { InteractiveCommandResult } from "@abstractions/interactive-command-service";
import { INTERACTIVE_TOOL_ID } from "@abstractions/tool-area-service";
import { CommandIconButton } from "../context-menu/CommandIconButton";
import { ToolPanelDescriptorBase } from "./ToolAreaService";
import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import { Row } from "@components/Panels";

const TITLE = "Interactive";

type State = {
  refreshCount: number;
  initPosition?: number;
  buffer: string[];
  inputEnabled: boolean;
};

/**
 * Z80 registers panel
 */
export default class InteractiveToolPanel extends ToolPanelBase<
  ToolPanelProps<{}>,
  State
> {
  private _listHost = createRef<HTMLDivElement>();
  private _inputRef = createRef<HTMLInputElement>();
  private _listApi: VirtualizedListApi;
  private _onContentsChanged: () => void;
  private _onCommandSubmitted: (command: string) => void;
  private _onCommandExecuted: (result: InteractiveCommandResult) => void;
  private _onFocusRequested: () => void;
  private _historyIndex = -1;

  constructor(props: ToolPanelProps<{}>) {
    super(props);
    this._onContentsChanged = () => this.onContentsChanged();
    this._onCommandSubmitted = (command: string) =>
      this.onCommandSubmitted(command);
    this._onCommandExecuted = (command) => this.onCommandExecuted(command);
    this._onFocusRequested = () => this.onFocusRequested();
    const interactivePaneService = getInteractivePaneService();
    this.state = {
      refreshCount: 0,
      initPosition: -1,
      buffer: interactivePaneService
        .getOutputBuffer()
        .getContents()
        .map((lc) => lc.text),
      inputEnabled: !interactivePaneService.isCommandExecuting(),
    };
  }

  title = TITLE;

  componentDidMount() {
    const interactivePaneService = getInteractivePaneService();
    const buffer = interactivePaneService.getOutputBuffer();
    buffer.contentsChanged.on(this._onContentsChanged);
    interactivePaneService.commandSubmitted.on(this._onCommandSubmitted);
    interactivePaneService.commandExecuted.on(this._onCommandExecuted);
    interactivePaneService.focusRequested.on(this._onFocusRequested);
    this.setFocusToPrompt();
  }

  componentWillUnmount() {
    const interactivePaneService = getInteractivePaneService();
    interactivePaneService.focusRequested.off(this._onFocusRequested);
    interactivePaneService.commandExecuted.off(this._onCommandExecuted);
    interactivePaneService.commandSubmitted.off(this._onCommandSubmitted);
    interactivePaneService
      .getOutputBuffer()
      .contentsChanged.off(this._onContentsChanged);
  }

  onContentsChanged(): void {
    this.setState({
      buffer: getInteractivePaneService()
        .getOutputBuffer()
        .getContents()
        .map((lc) => lc.text),
      initPosition: -1,
    });
    this._listApi.scrollToBottom();
  }

  async onCommandSubmitted(command: string): Promise<void> {
    const interactivePaneService = getInteractivePaneService();
    const buffer = interactivePaneService.getOutputBuffer();
    buffer.resetColor();
    buffer.writeLine(`$ ${command}`);
    const result = await getCommandService().executeCommand(command, buffer);
    interactivePaneService.signCommandExecuted(result);
  }

  onCommandExecuted(result: InteractiveCommandResult): void {
    this.setState({ inputEnabled: true });
    const buffer = getInteractivePaneService().getOutputBuffer();
    buffer.color(result.success ? "bright-green" : "bright-red");
    if (result.finalMessage) {
      buffer.writeLine(result.finalMessage);
    }
    buffer.resetColor();
    this.setFocusToPrompt();
  }

  onFocusRequested(): void {
    this.setFocusToPrompt();
    this.setState({
      refreshCount: this.state.refreshCount + 1,
    });
  }

  renderContent() {
    const isExecuting = getInteractivePaneService().isCommandExecuting();
    return (
      <>
        <Row
          hostRef={this._listHost}
          style={{ flexDirection: "column" }}
          onResized={() => this._listApi?.forceRefresh()}
        >
          <VirtualizedList
            itemHeight={18}
            itemsCount={this.state.buffer.length}
            style={{ userSelect: "text" }}
            renderItem={(index: number, style: CSSProperties) => {
              return (
                <div
                  key={index}
                  style={{
                    ...style,
                    fontSize: "0.95em",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: this.state.buffer[index],
                    }}
                  />
                </div>
              );
            }}
            registerApi={(api) => (this._listApi = api)}
            obtainInitPos={() => this.state.initPosition}
            onScrolled={(pos) => getToolAreaService().scrollActivePane(pos)}
          />
        </Row>
        <Row height="fittocontent" style={{ flexDirection: "column" }}>
          <div style={separatorStyle}></div>
          <div style={{ display: "flex" }}>
            <span
              style={{
                fontWeight: 600,
                color: isExecuting
                  ? "var(--information-color)"
                  : "var(--interactive-input-color)",
                marginRight: 8,
                marginTop: 2,
              }}
            >
              $
            </span>
            <input
              ref={this._inputRef}
              style={inputStyle}
              spellCheck={false}
              onKeyDown={(e) => this.keyDown(e)}
              disabled={isExecuting}
              placeholder={
                isExecuting ? "Executing command..." : "Type ? + Enter for help"
              }
            />
          </div>
        </Row>
      </>
    );
  }

  /**
   * Preprocess the input keys
   * @param e Keyboard event
   */
  keyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    const input = e.target as HTMLInputElement;
    const interactivePaneService = getInteractivePaneService();
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        const historyLength = interactivePaneService.getHistoryLength();
        if (historyLength > 0) {
          this._historyIndex += e.key === "ArrowUp" ? 1 : -1;
          if (this._historyIndex === -1) {
            input.value = "";
          } else {
            this._historyIndex =
              (this._historyIndex + historyLength) % historyLength;
            input.value = interactivePaneService.getCommandFromHistory(
              this._historyIndex
            );
          }
        }
        break;
      case "Enter":
        const command = input.value;
        input.value = "";
        interactivePaneService.submitCommand(command);
        break;
    }
  }

  setFocusToPrompt(): void {
    if (this._inputRef.current) {
      window.requestAnimationFrame(() => {
        this._inputRef.current.focus();
      });
    }
  }
}

const separatorStyle: CSSProperties = {
  marginTop: 8,
  height: 8,
  width: "100%",
  borderTop: "1px solid var(--panel-separator-border)",
  flexShrink: 0,
  flexGrow: 0,
};

const inputStyle: CSSProperties = {
  marginRight: 10,
  paddingLeft: 0,
  outline: "none",
  border: "none",
  width: "100%",
  flexGrow: 1,
  flexShrink: 1,
  fontFamily: "var(--console-font)",
  fontWeight: 600,
  fontSize: "0.9em",
  backgroundColor: "transparent",
  color: "var(--interactive-input-color)",
};

/**
 * Descriptor for the sample side bar panel
 */
export class InteractiveToolPanelDescriptor extends ToolPanelDescriptorBase {
  constructor() {
    super(INTERACTIVE_TOOL_ID, TITLE);
  }

  createHeaderElement(): React.ReactNode {
    const interactivePaneService = getInteractivePaneService();
    return (
      <div>
        <CommandIconButton
          iconName="clear-all"
          title={"Clear Output"}
          clicked={() => {
            interactivePaneService.clearOutputBuffer();
            interactivePaneService.requestFocus();
          }}
        />
      </div>
    );
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <InteractiveToolPanel descriptor={this} />;
  }
}

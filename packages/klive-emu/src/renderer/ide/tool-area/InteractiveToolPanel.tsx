import * as React from "react";
import { CSSProperties } from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common-ui/VirtualizedList";
import CommandIconButton from "../context-menu/CommandIconButton";
import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import { getCommandService } from "../../../shared/services/store-helpers";
import { getInteractivePaneService } from "../../../shared/services/store-helpers";
import { ToolPanelDescriptorBase } from "./ToolAreaService";
import { getToolAreaService } from "../../../shared/services/store-helpers";
import { CommandResult } from "../../../shared/services/ICommandService";

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
  private _inputRef = React.createRef<HTMLInputElement>();
  private _listApi: VirtualizedListApi;
  private _onContentsChanged: () => void;
  private _onCommandSubmitted: (command: string) => void;
  private _onCommandExecuted: (result: CommandResult) => void;
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
      buffer: interactivePaneService.getOutputBuffer().getContents(),
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
      buffer: getInteractivePaneService().getOutputBuffer().getContents(),
      initPosition: -1,
    });
    this._listApi.scrollToEnd();
  }

  async onCommandSubmitted(command: string): Promise<void> {
    const interactivePaneService = getInteractivePaneService();
    const buffer = interactivePaneService.getOutputBuffer();
    buffer.resetColor();
    buffer.writeLine(`$ ${command}`);
    const result = await getCommandService().executeCommand(command, buffer);
    interactivePaneService.signCommandExecuted(result);
  }

  onCommandExecuted(result: CommandResult): void {
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
  }

  renderContent() {
    const isExecuting = getInteractivePaneService().isCommandExecuting();
    return (
      <>
        <VirtualizedList
          itemHeight={18}
          numItems={this.state.buffer.length}
          renderItem={(index: number, style: CSSProperties) => {
            return (
              <div key={index} style={{ ...style }}>
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
          scrolled={(pos) => getToolAreaService().scrollActivePane(pos)}
        />
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
            placeholder={isExecuting ? "Executing command..." : ""}
          />
        </div>
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
  backgroundColor: "transparent",
  color: "var(--interactive-input-color)",
};

/**
 * Descriptor for the sample side bar panel
 */
export class InteractiveToolPanelDescriptor extends ToolPanelDescriptorBase {
  constructor() {
    super(TITLE);
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

import * as React from "react";
import { CSSProperties } from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common/VirtualizedList";
import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import { interactivePaneService } from "./InteractiveService";
import { toolAreaService, ToolPanelDescriptorBase } from "./ToolAreaService";

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
  private _onCommandExecuted: (command: string) => void;

  constructor(props: ToolPanelProps<{}>) {
    super(props);
    this._onContentsChanged = () => this.onContentsChanged();
    this._onCommandSubmitted = (command: string) =>
      this.onCommandSubmitted(command);
    this._onCommandExecuted = (command) => this.onCommandExecuted(command);
    this.state = {
      refreshCount: 0,
      initPosition: -1,
      buffer: interactivePaneService.getOutputBuffer().getContents(),
      inputEnabled: !interactivePaneService.isCommandExecuting(),
    };
  }

  title = TITLE;

  componentDidMount() {
    const buffer = interactivePaneService.getOutputBuffer();
    buffer.contentsChanged.on(this._onContentsChanged);
    interactivePaneService.commandSubmitted.on(this._onCommandSubmitted);
    console.log("subscribe");
    interactivePaneService.commandExecuted.on(this._onCommandExecuted);
    window.requestAnimationFrame(() => {
      this._inputRef.current.focus();
    });
  }

  componentWillUnmount() {
    interactivePaneService.commandExecuted.off(this._onCommandExecuted);
    interactivePaneService.commandSubmitted.off(this._onCommandSubmitted);
    console.log("unsubscribe");
    interactivePaneService
      .getOutputBuffer()
      .contentsChanged.off(this._onContentsChanged);
  }

  onContentsChanged(): void {
    this.setState({
      initPosition: -1,
    });
    this._listApi.scrollToEnd();
  }

  async onCommandSubmitted(command: string): Promise<void> {
    const buffer = interactivePaneService.getOutputBuffer();
    buffer.writeLine();
    buffer.resetColor();
    buffer.write("Executing ");
    buffer.color("brightBlue");
    buffer.write(command);
    this.setState({ inputEnabled: false });
    await new Promise((r) => setTimeout(r, 100));
    interactivePaneService.signCommandExecuted();
  }

  onCommandExecuted(command: string): void {
    this.setState({ inputEnabled: true });
    const buffer = interactivePaneService.getOutputBuffer();
    buffer.writeLine();
    buffer.resetColor();
    buffer.write("Executed ");
    buffer.color("brightGreen");
    buffer.write(command);
    window.requestAnimationFrame(() => {
      this._inputRef.current.focus();
    });
  }

  renderContent() {
    const isExecuting = interactivePaneService.isCommandExecuting();
    return (
      <>
        <VirtualizedList
          itemHeight={18}
          numItems={this.state.buffer.length}
          renderItem={(index: number, style: CSSProperties) => {
            return (
              <div key={index} style={{ ...style }}>
                <div
                  dangerouslySetInnerHTML={{ __html: this.state.buffer[index] }}
                />
              </div>
            );
          }}
          registerApi={(api) => (this._listApi = api)}
          obtainInitPos={() => this.state.initPosition}
          scrolled={(pos) => toolAreaService.scrollActivePane(pos)}
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
    switch (e.key) {
      case "ArrowUp":
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        break;
      case "Enter":
        const input = e.target as HTMLInputElement;
        const command = input.value;
        input.value = "";
        interactivePaneService.submitCommand(command);
        break;
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
    return <div></div>;
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    console.log("Create interactive panel");
    return <InteractiveToolPanel descriptor={this} />;
  }
}

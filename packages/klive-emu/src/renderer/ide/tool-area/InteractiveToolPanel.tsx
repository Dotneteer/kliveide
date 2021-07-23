import { NodeEventEmitter } from "electron";
import * as React from "react";
import { CSSProperties } from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common/VirtualizedList";
import { ToolPanelBase, ToolPanelProps } from "../ToolPanelBase";
import { OutputPaneBuffer } from "./OutputPaneService";
import { toolAreaService, ToolPanelDescriptorBase } from "./ToolAreaService";

const TITLE = "Interactive";

type State = {
  refreshCount: number;
  initPosition?: number;
  buffer: string[];
};

/**
 * Z80 registers panel
 */
export default class InteractiveToolPanel extends ToolPanelBase<
  ToolPanelProps<{}>,
  State
> {
  private _listApi: VirtualizedListApi;
  private _onContentsChanged: () => void;
  private _buffer = new OutputPaneBuffer();

  constructor(props: ToolPanelProps<{}>) {
    super(props);
    this._onContentsChanged = () => this.onContentsChanged();
    this.state = {
      refreshCount: 0,
      buffer: this._buffer.getContents(),
    };
  }

  title = TITLE;

  componentDidMount() {
    this._buffer.contentsChanged.on(this._onContentsChanged);
    setTimeout(() => {
      this._buffer.writeLine("Output panel");
      for (let i = 0; i < 20; i++) {
        this._buffer.writeLine(`#${i}: Displays interactive results`);
      }
    }, 2000);
  }

  componentWillUnmount() {
    this._buffer.contentsChanged.off(this._onContentsChanged);
  }

  onContentsChanged(): void {
    this.setState({
      initPosition: -1,
    });
    this._listApi.scrollToEnd();
  }

  renderContent() {
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
          scrolled={(pos) => toolAreaService.scrollActivePane(pos)}
        />
        <div style={separatorStyle}></div>
        <div>
          <span
            style={{
              fontWeight: 600,
              color: "var(--interactive-input-color)",
              marginRight: 8,
            }}
          >
            $
          </span>
          <input style={inputStyle} spellCheck={false} />
        </div>
      </>
    );
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
  flexGrow: 0,
  flexShrink: 0,
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
    return <InteractiveToolPanel descriptor={this} />;
  }
}
